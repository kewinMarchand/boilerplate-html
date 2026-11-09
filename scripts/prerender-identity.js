import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import { fetchJson } from './apiFetch.js'
import { setMeta } from './prerender-content.js'
import { localeRoot, pageLocales } from './prerender-locales.js'
import { largestWebp } from './prerenderPicture.js'
import { sitePages } from './ssi.js'

/**
 * Identité du site administrée dans l'API (section 22 de la spec commune), écrite à la construction de
 * l'image après les autres pré-rendus : nom, accroche, logo, thème par défaut et bloc de couleurs. Le bloc
 * est autorisé par son empreinte, que nginx lit dans le fichier donné en troisième argument
 * (`$identity_style_hash`, ajouté à `style-src`). API injoignable ou réponse invalide : les pages gardent
 * les valeurs de site.config.json, sans bloc. Sur un site à plusieurs langues, chaque langue reçoit
 * l'identité et les métadonnées lues dans sa langue.
 *
 * Usage : node --import ./tests/unit/siteResolver.js scripts/prerender-identity.js <site> <API_URL> <fichier nginx>
 */

const LOGO_HEIGHT = 40
const DEFAULT_SHARE_IMAGE = /<meta\s+property="og:image"\s+content="[^"]*\/images\/og-image\.jpg"/
const FAVICONS =
  /<link rel="icon" href="\/favicon\.ico" sizes="48x48" \/>\s*<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" \/>/

/** Pages fixes et leur clé dans `GET /api/page-metas` (section 26 de la spec commune). */
export const PAGE_META_KEYS = {
  'index.html': 'home',
  'catalogue/index.html': 'catalog',
  'blog/index.html': 'blog',
  'contact/index.html': 'contact',
  'plan-du-site/index.html': 'sitemap',
  'mentions-legales/index.html': 'legal-notice',
  'donnees-personnelles/index.html': 'privacy',
  'accessibilite/index.html': 'accessibility',
}
/** Pages servies seulement quand la vente en ligne est active : retirées de l'image sinon (404 de nginx). */
export const SALES_PAGES = ['panier/index.html']
// Élément marqué `data-sales` (prix, filtre et tris par prix, lien et bouton du panier, leurs scripts) :
// présent seulement quand la vente est active. Aucun ne contient un élément de même nom.
const SALES_ELEMENT = /\s*<(\w+)\b[^>]*\sdata-sales(?=[\s>])[^>]*>[\s\S]*?<\/\1>/g
const INQUIRY_TEMPLATE = /<template id="product-inquiry-template">\s*([\s\S]*?)\s*<\/template>/
// Prix écrit dans la description construite de la fiche (« …, taille M, 34,90 €. En stock… »,
// « …, size M, €34.90. In stock… »)
const DESCRIBED_PRICE =
  /(<meta\s+(?:name|property)="(?:og:|twitter:)?description"\s+content="[^"]*), (?:\d[\d\u00a0\u202f]*,\d{2}\u00a0€|€[\d,]*\.\d{2})(?=\.)/g
// Contact avec un produit (`contact/demande/<slug>.html`, section 27) : métadonnées de la page contact
const pageMetaFile = (file) => (file.startsWith('contact/demande/') ? 'contact/index.html' : file)
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

/** Sans vente en ligne, aucune offre (`offers`) dans les données structurées, à toute profondeur. */
const withoutOffers = (node) => {
  if (Array.isArray(node)) return node.map(withoutOffers)
  if (node === null || typeof node !== 'object') return node
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== 'offers')
      .map(([key, value]) => [key, withoutOffers(value)]),
  )
}

/**
 * Nom de l'API dans `WebSite` et `Organization`, son icône (512) en logo d'`Organization` si elle est
 * saisie, et les offres retirées sans vente en ligne.
 */
const withSiteName = (json, identity) => {
  const data = identity.salesEnabled ? JSON.parse(json) : withoutOffers(JSON.parse(json))
  const nodes = (data['@graph'] ?? [data]).filter((node) =>
    ['WebSite', 'Organization'].includes(node['@type']),
  )
  if (!nodes.length && identity.salesEnabled) return json
  for (const node of nodes) {
    node.name = identity.name
    if (node['@type'] === 'Organization' && identity.icon) node.logo = identity.icon.png512
  }
  return JSON.stringify(data).replaceAll('<', '\\u003c')
}

/**
 * Sans vente en ligne (section 27 de la spec commune) : éléments `data-sales` retirés, demande de
 * renseignement de la fiche sortie de son `<template>`, prix retiré de la description, et
 * `data-sales-disabled` sur `<html>` pour les scripts qui écrivent des cartes ou lisent l'URL du catalogue.
 */
const withoutSales = (html) =>
  html
    .replace(SALES_ELEMENT, '')
    .replace(INQUIRY_TEMPLATE, (_, link) => link)
    .replace(DESCRIBED_PRICE, '$1')
    .replace(/(<html lang="[a-z]{2}"[^>]*)>/, '$1 data-sales-disabled>')

