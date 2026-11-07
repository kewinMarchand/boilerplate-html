import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { largestWebp, withPicture } from './prerenderPicture.js'

/**
 * Pré-rendu du contenu administré dans l'API, à la construction de l'image, sur le modèle du
 * catalogue (ADR 0002) : diapositives de l'accueil, texte des pages légales et fiches des articles
 * (une page par article, à partir du gabarit blog/fiche.html, ajoutée au sitemap), écrits à partir des
 * `<template>` des pages, les mêmes que ceux du navigateur, qui relit l'API au chargement. Sans API
 * joignable, la page reste telle quelle et se remplit dans le navigateur.
 *
 * Usage : node --import ./tests/unit/siteResolver.js scripts/prerender-content.js <site> <API_URL>
 */

const API_TIMEOUT_MS = 10_000
const LEGAL_PAGES = ['mentions-legales', 'donnees-personnelles', 'accessibilite']

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const templateOf = (html, id) =>
  html.match(new RegExp(`<template id="${id}">\\s*([\\s\\S]*?)\\s*</template>`))[1]

const withoutLoading = (html, state) =>
  html.replace(
    new RegExp(`(<div ${state}>)\\s*<div class="skeleton-list"[\\s\\S]*?</div>`),
    (_, open) => open,
  )

const withoutNoscript = (html, testId) =>
  html.replace(
    new RegExp(`\\s*<noscript>\\s*<div[^>]*data-testid="${testId}"[\\s\\S]*?</noscript>`),
    '',
  )

const slideItem = (template, slide, index, count) => {
  return withPicture(template, slide.image)
    .replace(
      'data-testid="carousel-slide"',
      `aria-label="${index + 1} sur ${count}" data-testid="carousel-slide"`,
    )
    .replace(/(data-slide-title>)[^<]*/, (_, open) => `${open}${escapeHtml(slide.title)}`)
    .replace(/(data-slide-text>)/, (_, open) => `${open}${escapeHtml(slide.text)}`)
}

/** HTML de l'accueil, diapositives écrites. Liste vide : page inchangée. */
export const prerenderCarousel = (html, slides) => {
  if (!slides.length) return html
  const template = templateOf(html, 'carousel-slide-template')
  const items = slides
    .map((slide, index) => slideItem(template, slide, index, slides.length))
    .join('')
  const page = html.replace(
    /(<div class="carousel-container" data-carousel-slides>)(<\/div>)/,
    (_, open, close) => `${open}${items}${close}`,
  )
  return withoutNoscript(withoutLoading(page, 'data-carousel-state'), 'home-carousel-noscript')
}

const legalSection = (template, section) =>
  template
    .replace(/(data-legal-section-title>)[^<]*/, (_, open) => `${open}${escapeHtml(section.title)}`)
    .replace(/<\/section>$/, () => `${section.html}</section>`)

/** HTML d'une page légale, titre et sections écrits. Le HTML de l'API est injecté tel quel. */
export const prerenderLegalPage = (html, legalPage) => {
  const template = templateOf(html, 'legal-section-template')
  const content =
    legalPage.introduction +
    legalPage.sections.map((section) => legalSection(template, section)).join('')
  const page = html
    .replace(/(<h1 data-legal-title>)[^<]*/, (_, open) => `${open}${escapeHtml(legalPage.title)}`)
    .replace(/(<div data-legal-content>)(<\/div>)/, (_, open, close) => `${open}${content}${close}`)
  return withoutNoscript(withoutLoading(page, 'data-legal-state'), 'legal-noscript')
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })

const jsonLdScript = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`

const setMeta = (html, attribute, name, value) =>
  html.replace(
    new RegExp(`(<meta\\s+${attribute}="${name}"\\s+content=")[^"]*(")`),
    (_, open, close) => `${open}${escapeHtml(value)}${close}`,
  )

/**
 * Fiche d'un article à partir du gabarit : en-tête (titre, description, canonique, partage, données
 * structurées, indexation) et contenu. Le HTML de l'API est injecté tel quel.
 */
