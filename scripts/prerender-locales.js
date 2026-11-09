import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import { languageTag, prefixPath } from '../site/js/shared/locale.js'
import { fetchJson } from './apiFetch.js'
import { sitePages } from './ssi.js'

/**
 * Langues du site à la construction de l'image (section 29 bis de la spec commune, ADR 0004). Les
 * sources sont en français, langue par défaut. Quand `GET /api/site-identity` sert plusieurs langues
 * (`locales`, la première par défaut), `pages` écrit sous `/<langue>/` une copie traduite de chaque page
 * et des partials : textes et attributs lus (dont les libellés des scripts, `data-label-*`) remplacés par
 * ceux de `i18n/<langue>.json` à partir de leur valeur française (`i18n/fr.json`), liens internes
 * préfixés, chemins et noms des catégories lus dans l'API. Toutes les pages reçoivent alors leurs langues
 * (`<html lang data-locales>`, canonique, `og:locale`, `hreflang`) et le sélecteur de langue du header ;
 * les pré-rendus suivants lisent la langue de chaque page. `sitemap`, lancé après eux, ajoute à chaque
 * adresse ses équivalents. Site d'une seule langue : rien n'est écrit, la sortie reste la même.
 *
 * Usage : node --import ./tests/unit/siteResolver.js scripts/prerender-locales.js pages <site> <API_URL>
 *         node scripts/prerender-locales.js sitemap <site>
 */

const I18N = new URL('../i18n/', import.meta.url)
const SITE_URL = JSON.parse(
  readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'),
).url
/** Pages servies telles quelles dans toutes les langues (erreurs de nginx) ou absentes de l'image. */
export const UNTRANSLATED_PAGES = ['404.html', '405.html', '50x.html', '503.html']
const DEV_PAGES = ['charte-graphique/index.html']
/** Gabarits des fiches : sans équivalent connu, le sélecteur mène à l'accueil de chaque langue. */
const TEMPLATES = ['blog/fiche.html', 'produit/fiche.html']
const PARTIALS = ['header.html', 'footer.html']
const META_TEXT = new Set([
  'description',
  'og:title',
  'og:description',
  'og:image:alt',
  'og:site_name',
  'twitter:title',
  'twitter:description',
])
const TOKEN =
  /(<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<(?:[^>"']|"[^"]*"|'[^']*')+>)/
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export const decodeEntities = (value) =>
  value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code) =>
    code[0] === '#'
      ? String.fromCodePoint(Number(code[1] === 'x' ? `0${code.slice(1)}` : code.slice(1)))
      : (ENTITIES[code] ?? entity),
  )

const escapeText = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const escapeAttribute = (value) => escapeText(value).replaceAll('"', '&quot;')

export const readDictionary = (locale) => {
  const file = new URL(`${locale}.json`, I18N)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

/**
 * Table texte français → texte de la langue, par clé. Une langue sans fichier garde les libellés
 * français. Un même texte français traduit de deux façons est une erreur : le remplacement serait ambigu.
 */
export const translationTable = (source, target) => {
  const table = new Map()
  for (const [key, text] of Object.entries(source)) {
    const translated = target?.[key] ?? text
    if (table.has(text) && table.get(text) !== translated) {
      throw new Error(`Libellé ambigu : « ${text} » (${key})`)
    }
    table.set(text, translated)
  }
  return table
}

const normalize = (text) => decodeEntities(text).replace(/\s+/g, ' ').trim()

/** Texte traduit, ou une suite « A · B » dont chaque partie l'est (titres des pages) ; `undefined` sinon. */
const lookup = (text, table) => {
  if (table.has(text)) return table.get(text)
  const parts = text.split(' · ')
  return parts.length > 1 && parts.every((part) => table.has(part))
    ? parts.map((part) => table.get(part)).join(' · ')
    : undefined
}

const translateValue = (raw, table, missing, escape) => {
  const text = normalize(raw)
  if (!/\p{L}/u.test(text)) return raw
  const translated = lookup(text, table)
  if (translated === undefined) {
    missing.add(text)
    return raw
  }
  const [, before, after] = raw.match(/^(\s*)[\s\S]*?(\s*)$/)
  return `${before}${escape(translated)}${after}`
}

const TRANSLATED_ATTRIBUTE =
  /(\s)(aria-label|aria-roledescription|alt|title|placeholder|data-label-[\w-]+)="([^"]*)"/g
