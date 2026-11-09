import { formatLabel } from '/js/shared/labels.js'
import { localizePath, pageLocale } from '/js/shared/locale.js'
import { fillPicture } from '/js/shared/picture.js'

import { formatPrice } from '../domain/price.js'
import { productHref, productSlugFromPath } from '../domain/product.js'
import { loadProduct } from '../application/products.js'

import { exposureLabel } from './labels.js'
import { renderProductGallery } from './productGallery.js'
import { showSimilarProducts } from './similarProducts.js'

const page = document.querySelector('[data-product-page]')
const title = page.querySelector('[data-product-title]')
const crumb = page.querySelector('[data-product-crumb]')
const state = page.querySelector('[data-product-state]')
const content = page.querySelector('[data-product-content]')
// Sans vente en ligne : ni prix, ni offre, et la demande de renseignement à la place du panier (section 27)
const salesEnabled = !document.documentElement.hasAttribute('data-sales-disabled')
// Libellés des scripts dans la langue de la page
const labels = page.dataset
const locale = pageLocale()
// Absent d'une fiche pré-rendue dans l'image de production, qui sert déjà son contenu
const loading = state.firstElementChild?.cloneNode(true)

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const setMeta = (selector, value) =>
  document.head.querySelector(selector)?.setAttribute('content', value)

/** Description de la fiche, la même qu'au pré-rendu (prix retiré sans vente en ligne). */
const productDescription = (product) =>
  formatLabel(labels.labelDescription, {
    name: product.name,
    exposure: exposureLabel(labels, product.exposure).toLocaleLowerCase(locale),
    size: product.size,
    price: salesEnabled ? `, ${formatPrice(product.price, locale)}` : '',
    stock: product.inStock ? labels.labelInStock : labels.labelOutOfStockSentence,
    category: product.categoryPath.at(-1)?.name ?? labels.labelCatalog,
  })

const breadcrumbItem = (step) => {
  const item = document.createElement('li')
  item.className = 'bui-breadcrumb__item'
  const link = document.createElement('a')
  link.className = 'bui-link'
  link.href = localizePath(step.href)
  link.textContent = step.name
  item.append(link)
  return item
}

const attributeValue = ({ valueLabel, unit }) => (unit ? `${valueLabel}\u00a0${unit}` : valueLabel)

const renderAttributes = (attributes) => {
  const list = content.querySelector('[data-product-attributes]')
  if (attributes.length === 0) {
    list?.remove()
    return
  }
  list.replaceChildren(
    ...attributes.flatMap((attribute) => [
      Object.assign(document.createElement('dt'), { textContent: attribute.label }),
      Object.assign(document.createElement('dd'), { textContent: attributeValue(attribute) }),
    ]),
  )
}

const paragraph = (text) => {
  const element = document.createElement('p')
  element.textContent = text
  return element
}

/** Données structurées de la fiche, comme celles écrites au pré-rendu (absentes d'une fiche déjà pré-rendue). */
const addJsonLd = (product, url, home) => {
  if (document.head.querySelector('script[type="application/ld+json"]')) return
  const image = product.image?.sources
    .find(({ type }) => type === 'image/webp')
    ?.srcset.split(', ')
    .at(-1)
    ?.split(' ')[0]
  const category = product.categoryPath.at(-1)
  for (const data of [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      ...(product.description.length > 0 && { description: product.description.join(' ') }),
      sku: product.slug,
      url,
      ...(category && { category: category.name }),
      ...(image && { image }),
      ...(salesEnabled && {
        offers: {
          '@type': 'Offer',
          url,
          priceCurrency: 'EUR',
          price: (product.price / 100).toFixed(2),
          availability: `https://schema.org/${product.inStock ? 'InStock' : 'OutOfStock'}`,
        },
      }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: labels.labelHome, item: new URL(localizePath('/'), home).href },
        { name: labels.labelCatalogTitle, item: new URL(localizePath('/catalogue'), home).href },
        ...product.categoryPath.map((step) => ({
          name: step.name,
          item: new URL(localizePath(step.href), home).href,
        })),
        { name: product.name, item: url },
      ].map((entry, index) => ({ '@type': 'ListItem', position: index + 1, ...entry })),
    },
  ]) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(data)
    document.head.append(script)
  }
}