export const prerenderArticle = (html, article, siteUrl) => {
  const url = `${siteUrl.replace(/\/$/, '')}/blog/${article.slug}`
  const description = article.excerpt || article.title
  const image = article.image && largestWebp(article.image)
  let page = html
    .replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapeHtml(article.title)} · Boilerplate HTML</title>`,
    )
    .replace(
      '<meta name="robots" content="noindex" />',
      '<meta name="robots" content="index, follow" />',
    )
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_, open, close) => `${open}${url}${close}`)
    .replace(
      '<meta property="og:type" content="website" />',
      `<meta property="og:type" content="article" />\n    <meta property="article:published_time" content="${article.publishedAt}" />`,
    )
  page = setMeta(page, 'name', 'description', description)
  page = setMeta(page, 'property', 'og:description', description)
  page = setMeta(page, 'name', 'twitter:description', description)
  page = setMeta(page, 'property', 'og:title', `${article.title} · Boilerplate HTML`)
  page = setMeta(page, 'name', 'twitter:title', `${article.title} · Boilerplate HTML`)
  page = setMeta(page, 'property', 'og:url', url)
  if (image) {
    page = setMeta(page, 'property', 'og:image', image)
    page = setMeta(page, 'name', 'twitter:image', image)
    page = setMeta(page, 'property', 'og:image:width', String(article.image.width))
    page = setMeta(page, 'property', 'og:image:height', String(article.image.height))
    page = setMeta(page, 'property', 'og:image:alt', article.image.alt || article.title)
  }
  const structuredData = [
    jsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: article.title,
      description: article.excerpt,
      datePublished: article.publishedAt,
      url,
      ...(image && { image }),
      inLanguage: 'fr-FR',
    }),
    jsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Accueil',
          item: `${siteUrl.replace(/\/$/, '')}/`,
        },
        { '@type': 'ListItem', position: 2, name: article.title, item: url },
      ],
    }),
  ].join('\n    ')
  page = page.replace('</head>', `    ${structuredData}\n  </head>`)

  const title = escapeHtml(article.title)
  page = page
    .replace(/(data-article-crumb>)[^<]*/, (_, open) => `${open}${title}`)
    .replace(/(data-testid="article-title">)[^<]*/, (_, open) => `${open}${title}`)
    .replace(
      /<time data-article-date datetime="[^"]*">[^<]*/,
      `<time data-article-date datetime="${article.publishedAt}">${DATE_FORMAT.format(new Date(`${article.publishedAt}T00:00:00Z`))}`,
    )
    .replace(/<picture class="article-media">[\s\S]*?<\/picture>/, (picture) =>
      withPicture(picture, article.image),
    )
    .replace(/(<p class="article-excerpt" data-article-excerpt)>/, (_, open) =>
      article.excerpt ? `${open}>${escapeHtml(article.excerpt)}` : `${open} hidden>`,
    )
    .replace(
      /(<div data-article-body data-testid="article-body">)(<\/div>)/,
      (_, open, close) => `${open}${article.html}${close}`,
    )
    .replace('<div data-article-content hidden>', '<div data-article-content>')
  return withoutNoscript(withoutLoading(page, 'data-article-state'), 'article-noscript')
}

/** Sitemap avec les fiches, avant la fermeture de la liste. */
export const withArticlesInSitemap = (xml, slugs, siteUrl) =>
  xml.replace(
    '</urlset>',
    `${slugs.map((slug) => `  <url><loc>${siteUrl.replace(/\/$/, '')}/blog/${slug}</loc></url>\n`).join('')}</urlset>`,
  )

const fetchJson = async (apiUrl, path) => {
  const response = await fetch(new URL(path, apiUrl), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`réponse ${response.status}`)
  return response.json()
}

const prerender = async (file, route, load, render) => {
  let data
  try {
    data = await load()
  } catch (error) {
    console.warn(`[contenu] ${route} rendue dans le navigateur, API injoignable (${error.message})`)
    return
  }
  writeFileSync(file, render(readFileSync(file, 'utf8'), data))
  console.info(`[contenu] ${route} pré-rendue`)
}

const main = async ([siteDir, apiUrl]) => {
  // Imports dynamiques : les traductions importent le socle par son chemin servi, que seul le
  // crochet siteResolver.js résout, et tests/e2e/accueil.e2e.js importe ce fichier sans lui.
  const { toSlides } = await import('/js/modules/content/infrastructure/http/slideTranslation.js')
  const { toLegalPage } =
    await import('/js/modules/content/infrastructure/http/legalPageTranslation.js')
  await prerender(
    join(siteDir, 'index.html'),
    '/',
    async () => toSlides(await fetchJson(apiUrl, '/api/slides')),
    prerenderCarousel,
  )
  for (const slug of LEGAL_PAGES) {
    await prerender(
      join(siteDir, slug, 'index.html'),
      `/${slug}`,
      async () => toLegalPage(await fetchJson(apiUrl, `/api/legal_pages/${slug}`)),
      prerenderLegalPage,
    )
  }
  await prerenderArticles(siteDir, apiUrl)
}

/** Une page par article connu de l'API ; sans API, les fiches sont rendues dans le navigateur. */
const prerenderArticles = async (siteDir, apiUrl) => {
  const { toArticleDetail, toArticles } =
    await import('/js/modules/blog/infrastructure/http/articleTranslation.js')
  const { url: siteUrl } = JSON.parse(readFileSync(join(siteDir, '..', 'site.config.json'), 'utf8'))
  let articles
  try {
    articles = toArticles(await fetchJson(apiUrl, '/api/articles'))
  } catch (error) {
    console.warn(`[contenu] fiches rendues dans le navigateur, API injoignable (${error.message})`)
    return
  }
  const template = readFileSync(join(siteDir, 'blog', 'fiche.html'), 'utf8')
  const written = []
  for (const { slug } of articles) {
    try {
      const article = toArticleDetail(
        await fetchJson(apiUrl, `/api/articles/${encodeURIComponent(slug)}`),
      )
      mkdirSync(join(siteDir, 'blog', slug), { recursive: true })
      writeFileSync(
        join(siteDir, 'blog', slug, 'index.html'),
        prerenderArticle(template, article, siteUrl),
      )
      written.push(slug)
      console.info(`[contenu] /blog/${slug} pré-rendue`)
    } catch (error) {
      console.warn(`[contenu] /blog/${slug} rendue dans le navigateur (${error.message})`)
    }
  }
  const sitemap = join(siteDir, 'sitemap.xml')
  writeFileSync(sitemap, withArticlesInSitemap(readFileSync(sitemap, 'utf8'), written, siteUrl))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
