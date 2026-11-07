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

const PRICE_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const formatPrice = (cents) => PRICE_FORMAT.format(cents / 100)

const slideItem = (template, product, index, count) => {
  return withPicture(template, product.image)
    .replace(
      'data-testid="carousel-slide"',
      `aria-label="${index + 1} sur ${count}" data-testid="carousel-slide"`,
    )
    .replace(/href="\/catalogue"/, `href="/produit/${escapeHtml(product.slug)}"`)
    .replace(/(data-slide-title\s*>)[^<]*/, (_, open) => `${open}${escapeHtml(product.name)}`)
    .replace(/(data-slide-text>)/, (_, open) => `${open}${escapeHtml(formatPrice(product.price))}`)
}

/** HTML de l'accueil, une diapositive par produit à la une, liée à sa fiche. Liste vide : page inchangée. */
export const prerenderCarousel = (html, products) => {
  if (!products.length) return html
  const template = templateOf(html, 'carousel-slide-template')
  const items = products
    .map((product, index) => slideItem(template, product, index, products.length))
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
  withPagesInSitemap(xml, 'blog', slugs, siteUrl)

/** Sitemap avec les pages `/<route>/<slug>`, avant la fermeture de la liste. */
export const withPagesInSitemap = (xml, route, slugs, siteUrl) =>
  xml.replace(
    '</urlset>',
    `${slugs.map((slug) => `  <url><loc>${siteUrl.replace(/\/$/, '')}/${route}/${slug}</loc></url>\n`).join('')}</urlset>`,
  )

/**
 * Fiche produit de l'API avec l'adresse de chaque étape de `categoryPath`, comme `toProductDetail` du
 * navigateur : le serveur de développement, sans le résolveur des chemins servis, ne peut pas l'importer.
 */
export const withCategoryHrefs = (dto) => ({
  ...dto,
  categoryPath: dto.categoryPath.map((step, index, steps) => ({
    ...step,
    href: `/catalogue/${steps
      .slice(0, index + 1)
      .map(({ slug }) => slug)
      .join('/')}`,
  })),
})

const EXPOSURE_LABELS = { soleil: 'Soleil', 'mi-ombre': 'Mi-ombre', ombre: 'Ombre' }

/** Description de la fiche produit, la même que dans le navigateur (`ui/productPage.js`). */
const productDescription = (product) =>
  `${product.name} : exposition ${EXPOSURE_LABELS[product.exposure].toLowerCase()}, taille ${product.size}, ${formatPrice(product.price)}. ${product.inStock ? 'En stock' : 'En rupture de stock'}, rayon ${product.categoryPath.at(-1)?.name ?? 'catalogue'}.`

/**
 * Fiche d'un produit à partir du gabarit produit/fiche.html : en-tête (titre, description, canonique,
 * partage, données structurées `Product` et `BreadcrumbList`, indexation), fil d'Ariane et contenu.
 */
export const prerenderProduct = (html, product, siteUrl) => {
  const origin = siteUrl.replace(/\/$/, '')
  const url = `${origin}/produit/${product.slug}`
  const description = productDescription(product)
  const image = product.image && largestWebp(product.image)
  const category = product.categoryPath.at(-1)
  let page = html
    .replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapeHtml(product.name)} · Boilerplate HTML</title>`,
    )
    .replace(
      '<meta name="robots" content="noindex" />',
      '<meta name="robots" content="index, follow" />',
    )
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_, open, close) => `${open}${url}${close}`)
  page = setMeta(page, 'name', 'description', description)
  page = setMeta(page, 'property', 'og:description', description)
  page = setMeta(page, 'name', 'twitter:description', description)
  page = setMeta(page, 'property', 'og:title', `${product.name} · Boilerplate HTML`)
  page = setMeta(page, 'name', 'twitter:title', `${product.name} · Boilerplate HTML`)
  page = setMeta(page, 'property', 'og:url', url)
  if (image) {
    page = setMeta(page, 'property', 'og:image', image)
    page = setMeta(page, 'name', 'twitter:image', image)
    page = setMeta(page, 'property', 'og:image:width', String(product.image.width))
    page = setMeta(page, 'property', 'og:image:height', String(product.image.height))
    page = setMeta(page, 'property', 'og:image:alt', product.image.alt || product.name)
  }
  const structuredData = [
    jsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.slug,
      url,
      ...(category && { category: category.name }),
      ...(image && { image }),
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'EUR',
        price: (product.price / 100).toFixed(2),
        availability: `https://schema.org/${product.inStock ? 'InStock' : 'OutOfStock'}`,
      },
    }),
    jsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: 'Accueil', item: `${origin}/` },
        { name: 'Catalogue', item: `${origin}/catalogue` },
        ...product.categoryPath.map((step) => ({ name: step.name, item: `${origin}${step.href}` })),
        { name: product.name, item: url },
      ].map((entry, index) => ({ '@type': 'ListItem', position: index + 1, ...entry })),
    }),
  ].join('\n    ')
  page = page.replace('</head>', `    ${structuredData}\n  </head>`)

  const name = escapeHtml(product.name)
  const crumbs = product.categoryPath
    .map(
      (step) =>
        `<li class="bui-breadcrumb__item"><a class="bui-link" href="${escapeHtml(step.href)}">${escapeHtml(step.name)}</a></li>\n            `,
    )
    .join('')
  page = page
    .replace(
      /(<li class="bui-breadcrumb__item">\s*<span class="bui-breadcrumb__current")/,
      (_, open) => `${crumbs}${open}`,
    )
    .replace(/(data-product-crumb\s*>)[^<]*/, (_, open) => `${open}${name}`)
    .replace(/(data-testid="product-title">)[^<]*/, (_, open) => `${open}${name}`)
    .replace(/<picture class="product-page-media">[\s\S]*?<\/picture>/, (picture) =>
      withPicture(picture, product.image),
    )
    .replace(
      /(data-product-price data-testid="product-price">)/,
      (_, open) => `${open}${escapeHtml(formatPrice(product.price))}`,
    )
    .replace(
      /(<dd data-product-exposure>)/,
      (_, open) => `${open}${EXPOSURE_LABELS[product.exposure]}`,
    )
    .replace(/(<dd data-product-size>)/, (_, open) => `${open}${product.size}`)
    .replace(/(<dd data-product-stock>)En stock/, (_, open) =>
      product.inStock
        ? `${open}En stock`
        : `${open}<span class="bui-badge bui-badge--error">Rupture de stock</span>`,
    )
    .replace(
      /<a class="bui-link" href="\/catalogue" data-product-category\s*>[^<]*/,
      category
        ? `<a class="bui-link" href="${escapeHtml(category.href)}" data-product-category>Voir les autres produits : ${escapeHtml(category.name)}`
        : (match) => match,
    )
    .replace(
      '<div class="product-page-layout" data-product-content hidden>',
      '<div class="product-page-layout" data-product-content>',
    )
  return withoutNoscript(withoutLoading(page, 'data-product-state'), 'product-noscript')
}

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
  const { toProducts } =
    await import('/js/modules/catalog/infrastructure/http/catalogTranslation.js')
  const { toLegalPage } =
    await import('/js/modules/content/infrastructure/http/legalPageTranslation.js')
  await prerender(
    join(siteDir, 'index.html'),
    '/',
    async () => toProducts(await fetchJson(apiUrl, '/api/featured-products')),
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
  await prerenderProducts(siteDir, apiUrl)
}