const META_CONTENT = /^<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"/

const translateTag = (tag, table, missing) => {
  const meta = tag.match(META_CONTENT)
  if (meta && META_TEXT.has(meta[1])) {
    return tag.replace(
      `content="${meta[2]}"`,
      () => `content="${translateValue(meta[2], table, missing, escapeAttribute)}"`,
    )
  }
  return tag.replace(
    TRANSLATED_ATTRIBUTE,
    (_, space, name, value) =>
      `${space}${name}="${translateValue(value, table, missing, escapeAttribute)}"`,
  )
}

/**
 * Textes et attributs lisibles d'un document traduits par la table ; `missing` reçoit les textes
 * français sans traduction (laissés tels quels). Scripts, styles et commentaires ne sont pas touchés.
 */
export const translateHtml = (html, table, missing = new Set()) =>
  html
    .split(TOKEN)
    .map((token, index) => {
      if (index % 2 === 0) return translateValue(token, table, missing, escapeText)
      return token.startsWith('<!--') || /^<(script|style)\b/.test(token)
        ? token
        : translateTag(token, table, missing)
    })
    .join('')

const PAGE_LINK = /(\s(?:href|action)=")(\/[^"]*)"/g
const INCLUDE = /(<!--#\s*include\s+virtual=")\/partials\//g

/** Adresse interne d'une page dans la langue : chemin de catégorie traduit, puis préfixe. */
export const localizePagePath = (url, { locale, locales, paths = new Map() }) => {
  const [, path, rest] = url.match(/^([^?#]*)(.*)$/)
  if (path.startsWith('//') || /\.[a-z\d]+$/i.test(path)) return url
  return `${prefixPath(paths.get(path) ?? path, locale, locales)}${rest}`
}

/**
 * Liens internes (`href`, `action`), inclusions des partials et slugs de catégorie (`data-category`,
 * compteurs) d'un document dans la langue. Les fichiers (feuille, icônes, images) gardent leur adresse.
 */
export const localizeLinks = (html, context) =>
  html
    .replace(PAGE_LINK, (_, open, url) => `${open}${localizePagePath(url, context)}"`)
    .replace(
      INCLUDE,
      (_, open) => `${open}${prefixPath('/partials/', context.locale, context.locales)}`,
    )
    .replace(
      /(data-category="|data-count="category-)([a-z0-9-]+)"/g,
      (_, open, slug) => `${open}${context.slugs?.get(slug) ?? slug}"`,
    )

/** Données structurées dans la langue : textes traduits, adresses du site localisées, `inLanguage`. */
export const localizeJsonLd = (html, table, context) =>
  html.replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
    (_, open, json, close) => {
      const walk = (node, key) => {
        if (Array.isArray(node)) return node.map((item) => walk(item))
        if (node !== null && typeof node === 'object') {
          return Object.fromEntries(
            Object.entries(node).map(([name, value]) => [name, walk(value, name)]),
          )
        }
        if (typeof node !== 'string') return node
        if (key === 'inLanguage') return languageTag(context.locale)
        if (node.startsWith(context.siteUrl)) {
          const path = node.slice(context.siteUrl.length) || '/'
          return `${context.siteUrl}${localizePagePath(path, context)}`
        }
        return lookup(node, table) ?? node
      }
      const data = walk(JSON.parse(json))
      return `${open}${JSON.stringify(data).replaceAll('<', '\\u003c')}${close}`
    },
  )

const languageName = (locale) => {
  const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale)
  return `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)}`
}

/** Variable SSI qui porte l'adresse de la page dans une langue, lue par le sélecteur du header. */
const alternateVariable = (locale) => `locale_${locale}`

/**
 * Sélecteur de langue du header : un lien par langue, intitulé dans sa propre langue, vers l'adresse
 * que la page donne en variable SSI (son équivalent, ou l'accueil de la langue).
 */
export const languageSwitcher = (locale, locales, label) => {
  const links = locales
    .map(
      (code) =>
        `<li><a class="language-switcher-link" href="<!--# echo var='${alternateVariable(code)}' -->" lang="${code}" hreflang="${code}"${code === locale ? ' aria-current="true"' : ''} data-testid="layout-language-${code}">${escapeText(languageName(code))}</a></li>`,
    )
    .join('')
  return `<nav class="container language-switcher" aria-label="${escapeAttribute(label)}" data-testid="layout-languages"><ul class="language-switcher-list">${links}</ul></nav>`
}

export const ogLocale = (locale) => languageTag(locale).replace('-', '_')

const HEADER_INCLUDE =
  /([ \t]*)(<!--#\s*include\s+virtual="(?:\/[a-z]{2})?\/partials\/header\.html"\s*-->)/

/**
 * En-tête d'une page dans sa langue : `<html lang data-locales>`, canonique et `og:url`, `og:locale` et
 * ses alternatives, `hreflang` de chaque langue où la page existe (`paths`, adresses sans domaine) et
 * `x-default` vers la langue par défaut, et les adresses du sélecteur (l'accueil d'une langue sans
 * équivalent). Rejouable : une fiche pré-rendue remplace ce que son gabarit portait.
 */
export const withAlternates = (html, { locale, locales, paths, siteUrl = SITE_URL }) => {
  const origin = siteUrl.replace(/\/$/, '')
  const available = locales.filter((code) => paths[code])
  const links = [
    ...available.map(
      (code) => `<link rel="alternate" hreflang="${code}" href="${origin}${paths[code]}" />`,
    ),
    ...(paths[locales[0]]
      ? [`<link rel="alternate" hreflang="x-default" href="${origin}${paths[locales[0]]}" />`]
      : []),
  ]
  const variables = locales
    .map(
      (code) =>
        `<!--# set var="${alternateVariable(code)}" value="${paths[code] ?? prefixPath('/', code, locales)}" -->`,
    )
    .join('')
  let page = html
    .replace(
      /<html lang="[a-z]{2}"( data-locales="[^"]*")?/,
      `<html lang="${locale}" data-locales="${locales.join(' ')}"`,
    )
    .replace(/\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>/g, '')
    .replace(/\s*<meta property="og:locale:alternate" content="[^"]*" \/>/g, '')
    .replace(/<!--# set var="locale_[a-z]{2}" value="[^"]*" -->/g, '')
    .replace(
      /(<meta property="og:locale" content=")[^"]*(" \/>)/,
      (_, open, close) =>
        `${open}${ogLocale(locale)}${close}${available
          .filter((code) => code !== locale)
          .map(
            (code) => `\n    <meta property="og:locale:alternate" content="${ogLocale(code)}" />`,
          )
          .join('')}`,
    )
    .replace(HEADER_INCLUDE, (_, indent, include) => `${indent}${variables}\n${indent}${include}`)
  if (paths[locale]) {
    page = page
      .replace(
        /(<link rel="canonical" href=")[^"]*(")/,
        (_, open, close) => `${open}${origin}${paths[locale]}${close}`,
      )
      .replace(
        /(<meta property="og:url" content=")[^"]*(")/,
        (_, open, close) => `${open}${origin}${paths[locale]}${close}`,
      )
      .replace(/(<link rel="canonical" href="[^"]*" \/>)/, (canonical) =>
        [canonical, ...links].join('\n    '),
      )
  }
  return page
}

/** Langue et langues d'une page générée, lues sur `<html>` ; page d'un site monolingue : sa seule langue. */
export const pageLocales = (html) => {
  const [, locale, list] = html.match(/<html lang="([a-z]{2})"(?:[^>]*\sdata-locales="([^"]*)")?/)
  return { locale, locales: list ? list.split(' ') : [locale] }
}

/** Racine des pages d'une langue : le site pour la langue par défaut, `<site>/<langue>` sinon. */
export const localeRoot = (siteDir, locale, locales) =>
  locale === locales[0] ? siteDir : join(siteDir, locale)

/** Libellés `data-label-*` de la première balise qui porte `marker`, sous la forme de son `dataset`. */
export const labelsOf = (html, marker) => {
  const tag = html.match(new RegExp(`<[a-z]+\\b[^>]*\\s${marker}[\\s>=][^>]*>`))?.[0] ?? ''
  return Object.fromEntries(
    [...tag.matchAll(/\sdata-(label-[\w-]+)="([^"]*)"/g)].map(([, name, value]) => [
      name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
      decodeEntities(value),
    ]),
  )
}

const pagePath = (relativeFile) =>
  `/${relativeFile.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '')}`.replace(
    /(.)\/$/,
    '$1',
  )

/**
 * Chemins, slugs et noms des catégories dans une langue, depuis l'arbre de l'API dans la langue par
 * défaut et dans la langue (chaque nœud donne ses slugs par langue dans `alternates`).
 */
export const categoryTranslations = (sourceTree, targetTree, defaultLocale) => {
  const names = new Map()
  const indexNames = (nodes) =>
    nodes.forEach((node) => {
      names.set(node.slug, node.name)
      indexNames(node.children ?? [])
    })
  indexNames(sourceTree)
  const paths = new Map()
  const slugs = new Map()
  const labels = new Map()
  const walk = (nodes, sourceParent, targetParent) =>
    nodes.forEach((node) => {
      const source =
        node.alternates?.find((item) => item.locale === defaultLocale)?.slug ?? node.slug
      const sourcePath = `${sourceParent}/${source}`
      const targetPath = `${targetParent}/${node.slug}`
      paths.set(sourcePath, targetPath)
      slugs.set(source, node.slug)
      if (names.has(source)) labels.set(names.get(source), node.name)
      walk(node.children ?? [], sourcePath, targetPath)
    })
  walk(targetTree, '/catalogue', '/catalogue')
  return { paths, slugs, labels }
}

/**
 * Une page source dans la langue : textes et données structurées traduits, liens localisés. La
 * description d'une page de catégorie, propre à chaque catégorie, vient du gabarit `catalog.categoryDescription`.
 */
export const translatePage = (html, { table, dictionary, categories, ...context }) => {
  const pageTable = new Map([...table, ...categories.labels])
  const category = html.match(/data-catalog\s+data-category="([a-z0-9-]+)"/)?.[1]
  const name = category && html.match(/<h1 id="catalog-title"[^>]*>([^<]*)</)?.[1]
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1]
  if (name && description && dictionary?.['catalog.categoryDescription']) {
    const translatedName = pageTable.get(normalize(name)) ?? normalize(name)
    pageTable.set(
      normalize(description),
      dictionary['catalog.categoryDescription'].replace(
        '{name}',
        translatedName.toLocaleLowerCase(context.locale),
      ),
    )
  }
  const missing = new Set()
  const translated = translateHtml(html, pageTable, missing)
  const linkContext = { ...context, paths: categories.paths, slugs: categories.slugs }
  return {
    html: localizeJsonLd(localizeLinks(translated, linkContext), pageTable, linkContext),
    missing,
  }
}

const sourceFiles = (siteDir) =>
  sitePages(siteDir)
    .map((file) => relative(siteDir, file))
    .filter((file) => ![...UNTRANSLATED_PAGES, ...DEV_PAGES].includes(file))

const fetchCategories = async (apiUrl, locale) => {
  try {
    return await fetchJson(apiUrl, '/api/categories', { locale })
  } catch (error) {
    console.warn(
      `[langues] catégories en ${locale} illisibles, chemins français gardés (${error.message})`,
    )
    return []
  }
}

const generate = async ([siteDir, apiUrl]) => {
  let locales
  try {
    const identity = await fetchJson(apiUrl, '/api/site-identity')
    locales = Array.isArray(identity.locales) && identity.locales.length ? identity.locales : ['fr']
  } catch (error) {
    console.warn(`[langues] une seule langue, API injoignable (${error.message})`)
    return
  }
  if (locales.length < 2) {
    console.info('[langues] une seule langue : pages inchangées')
    return
  }
  const [defaultLocale] = locales
  const source = readDictionary(defaultLocale)
  const sourceTree = await fetchCategories(apiUrl, defaultLocale)
  const files = sourceFiles(siteDir)
  const originals = new Map(files.map((file) => [file, readFileSync(join(siteDir, file), 'utf8')]))
  const partials = new Map(
    PARTIALS.map((name) => [name, readFileSync(join(siteDir, 'partials', name), 'utf8')]),
  )
  const translations = new Map([
    [defaultLocale, { paths: new Map(), slugs: new Map(), labels: new Map() }],
  ])
  for (const locale of locales.slice(1)) {
    translations.set(
      locale,
      categoryTranslations(sourceTree, await fetchCategories(apiUrl, locale), defaultLocale),
    )
  }
  const localPath = (file, locale) => {
    const path = pagePath(file)
    return translations.get(locale).paths.get(path) ?? path
  }
  const pathsOf = (file) =>
    Object.fromEntries(
      locales.map((locale) => [locale, prefixPath(localPath(file, locale), locale, locales)]),
    )

  for (const locale of locales) {
    const dictionary = readDictionary(locale) ?? source
    const table = translationTable(source, dictionary)
    const root = localeRoot(siteDir, locale, locales)
    const context = {
      locale,
      locales,
      siteUrl: SITE_URL,
      table,
      dictionary,
      categories: translations.get(locale),
    }
    const missing = new Set()
    const render = (html) => {
      if (locale === defaultLocale) return html
      const page = translatePage(html, context)
      page.missing.forEach((text) => missing.add(text))
      return page.html
    }
    for (const [file, html] of originals) {
      const template = TEMPLATES.includes(file)
      const path = localPath(file, locale)
      const target = join(root, template || path === '/' ? file : `${path.slice(1)}/index.html`)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(
        target,
        withAlternates(render(html), { locale, locales, paths: template ? {} : pathsOf(file) }),
      )
    }
    mkdirSync(join(root, 'partials'), { recursive: true })
    for (const [name, html] of partials) {
      let partial = render(html)
      if (name === 'header.html') {
        partial = partial.replace(
          /(<header\b[^>]*>)/,
          (header) =>
            `${header}\n  ${languageSwitcher(locale, locales, dictionary['layout.languages'])}`,
        )
      }
      writeFileSync(join(root, 'partials', name), partial)
    }
    for (const text of missing) console.warn(`[langues] ${locale} : sans traduction, « ${text} »`)
    console.info(
      `[langues] ${locale} : ${originals.size} pages écrites sous ${relative(siteDir, root) || '/'}`,
    )
  }
}

const sitemapEntry = (loc, alternates) =>
  `  <url><loc>${loc}</loc>${alternates
    .map(([code, href]) => `<xhtml:link rel="alternate" hreflang="${code}" href="${href}"/>`)
    .join('')}</url>\n`

/**
 * Sitemap d'un site à plusieurs langues : chaque adresse devient une entrée par langue, chacune avec les
 * `xhtml:link` des équivalents lus dans les `hreflang` de la page. Site d'une seule langue : inchangé.
 */
export const localizedSitemap = (xml, alternatesOf) => {
  const entries = [...xml.matchAll(/ {2}<url><loc>([^<]+)<\/loc><\/url>\n/g)]
  if (!entries.length) return xml
  let body = ''
  for (const [, loc] of entries) {
    const alternates = alternatesOf(loc)
    const urls = alternates.filter(([code]) => code !== 'x-default').map(([, href]) => href)
    body += (urls.length ? urls : [loc]).map((url) => sitemapEntry(url, alternates)).join('')
  }
  return xml
    .replace(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    )
    .replace(/( {2}<url><loc>[^<]+<\/loc><\/url>\n)+/, body)
}

const sitemap = ([siteDir]) => {
  const home = readFileSync(join(siteDir, 'index.html'), 'utf8')
  if (pageLocales(home).locales.length < 2) return
  const origin = SITE_URL.replace(/\/$/, '')
  const file = join(siteDir, 'sitemap.xml')
  const alternatesOf = (loc) => {
    const path = loc.slice(origin.length).replace(/^\//, '')
    const page = join(siteDir, path, 'index.html')
    if (!existsSync(page)) return []
    return [
      ...readFileSync(page, 'utf8').matchAll(
        /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g,
      ),
    ].map(([, code, href]) => [code, href])
  }
  writeFileSync(file, localizedSitemap(readFileSync(file, 'utf8'), alternatesOf))
  console.info('[langues] sitemap avec les équivalents de chaque adresse')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2)
  await (
    { pages: generate, sitemap }[command] ??
    (() => {
      throw new Error(`Commande inconnue : ${command}`)
    })
  )(args)
}
