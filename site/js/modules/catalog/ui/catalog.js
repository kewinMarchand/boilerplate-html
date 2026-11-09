import { formatLabel } from '/js/shared/labels.js'
import { latestOnly, STALE } from '/js/shared/latestOnly.js'
import { localizePath, pageLocale } from '/js/shared/locale.js'
import { fillPicture } from '/js/shared/picture.js'

import {
  clearFilters,
  countActiveFilters,
  EXPOSURES,
  isFiltered,
  parseQuery,
  serializeQuery,
  SIZES,
  withFilters,
} from '../domain/catalogQuery.js'
import { formatPrice } from '../domain/price.js'
import { productHref } from '../domain/product.js'
import { loadCatalogPage } from '../application/loadCatalogPage.js'

import { activeFilters } from './activeFilters.js'
import { attributeFacetsHtml, attributeInputId } from './attributeFacets.js'
import { exposureLabel, formatResultsCount } from './labels.js'
import { paginationWindow } from './pagination.js'

const root = document.querySelector('[data-catalog]')
const $ = (selector) => root.querySelector(selector)
const form = $('[data-catalog-filters]')
const aside = $('[data-catalog-aside]')
const list = $('[data-catalog-list]')
const count = $('[data-catalog-count]')
const sort = $('[data-catalog-sort]')
const state = $('[data-catalog-state]')
const pagination = $('[data-catalog-pagination]')
const title = $('#catalog-title')
const activeWrapper = $('[data-catalog-active-filters]')
const chips = $('[data-catalog-chips]')
const openButton = $('[data-catalog-filters-open]')
const activeCount = $('[data-catalog-active-count]')
const dialog = $('[data-catalog-filters-dialog]')
const dialogBody = $('[data-catalog-dialog-body]')
const doneButton = $('[data-catalog-dialog-done]')
const attributeFacetsSlot = $('[data-catalog-attribute-facets]')

const BASE_PATH = form.getAttribute('action')
const categorySlug = root.dataset.category || null
// Libellés des scripts dans la langue de la page
const labels = root.dataset
const locale = pageLocale()
const resultsCount = (total) => formatResultsCount(total, labels, locale)
const productTemplate = document.getElementById('catalog-product-template')
// Sans vente en ligne, la page n'a ni prix, ni filtre, ni tri par prix (section 27 de la spec commune)
const prices = !document.documentElement.hasAttribute('data-sales-disabled')
const parse = (params) => parseQuery(params, { prices })
let query = parse(new URLSearchParams(location.search))
let attributeFacets = []

const urlFor = (nextQuery) => {
  const search = serializeQuery(nextQuery)
  return search ? `${BASE_PATH}?${search}` : BASE_PATH
}

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const element = (tag, properties = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), properties)
  node.append(...children)
  return node
}