/** Une page par produit connu de l'API ; sans API, les fiches sont rendues dans le navigateur. */
const prerenderProducts = async (siteDir, apiUrl) => {
  const { toProductDetail } =
    await import('/js/modules/catalog/infrastructure/http/catalogTranslation.js')
  const { url: siteUrl } = JSON.parse(readFileSync(join(siteDir, '..', 'site.config.json'), 'utf8'))
  const slugs = []
  try {
    for (let page = 1; ; page += 1) {
      const list = await fetchJson(apiUrl, `/api/products?page=${page}&itemsPerPage=48`)
      slugs.push(...list.items.map((item) => item.slug))
      if (page >= list.totalPages) break
    }
  } catch (error) {
    console.warn(
      `[contenu] fiches produit rendues dans le navigateur, API injoignable (${error.message})`,
    )
    return
  }
  const template = readFileSync(join(siteDir, 'produit', 'fiche.html'), 'utf8')
  const written = []
  for (const slug of slugs) {
    try {
      const product = toProductDetail(
        await fetchJson(apiUrl, `/api/products/${encodeURIComponent(slug)}`),
      )
      mkdirSync(join(siteDir, 'produit', slug), { recursive: true })
      writeFileSync(
        join(siteDir, 'produit', slug, 'index.html'),
        prerenderProduct(template, product, siteUrl),
      )
      written.push(slug)
    } catch (error) {
      console.warn(`[contenu] /produit/${slug} rendue dans le navigateur (${error.message})`)
    }
  }
  console.info(`[contenu] ${written.length} fiches produit pré-rendues`)
  const sitemap = join(siteDir, 'sitemap.xml')
  writeFileSync(
    sitemap,
    withPagesInSitemap(readFileSync(sitemap, 'utf8'), 'produit', written, siteUrl),
  )
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
