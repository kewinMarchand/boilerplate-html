import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { fetchJson } from './prerender-content.js'
import { sitePages } from './ssi.js'

/**
 * Identité du site administrée dans l'API (section 22 de la spec commune), écrite à la construction de
 * l'image après les autres pré-rendus : nom, accroche, logo, thème par défaut et bloc de couleurs. Le bloc
 * est autorisé par son empreinte, que nginx lit dans le fichier donné en troisième argument
 * (`$identity_style_hash`, ajouté à `style-src`). API injoignable ou réponse invalide : les pages gardent
 * les valeurs de site.config.json, sans bloc.
 *
 * Usage : node --import ./tests/unit/siteResolver.js scripts/prerender-identity.js <site> <API_URL> <fichier nginx>
 */

const LOGO_HEIGHT = 40
const LOGO_MARK =
  /<img src="\/logo-mark\.svg" alt="" width="32" height="32" \/>\s*<span>[^<]*<\/span>/g
const JSON_LD = '<script type="application/ld\\+json">([\\s\\S]*?)</script>'

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const declarations = (tokens) =>
  Object.entries(tokens)
    .map(([token, value]) => `--bui-color-${token}:${value}`)
    .join(';')

/** Jetons de couleur de l'API, sous les sélecteurs de boilerplates-ui, jamais en mode renforcé. */
export const identityStyle = (theme) =>
  `:root:not([data-a11y-mode="enhanced"]){${declarations(theme.light)}}` +
  `[data-color-scheme="dark"]:not([data-a11y-mode="enhanced"]){${declarations(theme.dark)}}` +
  `@media (prefers-color-scheme: dark){[data-color-scheme="auto"]:not([data-a11y-mode="enhanced"]){${declarations(theme.dark)}}}`

export const styleHash = (css) => `'sha256-${createHash('sha256').update(css).digest('base64')}'`

const logoImage = (logo, name) => {
  const width = Math.round((LOGO_HEIGHT * logo.width) / logo.height)
  const srcset = logo.sources.find((source) => source.type === 'image/webp')?.srcset
  const responsive = srcset ? ` srcset="${escapeHtml(srcset)}" sizes="${width}px"` : ''
  return `<img class="logo-image" src="${escapeHtml(logo.src)}"${responsive} alt="${escapeHtml(name)}" width="${width}" height="${LOGO_HEIGHT}" fetchpriority="high" />`
}

const withSiteName = (json, name) => {
  const data = JSON.parse(json)
  const nodes = (data['@graph'] ?? [data]).filter((node) =>
    ['WebSite', 'Organization'].includes(node['@type']),
  )
  if (!nodes.length) return json
  for (const node of nodes) node.name = name
  return JSON.stringify(data).replaceAll('<', '\\u003c')
}

/**
 * Page ou partial avec l'identité de l'API à la place de celle de la configuration (`configName`) :
 * nom partout où il est écrit (texte, métadonnées, JSON-LD `WebSite` et `Organization`), accroche du
 * hero, logo du header, thème servi par défaut et bloc de couleurs dans `<head>`.
 */
export const prerenderIdentity = (html, identity, configName) => {
  const name = escapeHtml(identity.name)
  let page = html
    .replace(
      '<html lang="fr" data-color-scheme="auto">',
      `<html lang="fr" data-color-scheme="${identity.defaultColorScheme}">`,
    )
    .replace(/(\s*)<p class="hero-lead">[\s\S]*?<\/p>/, (_, space) =>
      identity.tagline ? `${space}<p class="hero-lead">${escapeHtml(identity.tagline)}</p>` : '',
    )
    .replace(LOGO_MARK, (match) =>
      identity.logo ? logoImage(identity.logo, identity.name) : match,
    )
    .replace(new RegExp(`${JSON_LD}|${escapeRegExp(configName)}`, 'g'), (match, json) =>
      json === undefined
        ? name
        : `<script type="application/ld+json">${withSiteName(json, identity.name)}</script>`,
    )
  if (identity.theme) {
    page = page.replace(
      '</head>',
      () => `  <style>${identityStyle(identity.theme)}</style>\n  </head>`,
    )
  }
  return page
}

/** Manifeste avec le nom de l'API, et sa couleur principale quand elle est saisie. */
export const identityManifest = (json, identity) =>
  `${JSON.stringify(
    {
      ...JSON.parse(json),
      name: identity.name,
      short_name: identity.name,
      ...(identity.theme && { theme_color: identity.theme.light.primary }),
    },
    null,
    2,
  )}\n`

const main = async ([siteDir, apiUrl, nginxFile]) => {
  // Import dynamique : la traduction importe le socle par son chemin servi, que seul le crochet
  // siteResolver.js résout, et tests/e2e/identite.e2e.js importe ce fichier sans lui.
  const { toSiteIdentity } =
    await import('/js/modules/identity/infrastructure/http/siteIdentityTranslation.js')
  let identity
  try {
    identity = toSiteIdentity(await fetchJson(apiUrl, '/api/site-identity'))
  } catch (error) {
    console.warn(`[identité] valeurs de site.config.json, API injoignable (${error.message})`)
    writeFileSync(nginxFile, 'set $identity_style_hash "";\n')
    return
  }
  const hash = identity.theme ? styleHash(identityStyle(identity.theme)) : ''
  writeFileSync(nginxFile, `set $identity_style_hash "${hash}";\n`)
  const { name } = JSON.parse(readFileSync(join(siteDir, '..', 'site.config.json'), 'utf8'))
  const files = [
    ...sitePages(siteDir),
    join(siteDir, 'partials', 'header.html'),
    join(siteDir, 'partials', 'footer.html'),
  ]
  for (const file of files) {
    writeFileSync(file, prerenderIdentity(readFileSync(file, 'utf8'), identity, name))
  }
  const manifest = join(siteDir, 'manifest.webmanifest')
  writeFileSync(manifest, identityManifest(readFileSync(manifest, 'utf8'), identity))
  console.info(
    `[identité] « ${identity.name} » écrite dans les pages${hash ? ', avec ses couleurs' : ''}`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