const syncControls = () => {
  form.querySelectorAll('[data-facet="exposures"]').forEach((input) => {
    input.checked = query.exposures.includes(input.value)
  })
  form.querySelectorAll('[data-facet="sizes"]').forEach((input) => {
    input.checked = query.sizes.includes(input.value)
  })
  form.querySelectorAll('[data-facet="attributes"]').forEach((input) => {
    input.checked = query.attributes[input.dataset.attribute]?.includes(input.value) ?? false
  })
  if (prices) {
    form.querySelector('[data-facet="priceMin"]').value = query.priceMin ?? ''
    form.querySelector('[data-facet="priceMax"]').value = query.priceMax ?? ''
  }
  form.querySelector('[data-facet="inStock"]').checked = query.inStock
  sort.value = query.sort
  list.dataset.view = query.view
  root.querySelectorAll('[data-catalog-view]').forEach((link) => {
    const view = link.dataset.catalogView
    link.href = urlFor({ ...query, view })
    if (view === query.view) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
}

const updateHead = (result) => {
  const canonical = document.querySelector('link[rel="canonical"]')
  const origin = new URL(canonical.href).origin
  canonical.href = `${origin}${BASE_PATH}${result.page > 1 ? `?page=${result.page}` : ''}`
  document
    .querySelector('meta[name="robots"]')
    .setAttribute('content', isFiltered(query) ? 'noindex, follow' : 'index, follow')
  document.querySelectorAll('link[rel="prev"], link[rel="next"]').forEach((link) => link.remove())
  const relations = [
    ['prev', result.page > 1 ? result.page - 1 : null],
    ['next', result.page < result.pageCount ? result.page + 1 : null],
  ]
  for (const [rel, page] of relations) {
    if (page) document.head.append(element('link', { rel, href: urlFor({ ...query, page }) }))
  }
}

const updateCounts = (result) => {
  const facets = [
    ['exposures', EXPOSURES, result.exposureCounts],
    ['sizes', SIZES, result.sizeCounts],
  ]
  for (const [facet, values, counts] of facets) {
    for (const value of values) {
      const input = form.querySelector(`[data-facet="${facet}"][value="${value}"]`)
      form.querySelector(`[data-count="${facet}-${value}"]`).textContent = `(${counts[value]})`
      input.disabled = counts[value] === 0 && !input.checked
    }
  }
  for (const { category, count: total } of result.categoryCounts) {
    form.querySelector(`[data-count="category-${category.slug}"]`).textContent = `(${total})`
  }
}

// Mêmes cases qu'au rendu précédent : compteurs mis à jour en place, la case cochée garde le focus
const renderAttributeFacets = () => {
  const ids = attributeFacets.flatMap(({ code, values }) =>
    values.map(({ value }) => attributeInputId(code, value)),
  )
  const current = [...attributeFacetsSlot.querySelectorAll('input')].map((input) => input.id)
  if (ids.join() !== current.join()) {
    attributeFacetsSlot.innerHTML = attributeFacetsHtml(attributeFacets, query)
    return
  }
  for (const { code, values } of attributeFacets) {
    for (const { value, count: total } of values) {
      const input = document.getElementById(attributeInputId(code, value))
      form.querySelector(`[data-count="attribute-${code}-${value}"]`).textContent = `(${total})`
      input.disabled = total === 0 && !input.checked
    }
  }
}

const renderChips = () => {
  const filters = activeFilters(query, labels, attributeFacets)
  activeWrapper.hidden = filters.length === 0
  activeCount.textContent = filters.length ? `(${countActiveFilters(query)})` : ''
  chips.replaceChildren(
    ...filters.map((filter) => {
      // Balisage bui-chip de boilerplates-ui, puce de filtre retirable
      const button = element('button', { type: 'button', className: 'bui-chip' }, [
        element('span', {
          className: 'bui-visually-hidden',
          textContent: `${labels.labelRemoveFilter} `,
        }),
        filter.label,
        icon('x'),
      ])
      button.dataset.testid = 'catalog-active-filter'
      button.addEventListener('click', () =>
        navigate(withFilters(query, filter.remove(query)), { focusTitle: true }),
      )
      return element('li', {}, [button])
    }),
  )
}

const SVG_NS = 'http://www.w3.org/2000/svg'

const icon = (name) => {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'bui-icon')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const use = document.createElementNS(SVG_NS, 'use')
  use.setAttribute('href', `/icons.svg#${name}`)
  svg.append(use)
  return svg
}

// Balisage bui-pagination de boilerplates-ui : flèches seulement quand elles mènent quelque part, page courante en lien
const pageItem = (page, content, { rel, current = false } = {}) => {
  const link = element('a', { className: 'bui-pagination__link', href: urlFor({ ...query, page }) })
  if (rel) link.rel = rel
  if (current) link.setAttribute('aria-current', 'page')
  link.append(...content)
  link.addEventListener('click', (event) => {
    event.preventDefault()
    navigate({ ...query, page }, { focusTitle: true })
  })
  return element('li', {}, [link])
}

const pageLabel = (page) => [
  element('span', { className: 'bui-visually-hidden', textContent: `${labels.labelPage} ` }),
  String(page),
]

const arrowLabel = (text) =>
  element('span', { className: 'bui-pagination__label', textContent: text })

const renderPagination = (result) => {
  pagination.hidden = result.pageCount <= 1
  const { page, pageCount } = result
  pagination.querySelector('ul').replaceChildren(
    ...(page > 1
      ? [
          pageItem(page - 1, [icon('chevron-left'), arrowLabel(labels.labelPrevious)], {
            rel: 'prev',
          }),
        ]
      : []),
    ...paginationWindow(page, pageCount).map((item) => {
      if (item === '…') {
        const ellipsis = element('li', { className: 'bui-pagination__ellipsis', textContent: '…' })
        ellipsis.setAttribute('aria-hidden', 'true')
        return ellipsis
      }
      return pageItem(item, pageLabel(item), { current: item === page })
    }),
    ...(page < pageCount
      ? [pageItem(page + 1, [arrowLabel(labels.labelNext), icon('chevron-right')], { rel: 'next' })]
      : []),
  )
}

const EAGER_IMAGES = 4

const renderProduct = (product, index) => {
  const item = productTemplate.content.firstElementChild.cloneNode(true)
  const $item = (selector) => item.querySelector(selector)
  item.dataset.productId = String(product.id)
  $item('[data-product-card]').id = `produit-${product.slug}`
  const img = $item('[data-product-image]')
  if (index === 0) img.fetchPriority = 'high'
  if (index >= EAGER_IMAGES) img.loading = 'lazy'
  fillPicture($item('picture'), product.image)
  $item('[data-product-name]').textContent = product.name
  $item('[data-product-link]').href = localizePath(productHref(product.slug))
  if (prices) $item('[data-product-price]').textContent = formatPrice(product.price, locale)
  $item('[data-product-exposure]').textContent = exposureLabel(labels, product.exposure)
  $item('[data-product-size]').textContent = product.size
  $item('[data-product-out-of-stock]').hidden = product.inStock
  return item
}

const renderResult = (result) => {
  list.removeAttribute('aria-busy')
  list.replaceChildren(...result.items.map(renderProduct))
  state.replaceChildren(...(result.total ? [] : [fromTemplate('catalog-empty-template')]))
  state
    .querySelector('[data-catalog-empty-clear]')
    ?.addEventListener('click', () => navigate(clearFilters(query), { focusTitle: true }))
  count.textContent = resultsCount(result.total)
  doneButton.textContent = formatLabel(labels.labelResultsShow, {
    results: resultsCount(result.total),
  })
  updateCounts(result)
  attributeFacets = result.attributeFacets
  renderAttributeFacets()
  renderChips()
  renderPagination(result)
  updateHead(result)
}

const renderError = () => {
  list.removeAttribute('aria-busy')
  list.replaceChildren()
  pagination.hidden = true
  count.textContent = ''
  state.replaceChildren(fromTemplate('catalog-error-template'))
  state.querySelector('[data-catalog-retry]').addEventListener('click', () => load())
}

const loadLatestPage = latestOnly(() => loadCatalogPage({ categorySlug, query }))

const load = async ({ showLoading = true } = {}) => {
  if (showLoading) {
    list.setAttribute('aria-busy', 'true')
    state.replaceChildren(fromTemplate('catalog-loading-template'))
    count.textContent = labels.labelLoading
  }
  const page = await loadLatestPage()
  if (page === STALE) return
  if (page.status === 'error') {
    // Actualisation d'une page pré-rendue en échec : les produits écrits restent affichés
    if (!showLoading && list.childElementCount > 0) return
    renderError()
    return
  }
  if (page.query.page !== query.page) {
    query = page.query
    history.replaceState(null, '', urlFor(query))
  }
  renderResult(page.result)
}

const navigate = async (nextQuery, { focusTitle = false } = {}) => {
  query = nextQuery
  history.pushState(null, '', urlFor(query))
  syncControls()
  await load()
  if (focusTitle) title.focus()
}

const checkedValues = (facet) =>
  [...form.querySelectorAll(`[data-facet="${facet}"]:checked`)].map((input) => input.value)

const readPrices = () => {
  const { priceMin, priceMax } = parse(new URLSearchParams(new FormData(form)))
  return { priceMin, priceMax }
}

form.addEventListener('change', (event) => {
  const { facet } = event.target.dataset
  const changes = {
    exposures: () => ({ exposures: checkedValues('exposures') }),
    sizes: () => ({ sizes: checkedValues('sizes') }),
    attributes: () => {
      const { attribute } = event.target.dataset
      const values = [...form.querySelectorAll(`[data-attribute="${attribute}"]:checked`)]
      return {
        attributes: { ...query.attributes, [attribute]: values.map((input) => input.value) },
      }
    },
    priceMin: readPrices,
    priceMax: readPrices,
    inStock: () => ({ inStock: event.target.checked }),
  }[facet]
  if (changes) navigate(withFilters(query, changes()))
})
form.addEventListener('submit', (event) => {
  event.preventDefault()
  navigate(withFilters(query, readPrices()))
})
sort.addEventListener('change', () => navigate(withFilters(query, { sort: sort.value })))
root.querySelectorAll('[data-catalog-view]').forEach((link) =>
  link.addEventListener('click', (event) => {
    event.preventDefault()
    navigate({ ...query, view: link.dataset.catalogView })
  }),
)
$('[data-catalog-clear]').addEventListener('click', () =>
  navigate(clearFilters(query), { focusTitle: true }),
)
window.addEventListener('popstate', () => {
  query = parse(new URLSearchParams(location.search))
  syncControls()
  load()
})

openButton.addEventListener('click', () => {
  dialogBody.append(form)
  dialog.showModal()
  openButton.setAttribute('aria-expanded', 'true')
})
dialog.addEventListener('close', () => {
  aside.append(form)
  openButton.setAttribute('aria-expanded', 'false')
  openButton.focus()
})
doneButton.addEventListener('click', () => dialog.close())
$('[data-catalog-dialog-close]').addEventListener('click', () => dialog.close())

syncControls()
// Page pré-rendue (première page sans filtre) : relue sans squelette. Autre état d'URL : squelette
// jusqu'à la réponse, plutôt que la première page affichée puis remplacée.
load({ showLoading: list.childElementCount > 0 && serializeQuery(query) !== '' })
