import { fillPicture } from '/js/shared/picture.js'

import { formatPrice } from '../domain/price.js'
import { productHref, productSlugFromPath } from '../domain/product.js'
import { ProductLoadError } from '../application/ProductLoadError.js'
import { loadProduct } from '../application/products.js'

import { EXPOSURE_LABELS } from './labels.js'
import { renderProductGallery } from './productGallery.js'
import { showSimilarProducts } from './similarProducts.js'

const page = document.querySelector('[data-product-page]')
const title = page.querySelector('[data-product-title]')
const crumb = page.querySelector('[data-product-crumb]')
const state = page.querySelector('[data-product-state]')
const content = page.querySelector('[data-product-content]')
// Absent d'une fiche pré-rendue dans l'image de production, qui sert déjà son contenu
const loading = state.firstElementChild?.cloneNode(true)

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const setMeta = (selector, value) =>
  document.head.querySelector(selector)?.setAttribute('content', value)

/** Description de la fiche, la même qu'au pré-rendu. */
const productDescription = (product) =>
  `${product.name} : exposition ${EXPOSURE_LABELS[product.exposure].toLowerCase()}, taille ${product.size}, ${formatPrice(product.price)}. ${product.inStock ? 'En stock' : 'En rupture de stock'}, rayon ${product.categoryPath.at(-1)?.name ?? 'catalogue'}.`

const breadcrumbItem = (step) => {
  const item = document.createElement('li')
  item.className = 'bui-breadcrumb__item'
  const link = document.createElement('a')
  link.className = 'bui-link'
  link.href = step.href
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
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'EUR',
        price: (product.price / 100).toFixed(2),
        availability: `https://schema.org/${product.inStock ? 'InStock' : 'OutOfStock'}`,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: 'Accueil', item: home },
        { name: 'Catalogue', item: new URL('/catalogue', home).href },
        ...product.categoryPath.map((step) => ({
          name: step.name,
          item: new URL(step.href, home).href,
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
  content.querySelector('[data-product-price]').textContent = formatPrice(product.price)
  const descriptionBlock = content.querySelector('[data-product-description]')
  descriptionBlock.replaceChildren(...product.description.map(paragraph))
  descriptionBlock.hidden = product.description.length === 0
  content.querySelector('[data-product-exposure]').textContent = EXPOSURE_LABELS[product.exposure]
  content.querySelector('[data-product-size]').textContent = product.size
  const stock = content.querySelector('[data-product-stock]')
  if (product.inStock) stock.textContent = 'En stock'
  else stock.innerHTML = '<span class="bui-badge bui-badge--error">Rupture de stock</span>'
  renderAttributes(product.attributes)
  const category = product.categoryPath.at(-1)
  const categoryLink = content.querySelector('[data-product-category]')
  if (category) {
    categoryLink.href = category.href
    categoryLink.textContent = `Voir les autres produits : ${category.name}`
  }
  content.hidden = false
  state.replaceChildren()
  document.title = product.metaTitle || `${product.name} · ${document.title.split(' · ').at(-1)}`
  const description = product.metaDescription || productDescription(product)
  setMeta('meta[name="description"]', description)
  setMeta('meta[name="robots"]', 'index, follow')
  const canonical = document.head.querySelector('link[rel="canonical"]')
  const url = new URL(productHref(product.slug), canonical.href).href
  canonical.href = url
  setMeta('meta[property="og:url"]', url)
  setMeta('meta[property="og:title"]', document.title)
  setMeta('meta[property="og:description"]', description)
  addJsonLd(product, url, new URL('/', url).href)
  // Annonce le produit aux scripts que la page branche sur la fiche (bouton d'achat), sans les connaître
  document.dispatchEvent(
    new CustomEvent('product:shown', {
      detail: {
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
  title.textContent = 'Produit introuvable'
  crumb.textContent = 'Produit introuvable'
  state.replaceChildren(fromTemplate('product-not-found-template'))
}

const renderError = () => {
  state.replaceChildren(fromTemplate('product-error-template'))
  state.querySelector('[data-product-error-message]').textContent = new ProductLoadError().message
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
