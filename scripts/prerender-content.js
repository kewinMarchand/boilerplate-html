import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { audioCaption, blogHref } from '../site/js/modules/blog/domain/article.js'
import { formatLabel } from '../site/js/shared/labels.js'
import { languageTag, prefixPath } from '../site/js/shared/locale.js'
import { fetchJson } from './apiFetch.js'
import { labelsOf, localeRoot, pageLocales, withAlternates } from './prerender-locales.js'
import { largestWebp, withPicture } from './prerenderPicture.js'

/**
 * Pré-rendu du contenu administré dans l'API, à la construction de l'image, sur le modèle du
 * catalogue (ADR 0002) : diapositives de l'accueil, texte des pages légales, liste des articles
 * (/blog) et fiches des articles (une page par article, à partir du gabarit blog/fiche.html, ajoutée
 * au sitemap), écrits à partir des `<template>` des pages, les mêmes que ceux du navigateur, qui
 * relit l'API au chargement. Sans API joignable, la page reste telle quelle et se remplit dans le
 * navigateur. Sur un site à plusieurs langues, chaque langue est pré-rendue sous sa racine, lue dans
 * l'API dans sa langue, avec les libellés de ses pages (`data-label-*`) et les équivalents de chaque fiche.
 *
 * Usage : node --import ./tests/unit/siteResolver.js scripts/prerender-content.js <site> <API_URL>
 */

const PRODUCTS_PER_PAGE = 48
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

const formatPrice = (cents, locale) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)

/** Adresse d'une page dans la langue de la page `html`. */
const pageHref = (path, html) => {
  const { locale, locales } = pageLocales(html)
  return prefixPath(path, locale, locales)
}

const formatDate = (isoDate, locale) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  )

const slideItem = (template, product, index, count, { label, locale, href }) => {
  return withPicture(template, product.image)
    .replace(
      'data-testid="carousel-slide"',
      `aria-label="${escapeHtml(formatLabel(label, { number: index + 1, count }))}" data-testid="carousel-slide"`,
    )
    .replace(/href="\/catalogue"/, () => `href="${href(`/produit/${escapeHtml(product.slug)}`)}"`)
    .replace(/(data-slide-title\s*>)[^<]*/, (_, open) => `${open}${escapeHtml(product.name)}`)
    .replace(
      /(data-slide-text>)/,
      (_, open) => `${open}${escapeHtml(formatPrice(product.price, locale))}`,
    )
}