const renderProduct = (product, prerendered) => {
  title.textContent = product.name
  crumb.textContent = product.name
  if (!prerendered) crumb.parentElement.before(...product.categoryPath.map(breadcrumbItem))
  const picture = content.querySelector('picture')
  if (picture) fillPicture(picture, product.image)
  renderProductGallery(content.querySelector('[data-product-gallery]'), product)
  if (salesEnabled) {
    content.querySelector('[data-product-price]').textContent = formatPrice(product.price, locale)
  } else {
    const inquiry = content.querySelector('[data-product-inquiry]')
    inquiry.href = localizePath(`/contact?produit=${encodeURIComponent(product.slug)}`)
    inquiry.querySelector('[data-product-inquiry-name]').textContent = formatLabel(
      labels.labelInquiryName,
      { name: product.name },
    )
  }
  const descriptionBlock = content.querySelector('[data-product-description]')
  descriptionBlock.replaceChildren(...product.description.map(paragraph))
  descriptionBlock.hidden = product.description.length === 0
  content.querySelector('[data-product-exposure]').textContent = exposureLabel(
    labels,
    product.exposure,
  )
  content.querySelector('[data-product-size]').textContent = product.size
  const stock = content.querySelector('[data-product-stock]')
  if (product.inStock) stock.textContent = labels.labelInStock
  else {
    const badge = document.createElement('span')
    badge.className = 'bui-badge bui-badge--error'
    badge.textContent = labels.labelOutOfStock
    stock.replaceChildren(badge)
  }
  renderAttributes(product.attributes)
  const category = product.categoryPath.at(-1)
  const categoryLink = content.querySelector('[data-product-category]')
  if (category) {
    categoryLink.href = localizePath(category.href)
    categoryLink.textContent = formatLabel(labels.labelCategoryLink, { name: category.name })
  }
  content.hidden = false
  state.replaceChildren()
  document.title = product.metaTitle || `${product.name} · ${document.title.split(' · ').at(-1)}`
  const description = product.metaDescription || productDescription(product)
  setMeta('meta[name="description"]', description)
  setMeta('meta[name="robots"]', 'index, follow')
  const canonical = document.head.querySelector('link[rel="canonical"]')
  const url = new URL(localizePath(productHref(product.slug)), canonical.href).href
  canonical.href = url
  setMeta('meta[property="og:url"]', url)
  setMeta('meta[property="og:title"]', document.title)
  setMeta('meta[property="og:description"]', description)
  addJsonLd(product, url, new URL('/', url).href)
  // Annonce le produit aux scripts que la page branche sur la fiche (bouton d'achat), sans les connaître
  document.dispatchEvent(
    new CustomEvent('product:shown', {
      detail: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        inStock: product.inStock,
      },
    }),
  )
  showSimilarProducts(product)
}

/** Produit inconnu de l'API : message, et la page reste hors de l'index (pas de vraie 404 sans serveur). */
const renderNotFound = () => {
  title.textContent = labels.labelNotFound
  crumb.textContent = labels.labelNotFound
  state.replaceChildren(fromTemplate('product-not-found-template'))
}

const renderError = () => {
  state.replaceChildren(fromTemplate('product-error-template'))
  state.querySelector('[data-product-retry]').addEventListener('click', loadPage)
}

const loadPage = async () => {
  const prerendered = !content.hidden
  const slug = productSlugFromPath(window.location.pathname)
  if (!slug) {
    renderNotFound()
    return
  }
  if (!prerendered) state.replaceChildren(loading.cloneNode(true))
  let product
  try {
    product = await loadProduct(slug)
  } catch {
    if (!prerendered) renderError()
    return
  }
  if (product === null) renderNotFound()
  else renderProduct(product, prerendered)
}

loadPage()