/** Titre et description saisis pour la page fixe ; vides : ceux de la page. */
const withPageMeta = (html, meta) => {
  let page = html
  if (meta?.title) {
    page = page.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(meta.title)}</title>`)
    page = setMeta(page, 'property', 'og:title', meta.title)
    page = setMeta(page, 'name', 'twitter:title', meta.title)
  }
  if (meta?.description) {
    for (const [attribute, name] of [
      ['name', 'description'],
      ['property', 'og:description'],
      ['name', 'twitter:description'],
    ]) {
      page = setMeta(page, attribute, name, meta.description)
    }
  }
  return page
}

/** Image de partage du site à la place de `og-image.jpg`, seulement sur une page sans image propre. */
const withShareImage = (html, image, name) => {
  if (!image || !DEFAULT_SHARE_IMAGE.test(html)) return html
  const src = largestWebp(image)
  let page = setMeta(html, 'property', 'og:image', src)
  page = setMeta(page, 'name', 'twitter:image', src)
  page = setMeta(page, 'property', 'og:image:width', String(image.width))
  page = setMeta(page, 'property', 'og:image:height', String(image.height))
  return setMeta(page, 'property', 'og:image:alt', image.alt || name)
}

/** Icônes PNG de l'API à la place des favicons du site. */
const withIcon = (html, icon) =>
  icon
    ? html
        .replace(
          FAVICONS,
          () =>
            `<link rel="icon" href="${escapeHtml(icon.png32)}" type="image/png" sizes="32x32" />`,
        )
        .replace(
          '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
          () => `<link rel="apple-touch-icon" href="${escapeHtml(icon.png180)}" />`,
        )
    : html

/**
 * Page ou partial avec l'identité de l'API à la place de celle de la configuration (`configName`) :
 * nom partout où il est écrit (texte, métadonnées, JSON-LD `WebSite` et `Organization`), accroche du
 * hero, logo du header, thème servi par défaut et bloc de couleurs dans `<head>`, titre et description
 * saisis pour la page fixe (`pageMeta`), image de partage, icônes, et page sans vente en ligne.
 */
export const prerenderIdentity = (html, identity, configName, pageMeta = null) => {
  const name = escapeHtml(identity.name)
  let page = html
    .replace(
      /(<html lang="[a-z]{2}") data-color-scheme="auto"/,
      (_, open) => `${open} data-color-scheme="${identity.defaultColorScheme}"`,
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
        : `<script type="application/ld+json">${withSiteName(json, identity)}</script>`,
    )
  page = withIcon(
    withShareImage(withPageMeta(page, pageMeta), identity.shareImage, identity.name),
    identity.icon,
  )
  if (!identity.salesEnabled) page = withoutSales(page)
  if (identity.theme) {
    page = page.replace(
      '</head>',
      () => `  <style>${identityStyle(identity.theme)}</style>\n  </head>`,
    )
  }
  return page
}

/** Manifeste avec le nom de l'API, sa couleur principale et ses icônes quand elles sont saisies. */
export const identityManifest = (json, identity) =>
  `${JSON.stringify(
    {
      ...JSON.parse(json),
      name: identity.name,
      short_name: identity.name,
      ...(identity.theme && { theme_color: identity.theme.light.primary }),
      ...(identity.icon && {
        icons: [
          { src: identity.icon.png192, sizes: '192x192', type: 'image/png' },
          { src: identity.icon.png512, sizes: '512x512', type: 'image/png' },
        ],
      }),
    },
    null,
    2,
  )}\n`

const main = async ([siteDir, apiUrl, nginxFile]) => {
  // Import dynamique : la traduction importe le socle par son chemin servi, que seul le crochet
  // siteResolver.js résout, et tests/e2e/identite.e2e.js importe ce fichier sans lui.
  const { toPageMetas, toSiteIdentity } =
    await import('/js/modules/identity/infrastructure/http/siteIdentityTranslation.js')
  const { locales } = pageLocales(readFileSync(join(siteDir, 'index.html'), 'utf8'))
  const { name } = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'))
  let hash
  for (const locale of locales) {
    // Site d'une seule langue : adresses de l'API inchangées, sans `locale`
    const localeParam = locales.length > 1 ? { locale } : {}
    let identity
    try {
      identity = toSiteIdentity(await fetchJson(apiUrl, '/api/site-identity', localeParam))
    } catch (error) {
      console.warn(`[identité] valeurs de site.config.json, API injoignable (${error.message})`)
      writeFileSync(nginxFile, 'set $identity_style_hash "";\n')
      return
    }
    // Une API qui ne sert pas les métadonnées des pages fixes (Hono) en vaut une où elles sont vides
    const pageMetas = await fetchJson(apiUrl, '/api/page-metas', localeParam).then(
      toPageMetas,
      () => ({}),
    )
    hash = identity.theme ? styleHash(identityStyle(identity.theme)) : ''
    const root = localeRoot(siteDir, locale, locales)
    if (!identity.salesEnabled) {
      for (const page of SALES_PAGES) rmSync(join(root, page))
    }
    const files = [
      ...sitePages(root).filter(
        (file) => locale !== locales[0] || !isOtherLocale(siteDir, file, locales),
      ),
      join(root, 'partials', 'header.html'),
      join(root, 'partials', 'footer.html'),
    ]
    for (const file of files) {
      const pageMeta = pageMetas[PAGE_META_KEYS[pageMetaFile(relative(root, file))]] ?? null
      writeFileSync(file, prerenderIdentity(readFileSync(file, 'utf8'), identity, name, pageMeta))
    }
    if (locale === locales[0]) {
      const manifest = join(siteDir, 'manifest.webmanifest')
      writeFileSync(manifest, identityManifest(readFileSync(manifest, 'utf8'), identity))
    }
    console.info(
      `[identité] « ${identity.name} » écrite dans les pages (${locale})${hash ? ', avec ses couleurs' : ''}${identity.salesEnabled ? '' : ', sans vente en ligne'}`,
    )
  }
  writeFileSync(nginxFile, `set $identity_style_hash "${hash}";\n`)
}

/** Page sous la racine d'une autre langue, traitée avec l'identité de cette langue. */
const isOtherLocale = (siteDir, file, locales) =>
  locales.slice(1).includes(relative(siteDir, file).split('/')[0])

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