/** HTML de l'accueil, une diapositive par produit à la une, liée à sa fiche. Liste vide : page inchangée. */
export const prerenderCarousel = (html, products) => {
  if (!products.length) return html
  const template = templateOf(html, 'carousel-slide-template')
  const context = {
    label: labelsOf(html, 'data-carousel').labelSlide,
    locale: pageLocales(html).locale,
    href: (path) => pageHref(path, html),
  }
  const items = products
    .map((product, index) => slideItem(template, product, index, products.length, context))
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

const jsonLdScript = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`

export const setMeta = (html, attribute, name, value) =>
  html.replace(
    new RegExp(`(<meta\\s+${attribute}="${name}"\\s+content=")[^"]*(")`),
    (_, open, close) => `${open}${escapeHtml(value)}${close}`,
  )

/** Rubrique et format sous le titre de la fiche, chacun retiré s'il manque, le bloc sans aucun des deux. */
const withTaxonomy = (taxonomy, article) => {
  if (!article.section && !article.format) return ''
  return ['section', 'format'].reduce(
    (html, name) =>
      html.replace(
        new RegExp(
          `\\s*<span class="bui-badge" data-article-${name}[\\s\\S]*?</span\\s*>\\s*</span>`,
        ),
        (badge) =>
          article[name]
            ? badge.replace(
                new RegExp(`(data-article-${name}-name>)`),
                (_, open) => `${open}${escapeHtml(article[name].name)}`,
              )
            : '',
      ),
    taxonomy,
  )
}

const withAudio = (figure, article, label) =>
  figure
    .replace(
      /(data-article-audio-caption>)/,
      (_, open) => `${open}${escapeHtml(audioCaption(article.audio, article.speaker, label))}`,
    )
    .replace(/<audio(\s)/, (_, space) => `<audio src="${escapeHtml(article.audio.src)}"${space}`)

/**
 * Fiche d'un article à partir du gabarit : en-tête (titre, description, canonique, partage, données
 * structurées, indexation) et contenu. Le HTML de l'API est injecté tel quel.
 */
export const prerenderArticle = (html, article, siteUrl) => {
  const { locale, locales } = pageLocales(html)
  const labels = labelsOf(html, 'data-article-page')
  const origin = siteUrl.replace(/\/$/, '')
  const url = `${origin}${pageHref(`/blog/${article.slug}`, html)}`
  const description = article.metaDescription || article.excerpt || article.title
  const title = article.metaTitle || `${article.title} · Boilerplate HTML`
  const image = article.image && largestWebp(article.image)
  let page = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
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
  page = setMeta(page, 'property', 'og:title', title)
  page = setMeta(page, 'name', 'twitter:title', title)
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
      inLanguage: languageTag(locale),
    }),
    jsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: labels.labelHome,
          item: `${origin}${pageHref('/', html)}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: labels.labelBlog,
          item: `${origin}${pageHref('/blog', html)}`,
        },
        { '@type': 'ListItem', position: 3, name: article.title, item: url },
      ],
    }),
  ].join('\n    ')
  page = page.replace('</head>', `    ${structuredData}\n  </head>`)

  const heading = escapeHtml(article.title)
  page = page
    .replace(/(data-article-crumb>)[^<]*/, (_, open) => `${open}${heading}`)
    .replace(/(data-testid="article-title">)[^<]*/, (_, open) => `${open}${heading}`)
    .replace(/\s*<p class="article-taxonomy"[\s\S]*?<\/p>/, (taxonomy) =>
      withTaxonomy(taxonomy, article),
    )
    .replace(/\s*<figure class="article-audio"[\s\S]*?<\/figure>/, (figure) =>
      article.audio ? withAudio(figure, article, labels.labelAudio) : '',
    )
    .replace(
      /<time data-article-date datetime="[^"]*">[^<]*/,
      `<time data-article-date datetime="${article.publishedAt}">${formatDate(article.publishedAt, locale)}`,
    )
    .replace(/<picture class="article-media bui-picture">[\s\S]*?<\/picture>/, (picture) =>
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
  page = withoutNoscript(withoutLoading(page, 'data-article-state'), 'article-noscript')
  return withDetailAlternates(page, article.alternates, '/blog', { locale, locales })
}

/** Équivalents d'une fiche dans les autres langues (`alternates` de l'API), sur un site à plusieurs langues. */
const withDetailAlternates = (html, alternates = [], route, { locale, locales }) => {
  if (locales.length < 2) return html
  const paths = Object.fromEntries(
    alternates
      .filter((alternate) => locales.includes(alternate.locale))
      .map((alternate) => [
        alternate.locale,
        prefixPath(`${route}/${alternate.slug}`, alternate.locale, locales),
      ]),
  )
  return withAlternates(html, { locale, locales, paths })
}

const blogCard = (template, article, html) =>
  withPicture(template, article.image)
    .replace(/(\s*<p class="blog-card-section"[^>]*>)(<\/p>)/, (_, open, close) =>
      article.section ? `${open}${escapeHtml(article.section.name)}${close}` : '',
    )
    .replace(/href="\/"/, () => `href="${pageHref(`/blog/${escapeHtml(article.slug)}`, html)}"`)
    .replace(/(data-blog-title>)[^<]*/, (_, open) => `${open}${escapeHtml(article.title)}`)
    .replace(/(data-blog-excerpt>)/, (_, open) => `${open}${escapeHtml(article.excerpt)}`)
    .replace(
      /<time data-blog-date>/,
      `<time data-blog-date datetime="${escapeHtml(article.publishedAt)}">${formatDate(article.publishedAt, pageLocales(html).locale)}`,
    )

const sectionLink = (section, html) =>
  `<li><a class="bui-link" href="${escapeHtml(pageHref(blogHref(section.slug), html))}">${escapeHtml(section.name)}</a></li>`

/** Filtre par rubrique de /blog, « Toutes » active ; retiré sans rubrique. */
const withSections = (html, sections) =>
  html.replace(/\s*<nav\s+class="blog-sections"[\s\S]*?<\/nav>/, (nav) =>
    sections.length
      ? nav
          .replace(/\s*hidden\s*>/, '>')
          .replace(
            /(<\/li>)(\s*<\/ul>)/,
            (_, item, end) =>
              `${item}${sections.map((section) => sectionLink(section, html)).join('')}${end}`,
          )
      : '',
  )

/** HTML de /blog, filtre par rubrique et une carte par article, liée à sa fiche. Liste vide : page inchangée. */
export const prerenderBlogList = (html, articles, sections = []) => {
  if (!articles.length) return html
  const template = templateOf(html, 'blog-card-template')
  const cards = articles.map((article) => blogCard(template, article, html)).join('')
  const page = withSections(html, sections).replace(
    /(<div class="blog-list" data-blog-list data-testid="blog-list">)(<\/div>)/,
    (_, open, close) => `${open}${cards}${close}`,
  )
  return withoutNoscript(withoutLoading(page, 'data-blog-state'), 'blog-noscript')
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
 * Fiche produit de l'API avec l'adresse de chaque étape de `categoryPath` et les paragraphes de sa
 * description, comme `toProductDetail` du navigateur : le serveur de développement, sans le résolveur
 * des chemins servis, ne peut pas l'importer.
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
  description: dto.description
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== ''),
  attributes: dto.attributes ?? [],
  gallery: dto.gallery ?? [],
})

const attributeValue = ({ valueLabel, unit }) => (unit ? `${valueLabel}\u00a0${unit}` : valueLabel)

const attributesList = (attributes) =>
  attributes
    .map(
      (attribute) =>
        `<dt>${escapeHtml(attribute.label)}</dt><dd>${escapeHtml(attributeValue(attribute))}</dd>`,
    )
    .join('')

/** Vignettes de la galerie, en liens vers l'image en grand sans JavaScript ; `productGallery.js` en fait des boutons. */
const galleryLinks = (template, images, label) =>
  images
    .map((image, index) =>
      template
        .replace(
          /<button type="button"/,
          () =>
            `<a href="${escapeHtml(largestWebp(image))}"${index === 0 ? ' aria-current="true"' : ''}`,
        )
        .replace('</button>', '</a>')
        .replace(/src="[^"]*"/, () => `src="${escapeHtml(image.src)}"`)
        .replace(
          /(data-product-gallery-thumb-label>)[^<]*/,
          (_, open) =>
            `${open}${escapeHtml(formatLabel(label, { number: index + 1, count: images.length }))}`,
        ),
    )
    .join('')

const EXPOSURE_LABELS = {
  soleil: 'labelExposureSun',
  'mi-ombre': 'labelExposurePartialShade',
  ombre: 'labelExposureShade',
}

/** Description de la fiche produit, la même que dans le navigateur (`ui/productPage.js`). */
const productDescription = (product, labels, locale) =>
  formatLabel(labels.labelDescription, {
    name: product.name,
    exposure: labels[EXPOSURE_LABELS[product.exposure]].toLocaleLowerCase(locale),
    size: product.size,
    price: `, ${formatPrice(product.price, locale)}`,
    stock: product.inStock ? labels.labelInStock : labels.labelOutOfStockSentence,
    category: product.categoryPath.at(-1)?.name ?? labels.labelCatalog,
  })

/**
 * Fiche d'un produit à partir du gabarit produit/fiche.html : en-tête (titre, description, canonique,
 * partage, données structurées `Product` et `BreadcrumbList`, indexation), fil d'Ariane et contenu.
 */
/**
 * `translations` : slug et nom du produit dans chaque langue du site (`{ locale, slug, name }`), lus par
 * l'ajout au panier ; aucun sur un site d'une seule langue ni sur une fiche pré-rendue à la demande.
 */
export const prerenderProduct = (html, product, siteUrl, translations = []) => {
  const { locale, locales } = pageLocales(html)
  const labels = labelsOf(html, 'data-product-page')
  const href = (path) => pageHref(path, html)
  const origin = siteUrl.replace(/\/$/, '')
  const url = `${origin}${href(`/produit/${product.slug}`)}`
  const description = product.metaDescription || productDescription(product, labels, locale)
  const title = product.metaTitle || `${product.name} · Boilerplate HTML`
  const image = product.image && largestWebp(product.image)
  const category = product.categoryPath.at(-1)
  let page = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      '<meta name="robots" content="noindex" />',
      '<meta name="robots" content="index, follow" />',
    )
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_, open, close) => `${open}${url}${close}`)
  page = setMeta(page, 'name', 'description', description)
  page = setMeta(page, 'property', 'og:description', description)
  page = setMeta(page, 'name', 'twitter:description', description)
  page = setMeta(page, 'property', 'og:title', title)
  page = setMeta(page, 'name', 'twitter:title', title)
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
      ...(product.description.length > 0 && { description: product.description.join(' ') }),
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
        { name: labels.labelHome, item: `${origin}${href('/')}` },
        { name: labels.labelCatalogTitle, item: `${origin}${href('/catalogue')}` },
        ...product.categoryPath.map((step) => ({
          name: step.name,
          item: `${origin}${href(step.href)}`,
        })),
        { name: product.name, item: url },
      ].map((entry, index) => ({ '@type': 'ListItem', position: index + 1, ...entry })),
    }),
  ].join('\n    ')
  page = page.replace('</head>', `    ${structuredData}\n  </head>`)

  const name = escapeHtml(product.name)
  const crumbs = product.categoryPath
    .map(
      (step) =>
        `<li class="bui-breadcrumb__item"><a class="bui-link" href="${escapeHtml(href(step.href))}">${escapeHtml(step.name)}</a></li>\n            `,
    )
    .join('')
  page = page
    .replace(
      /(<li class="bui-breadcrumb__item">\s*<span class="bui-breadcrumb__current")/,
      (_, open) => `${crumbs}${open}`,
    )
    .replace(/(data-product-crumb\s*>)[^<]*/, (_, open) => `${open}${name}`)
    .replace(/(data-testid="product-title">)[^<]*/, (_, open) => `${open}${name}`)
    .replace(/<picture class="product-page-media bui-picture">[\s\S]*?<\/picture>/, (picture) =>
      withPicture(picture, product.image),
    )
    .replace(
      /(<div class="product-gallery" data-product-gallery)(>[\s\S]*?)(\s*<ul[^>]*data-product-gallery-thumbs[^>]*>)(<\/ul>)/,
      (match, open, picture, list, close) =>
        product.gallery.length > 0 && product.image
          ? `${open} data-testid="product-gallery"${picture}${list}${galleryLinks(templateOf(html, 'product-gallery-thumb-template'), [product.image, ...product.gallery], labels.labelThumb)}${close}`
          : `${open}${picture}`,
    )
    .replace(
      /(data-product-price\s+data-testid="product-price"\s*>)/,
      (_, open) => `${open}${escapeHtml(formatPrice(product.price, locale))}`,
    )
    .replace(/(data-testid="product-description")\s*hidden\s*>/, (match, open) =>
      product.description.length > 0
        ? `${open}>${product.description.map((text) => `<p>${escapeHtml(text)}</p>`).join('')}`
        : match,
    )
    .replace(
      /(<dd data-product-exposure>)/,
      (_, open) => `${open}${escapeHtml(labels[EXPOSURE_LABELS[product.exposure]])}`,
    )
    .replace(/(<dd data-product-size>)/, (_, open) => `${open}${product.size}`)
    .replace(/(<dd data-product-stock>)[^<]*/, (_, open) =>
      product.inStock
        ? `${open}${escapeHtml(labels.labelInStock)}`
        : `${open}<span class="bui-badge bui-badge--error">${escapeHtml(labels.labelOutOfStock)}</span>`,
    )
    .replace(
      /<a class="bui-link" href="\/catalogue" data-product-category\s*>[^<]*/,
      category
        ? `<a class="bui-link" href="${escapeHtml(href(category.href))}" data-product-category>${escapeHtml(formatLabel(labels.labelCategoryLink, { name: category.name }))}`
        : (match) => match,
    )
    .replace(
      /\s*<dl\s+class="product-page-features"\s+data-product-attributes\s+data-testid="product-attributes"\s*><\/dl>/,
      (match) =>
        product.attributes.length > 0
          ? match.replace('></dl>', () => `>${attributesList(product.attributes)}</dl>`)
          : '',
    )
    .replace(
      /(href=")[^"]*("\s+data-product-inquiry)/,
      (_, open, rest) => `${open}${href(contactHref(product.slug))}${rest}`,
    )
    .replace(
      /(data-product-inquiry-name\s*>)/,
      (_, open) =>
        `${open}${escapeHtml(formatLabel(labels.labelInquiryName, { name: product.name }))}`,
    )
    .replace(/(\sdata-add-to-cart)(?=\s)/, (attribute) =>
      translations.length > 0
        ? `${attribute} data-product-translations="${escapeHtml(JSON.stringify(translations))}"`
        : attribute,
    )
    .replace(
      '<div class="product-page-layout" data-product-content hidden>',
      '<div class="product-page-layout" data-product-content>',
    )
  page = withoutNoscript(withoutLoading(page, 'data-product-state'), 'product-noscript')
  return withDetailAlternates(page, product.alternates, '/produit', { locale, locales })
}

/** Adresse de la demande de renseignement sur un produit (section 27 de la spec commune). */
const contactHref = (slug) => `/contact?produit=${encodeURIComponent(slug)}`

/**
 * Page contact d'une demande de renseignement (`/contact?produit=<slug>`, servie par nginx depuis
 * `contact/demande/<slug>.html`) : la ligne du produit au-dessus du formulaire, le champ caché
 * `product` envoyé avec le message, et la confirmation propre à la demande. La canonique reste /contact.
 */
export const prerenderContactProduct = (html, product) => {
  const labels = labelsOf(html, 'data-contact-form')
  return html
    .replace(
      /(\s*)(<div class="contact-layout">)/,
      (_, space, layout) =>
        `${space}<p class="contact-product" data-testid="contact-product">${escapeHtml(labels.labelInquirySubject)} <a class="bui-link" href="${pageHref(`/produit/${escapeHtml(product.slug)}`, html)}">${escapeHtml(product.name)}</a></p>${space}${layout}`,
    )
    .replace(
      /(<form[^>]*data-contact-form[^>]*>)/,
      (_, form) =>
        `${form}<input type="hidden" name="product" value="${escapeHtml(product.slug)}" />`,
    )
    .replace(
      /(<template id="contact-success-template">[\s\S]*?<div class="bui-alert__body"><p>)[^<]*/,
      (_, open) => `${open}${escapeHtml(labels.labelInquirySuccess)}`,
    )
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

const SITE_URL = JSON.parse(
  readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'),
).url

const main = async ([siteDir, apiUrl]) => {
  const { locales } = pageLocales(readFileSync(join(siteDir, 'index.html'), 'utf8'))
  const productTranslations = await listProductTranslations(apiUrl, locales)
  for (const locale of locales) {
    await prerenderLocale(localeRoot(siteDir, locale, locales), apiUrl, {
      // Site d'une seule langue : adresses de l'API inchangées, sans `locale`
      locale: locales.length > 1 ? locale : null,
      sitemap: locale === locales[0] && join(siteDir, 'sitemap.xml'),
      productTranslations,
    })
  }
}

/** Produits de l'API dans une langue (`null` : celle par défaut), page après page jusqu'à une page incomplète. */
const listProducts = async (apiUrl, locale) => {
  const products = []
  for (let page = 1; ; page += 1) {
    const list = await fetchJson(apiUrl, '/api/products', {
      page,
      itemsPerPage: PRODUCTS_PER_PAGE,
      locale,
    })
    products.push(...list)
    if (list.length < PRODUCTS_PER_PAGE) return products
  }
}

/**
 * Slug et nom de chaque produit dans chaque langue, par identifiant, pour le panier : une ligne ajoutée
 * dans une langue s'affiche dans celle de la page. Site d'une seule langue : aucun appel, aucune traduction.
 */
const listProductTranslations = async (apiUrl, locales) => {
  const byId = new Map()
  if (locales.length < 2) return byId
  try {
    for (const locale of locales) {
      for (const { id, slug, name } of await listProducts(apiUrl, locale)) {
        byId.set(id, [...(byId.get(id) ?? []), { locale, slug, name }])
      }
    }
  } catch (error) {
    console.warn(`[contenu] panier sans traductions, API injoignable (${error.message})`)
    byId.clear()
  }
  return byId
}

/**
 * Pages d'une langue, sous sa racine. Le sitemap ne liste que les adresses de la langue par défaut :
 * `prerender-locales.js sitemap` y ajoute ensuite leurs équivalents.
 */
const prerenderLocale = async (siteDir, apiUrl, options) => {
  // Imports dynamiques : les traductions importent le socle par son chemin servi, que seul le
  // crochet siteResolver.js résout, et tests/e2e/accueil.e2e.js importe ce fichier sans lui.
  const { toProducts } =
    await import('/js/modules/catalog/infrastructure/http/catalogTranslation.js')
  const { toLegalPage } =
    await import('/js/modules/content/infrastructure/http/legalPageTranslation.js')
  const { locale } = options
  await prerender(
    join(siteDir, 'index.html'),
    '/',
    async () => toProducts(await fetchJson(apiUrl, '/api/featured-products', { locale })),
    prerenderCarousel,
  )
  for (const slug of LEGAL_PAGES) {
    await prerender(
      join(siteDir, slug, 'index.html'),
      `/${slug}`,
      async () => toLegalPage(await fetchJson(apiUrl, `/api/legal_pages/${slug}`, { locale })),
      prerenderLegalPage,
    )
  }
  await prerenderArticles(siteDir, apiUrl, options)
  await prerenderProducts(siteDir, apiUrl, options)
}

/**
 * Une page par produit connu de l'API, et sa page de demande de renseignement ; sans API, les fiches
 * sont rendues dans le navigateur, et /contact?produit=… sert le formulaire de contact simple.
 */
const prerenderProducts = async (siteDir, apiUrl, { locale, sitemap, productTranslations }) => {
  const { toProductDetail } =
    await import('/js/modules/catalog/infrastructure/http/catalogTranslation.js')
  let slugs
  try {
    slugs = (await listProducts(apiUrl, locale)).map((item) => item.slug)
  } catch (error) {
    console.warn(
      `[contenu] fiches produit rendues dans le navigateur, API injoignable (${error.message})`,
    )
    return
  }
  const template = readFileSync(join(siteDir, 'produit', 'fiche.html'), 'utf8')
  const contact = readFileSync(join(siteDir, 'contact', 'index.html'), 'utf8')
  mkdirSync(join(siteDir, 'contact', 'demande'), { recursive: true })
  const written = []
  for (const slug of slugs) {
    try {
      const product = toProductDetail(
        await fetchJson(apiUrl, `/api/products/${encodeURIComponent(slug)}`, { locale }),
      )
      mkdirSync(join(siteDir, 'produit', slug), { recursive: true })
      writeFileSync(
        join(siteDir, 'produit', slug, 'index.html'),
        prerenderProduct(template, product, SITE_URL, productTranslations.get(product.id)),
      )
      writeFileSync(
        join(siteDir, 'contact', 'demande', `${slug}.html`),
        prerenderContactProduct(contact, product),
      )
      written.push(slug)
    } catch (error) {
      console.warn(`[contenu] /produit/${slug} rendue dans le navigateur (${error.message})`)
    }
  }
  console.info(
    `[contenu] ${written.length} fiches produit pré-rendues${locale ? ` (${locale})` : ''}`,
  )
  if (sitemap) {
    writeFileSync(
      sitemap,
      withPagesInSitemap(readFileSync(sitemap, 'utf8'), 'produit', written, SITE_URL),
    )
  }
}

/** Une page par article connu de l'API ; sans API, les fiches sont rendues dans le navigateur. */
const prerenderArticles = async (siteDir, apiUrl, { locale, sitemap }) => {
  const { toArticleDetail, toArticles, toArticleSections } =
    await import('/js/modules/blog/infrastructure/http/articleTranslation.js')
  let articles
  let sections
  try {
    articles = toArticles(await fetchJson(apiUrl, '/api/articles', { locale }))
    // Une API qui ne sert pas les rubriques (Hono) en vaut une sans rubrique
    sections = await fetchJson(apiUrl, '/api/article-sections', { locale }).then(
      toArticleSections,
      () => [],
    )
  } catch (error) {
    console.warn(`[contenu] fiches rendues dans le navigateur, API injoignable (${error.message})`)
    return
  }
  writeFileSync(
    join(siteDir, 'blog', 'index.html'),
    prerenderBlogList(
      readFileSync(join(siteDir, 'blog', 'index.html'), 'utf8'),
      articles,
      sections,
    ),
  )
  console.info(`[contenu] /blog pré-rendue${locale ? ` (${locale})` : ''}`)
  const template = readFileSync(join(siteDir, 'blog', 'fiche.html'), 'utf8')
  const written = []
  for (const { slug } of articles) {
    try {
      const article = toArticleDetail(
        await fetchJson(apiUrl, `/api/articles/${encodeURIComponent(slug)}`, { locale }),
      )
      mkdirSync(join(siteDir, 'blog', slug), { recursive: true })
      writeFileSync(
        join(siteDir, 'blog', slug, 'index.html'),
        prerenderArticle(template, article, SITE_URL),
      )
      written.push(slug)
      console.info(`[contenu] /blog/${slug} pré-rendue${locale ? ` (${locale})` : ''}`)
    } catch (error) {
      console.warn(`[contenu] /blog/${slug} rendue dans le navigateur (${error.message})`)
    }
  }
  if (sitemap) {
    writeFileSync(sitemap, withArticlesInSitemap(readFileSync(sitemap, 'utf8'), written, SITE_URL))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
