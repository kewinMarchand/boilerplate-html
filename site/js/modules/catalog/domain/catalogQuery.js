export const EXPOSURES = ['soleil', 'mi-ombre', 'ombre']
export const SIZES = ['S', 'M', 'L']
export const SORTS = ['pertinence', 'prix-asc', 'prix-desc', 'nom']
export const VIEWS = ['grille', 'liste']

/** Paramètre d'URL d'un attribut filtrable : `attr-<code>`, répété, une valeur par occurrence. */
const ATTRIBUTE_PARAM = /^attr-([a-z][a-z0-9-]{0,39})$/
const ATTRIBUTE_VALUE = /^[a-z0-9][a-z0-9-]{0,39}$/

export const DEFAULT_QUERY = Object.freeze({
  exposures: [],
  sizes: [],
  attributes: Object.freeze({}),
  priceMin: null,
  priceMax: null,
  inStock: false,
  sort: 'pertinence',
  view: 'grille',
  page: 1,
})

const parsePrice = (value) => {
  if (value === null || value.trim() === '') return null
  const price = Number(value)
  return Number.isFinite(price) && price >= 0 ? price : null
}

const parsePage = (value) => {
  const page = Number(value)
  return Number.isInteger(page) && page >= 2 ? page : 1
}

const allowed = (values, accepted) => accepted.filter((value) => values.includes(value))

const parseAttributes = (params) => {
  const attributes = {}
  for (const name of new Set(params.keys())) {
    const code = ATTRIBUTE_PARAM.exec(name)?.[1]
    const values = [...new Set(params.getAll(name))].filter((value) => ATTRIBUTE_VALUE.test(value))
    if (code && values.length > 0) attributes[code] = values
  }
  return attributes
}

export const parseQuery = (params) => {
  const sort = params.get('tri')
  return {
    exposures: allowed(params.getAll('exposition'), EXPOSURES),
    sizes: allowed(params.getAll('taille'), SIZES),
    attributes: parseAttributes(params),
    priceMin: parsePrice(params.get('prix_min')),
    priceMax: parsePrice(params.get('prix_max')),
    inStock: params.get('en_stock') === '1',
    sort: SORTS.includes(sort) ? sort : DEFAULT_QUERY.sort,
    view: params.get('vue') === 'liste' ? 'liste' : DEFAULT_QUERY.view,
    page: parsePage(params.get('page')),
  }
}

export const serializeQuery = (query) => {
  const params = new URLSearchParams()
  query.exposures.forEach((value) => params.append('exposition', value))
  query.sizes.forEach((value) => params.append('taille', value))
  for (const [code, values] of Object.entries(query.attributes)) {
    values.forEach((value) => params.append(`attr-${code}`, value))
  }
  if (query.priceMin !== null) params.set('prix_min', String(query.priceMin))
  if (query.priceMax !== null) params.set('prix_max', String(query.priceMax))
  if (query.inStock) params.set('en_stock', '1')
  if (query.sort !== DEFAULT_QUERY.sort) params.set('tri', query.sort)
  if (query.view !== DEFAULT_QUERY.view) params.set('vue', query.view)
  if (query.page > 1) params.set('page', String(query.page))
  return params.toString()
}

export const withFilters = (query, changes) => ({ ...query, ...changes, page: 1 })

export const clearFilters = (query) => ({ ...DEFAULT_QUERY, view: query.view })

export const countActiveFilters = (query) =>
  query.exposures.length +
  query.sizes.length +
  Object.values(query.attributes).flat().length +
  (query.priceMin === null ? 0 : 1) +
  (query.priceMax === null ? 0 : 1) +
  (query.inStock ? 1 : 0)

export const isFiltered = (query) =>
  countActiveFilters(query) > 0 || query.sort !== DEFAULT_QUERY.sort
