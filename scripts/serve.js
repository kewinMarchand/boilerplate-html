import { createReadStream, readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import { fetchJson } from './apiFetch.js'
import {
  prerenderArticle,
  prerenderContactProduct,
  prerenderProduct,
  withCategoryHrefs,
} from './prerender-content.js'
import { resolveVariables, runtimeVariables } from './runtimeVariables.js'
import { renderSsi } from './ssi.js'

// SITE_ROOT : un site généré (le site bilingue des tests) à la place des sources
const ROOT = process.env.SITE_ROOT
  ? `${resolve(process.env.SITE_ROOT)}/`
  : fileURLToPath(new URL('../site/', import.meta.url))
const HEADERS_FILE = fileURLToPath(new URL('../docker/security-headers.conf', import.meta.url))
const PORT = Number(process.argv[2] ?? 3130)
const MAINTENANCE = process.env.MAINTENANCE === '1'
const ERROR_TEST_ROUTE = '/_erreur-test'
const STYLEGUIDE_MARKER = '<!-- dev:styleguide -->'
// Préfixe de langue facultatif (section 29 bis de la spec commune), comme dans les règles de nginx
const PARTIALS = /^(\/[a-z]{2})?\/partials\//
const ARTICLE_PATH = /^(\/[a-z]{2})?\/blog\/([a-z0-9-]+)\/?$/
const PRODUCT_PATH = /^(\/[a-z]{2})?\/produit\/([a-z0-9-]+)\/?$/
const PRODUCT_SLUG = /^[a-z0-9-]+$/
const STYLEGUIDE_LINK = '<p><a href="/charte-graphique">Charte graphique (développement)</a></p>'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.xml': 'text/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const RUNTIME = runtimeVariables(process.env)

const SECURITY_HEADERS = Object.fromEntries(
  [
    ...(await readFile(HEADERS_FILE, 'utf8')).matchAll(
      /add_header\s+([\w-]+)\s+"([^"]*)"\s+always;/g,
    ),
  ].map(([, name, value]) => [name, resolveVariables(value, RUNTIME)]),
)

const isFile = async (path) => {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

const decodePath = (pathname) => {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return undefined
  }
}

const resolveFile = async (pathname) => {
  const decoded = decodePath(pathname)
  if (decoded === undefined || PARTIALS.test(decoded)) return undefined
  const path = join(ROOT, normalize(decoded))
  if (!path.startsWith(ROOT)) return undefined
  for (const candidate of [path, join(path, 'index.html')]) {
    if (await isFile(candidate)) return candidate
  }
  // Fiche article ou produit non pré-rendue : le gabarit, rempli par JavaScript (même règle que nginx)
  for (const [pattern, template] of [
    [ARTICLE_PATH, 'blog/fiche.html'],
    [PRODUCT_PATH, 'produit/fiche.html'],
  ]) {
    const match = pattern.exec(decoded)
    const file = match && join(ROOT, match[1] ?? '', template)
    if (file && (await isFile(file))) return file
  }
  return undefined
}

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.svg', '.xml'])

/** `content` : HTML déjà produit pour `file` (fiche pré-rendue), à la place du fichier lu sur le disque. */
const send = async (request, response, status, file, extraHeaders = {}, content = undefined) => {
  const extension = extname(file)
  const headers = {
    ...SECURITY_HEADERS,
    ...extraHeaders,
    'Content-Type': TYPES[extension] ?? 'application/octet-stream',
  }
  if (!COMPRESSIBLE.has(extension)) {
    response.writeHead(status, headers)
    if (request.method === 'HEAD') response.end()
    else createReadStream(file).pipe(response)
    return
  }

  let body = content === undefined ? await readFile(file) : Buffer.from(content)
  if (extension === '.html') {
    const html = renderSsi(body.toString('utf8'), {
      readInclude: (path) => readFileSync(join(ROOT, path), 'utf8'),
      variables: { ...RUNTIME },
    })
    body = Buffer.from(html.replace(STYLEGUIDE_MARKER, STYLEGUIDE_LINK))
  }
  if (/\bgzip\b/.test(request.headers['accept-encoding'] ?? '')) {
    body = gzipSync(body)
    headers['Content-Encoding'] = 'gzip'
  }
  response.writeHead(status, { ...headers, Vary: 'Accept-Encoding' })
  response.end(request.method === 'HEAD' ? undefined : body)
}

const SITE_URL = JSON.parse(
  readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'),
).url

/** Fiche pré-rendue à la demande, avec la fonction du pré-rendu ; slug inconnu ou API injoignable : le gabarit. */
const prerendered = async (apiPath, template, render) => {
  try {
    return render(await readFile(template, 'utf8'), await fetchJson(RUNTIME.api_url, apiPath))
  } catch {
    return undefined
  }
}

const prerenderedArticle = (pathname, template) =>
  prerendered(`/api/articles/${ARTICLE_PATH.exec(pathname)?.[2]}`, template, (html, dto) =>
    prerenderArticle(html, dto, SITE_URL),
  )

const prerenderedProduct = (pathname, template) =>
  prerendered(`/api/products/${PRODUCT_PATH.exec(pathname)?.[2]}`, template, (html, dto) =>
    prerenderProduct(html, withCategoryHrefs(dto), SITE_URL),
  )

// Comme nginx, qui sert contact/demande/<slug>.html quand le produit était connu à la construction ;
// pré-rendue à la demande depuis les sources
const prerenderedContact = async (slug, template) => {
  if (!PRODUCT_SLUG.test(slug ?? '')) return undefined
  const generated = join(template, '..', 'demande', `${slug}.html`)
  if (await isFile(generated)) return readFile(generated, 'utf8')
  return prerendered(`/api/products/${slug}`, template, prerenderContactProduct)
}

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    await send(request, response, 405, join(ROOT, '405.html'), { Allow: 'GET, HEAD' })
    return
  }
  const { pathname, searchParams } = new URL(request.url, 'http://localhost')
  const file = await resolveFile(pathname)
  const isPage = !file || extname(file) === '.html'

  if (MAINTENANCE && isPage) {
    await send(request, response, 503, join(ROOT, '503.html'), { 'Retry-After': '3600' })
  } else if (pathname === ERROR_TEST_ROUTE) {
    await send(request, response, 500, join(ROOT, '50x.html'))
  } else if (file?.endsWith('/blog/fiche.html')) {
    // Comme nginx, qui sert la fiche pré-rendue à la construction quand l'API connaît l'article
    const html = await prerenderedArticle(pathname, file)
    await send(request, response, 200, file, {}, html)
  } else if (file?.endsWith('/produit/fiche.html')) {
    await send(request, response, 200, file, {}, await prerenderedProduct(pathname, file))
  } else if (file?.endsWith('/contact/index.html')) {
    const html = await prerenderedContact(searchParams.get('produit'), file)
    await send(request, response, 200, file, {}, html)
  } else if (file) {
    await send(request, response, 200, file)
  } else {
    await send(request, response, 404, join(ROOT, '404.html'))
  }
}).listen(PORT, () => {
  console.log(`Serveur statique prêt sur http://localhost:${PORT}`)
})
