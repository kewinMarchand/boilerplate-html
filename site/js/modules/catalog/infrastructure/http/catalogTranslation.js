import { ApiContractError, field, imageField } from '/js/shared/api.js'

import { EXPOSURES, SIZES } from '../../domain/catalogQuery.js'
import { eurosToCents, Price } from '../../domain/price.js'

export const ITEMS_PER_PAGE = 12

const SORT_PARAMS = {
  pertinence: {},
  'prix-asc': { 'order[price]': 'asc' },
  'prix-desc': { 'order[price]': 'desc' },
  nom: { 'order[name]': 'asc' },
}

/** Filtres communs à la liste et aux facettes : euros de l'URL en centimes, listes en clés répétées. */
export const toFacetsQuery = (categorySlug, query) => ({
  ...(categorySlug && { category: categorySlug }),
  'exposure[]': query.exposures,
  'size[]': query.sizes,
  ...Object.fromEntries(
    Object.entries(query.attributes).map(([code, values]) => [`attributes[${code}][]`, values]),
  ),
  ...(query.priceMin !== null && { priceMin: eurosToCents(query.priceMin) }),
  ...(query.priceMax !== null && { priceMax: eurosToCents(query.priceMax) }),
  ...(query.inStock && { inStock: true }),
})

/** Filtres, tri du front en `order[...]` et page demandée. */
export const toProductsQuery = (categorySlug, query) => ({
  ...toFacetsQuery(categorySlug, query),
  ...SORT_PARAMS[query.sort],
  page: query.page,
  itemsPerPage: ITEMS_PER_PAGE,
})

const oneOf = (value, accepted, name) => {
  if (!accepted.includes(value)) throw new ApiContractError(name)
  return value
}

export const toProduct = (dto) => ({
  id: field(dto, 'id', 'number'),
  slug: field(dto, 'slug', 'string'),
  name: field(dto, 'name', 'string'),
  categorySlug: field(dto, 'categorySlug', 'string'),
  price: Price.fromCents(field(dto, 'price', 'number')),
  exposure: oneOf(field(dto, 'exposure', 'string'), EXPOSURES, 'exposure'),
  size: oneOf(field(dto, 'size', 'string'), SIZES, 'size'),
  inStock: field(dto, 'inStock', 'boolean'),
  image: imageField(dto, 'image'),
})

const matching = (value, pattern, name) => {
  if (!pattern.test(value)) throw new ApiContractError(name)
  return value
}

const ATTRIBUTE_CODE = /^[a-z][a-z0-9-]{0,39}$/
const ATTRIBUTE_VALUE = /^[a-z0-9][a-z0-9-]{0,39}$/

/** Une API qui ne sert pas encore les attributs, la galerie ou les métadonnées (sections 23, 24 et 26 de la spec commune) en vaut une où ils sont vides. */
const optionalArray = (dto, name) => (dto?.[name] === undefined ? [] : field(dto, name, 'array'))

const optionalString = (dto, name) => (dto?.[name] === undefined ? '' : field(dto, name, 'string'))

/** Facettes des attributs filtrables : codes et valeurs sûrs pour l'URL, les `id` et les sélecteurs. */
const toAttributeFacets = (facets) =>
  optionalArray(facets, 'attributes').map((attribute) => ({
    code: matching(field(attribute, 'code', 'string'), ATTRIBUTE_CODE, 'attributes.code'),
    label: field(attribute, 'label', 'string'),
    values: field(attribute, 'values', 'array').map((value) => ({
      value: matching(field(value, 'value', 'string'), ATTRIBUTE_VALUE, 'attributes.values.value'),
      label: field(value, 'label', 'string'),
      count: field(value, 'count', 'number'),
    })),
  }))

/** Attributs renseignés sur un produit, dans l'ordre de l'API. */
const toProductAttributes = (dto) =>
  optionalArray(dto, 'attributes').map((attribute) => ({
    code: field(attribute, 'code', 'string'),
    label: field(attribute, 'label', 'string'),
    valueLabel: field(attribute, 'valueLabel', 'string'),
    unit: attribute?.unit === null ? null : field(attribute, 'unit', 'string'),
  }))

const toCounts = (values, dtos) =>
  Object.fromEntries(
    values.map((value) => [value, dtos.find((dto) => dto?.value === value)?.count ?? 0]),
  )

/** Une page de la liste et les facettes des mêmes filtres ; le nombre de pages vient du total. */
export const toSearchResult = (productsDto, facets, page) => {
  const total = field(facets, 'totalItems', 'number')
  return {
    items: toProducts(productsDto),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
    exposureCounts: toCounts(EXPOSURES, field(facets, 'exposure', 'array')),
    sizeCounts: toCounts(SIZES, field(facets, 'size', 'array')),
    attributeFacets: toAttributeFacets(facets),
    categoryCounts: field(facets, 'category', 'array').map((child) => ({
      category: { slug: field(child, 'slug', 'string'), name: field(child, 'name', 'string') },
      count: field(child, 'count', 'number'),
    })),
  }
}

/** Slug de la fiche dans chaque langue où elle existe (section 29), `[]` sur un site d'une seule langue. */
const toAlternates = (dto) =>
  optionalArray(dto, 'alternates').map((alternate) => ({
    locale: field(alternate, 'locale', 'string'),
    slug: field(alternate, 'slug', 'string'),
  }))

/**
 * Fiche : le produit, les paragraphes de sa description (séparés par une ligne vide dans le contrat) et
 * le chemin de sa catégorie, chaque étape avec l'adresse de sa page du catalogue.
 */
export const toProductDetail = (dto) => {
  const steps = field(dto, 'categoryPath', 'array').map((step) => ({
    slug: field(step, 'slug', 'string'),
    name: field(step, 'name', 'string'),
  }))
  return {
    ...toProduct(dto),
    categoryPath: steps.map((step, index) => ({
      ...step,
      href: `/catalogue/${steps
        .slice(0, index + 1)
        .map(({ slug }) => slug)
        .join('/')}`,
    })),
    description: field(dto, 'description', 'string')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph !== ''),
    attributes: toProductAttributes(dto),
    gallery: optionalArray(dto, 'gallery').map((_, index, images) => imageField(images, index)),
    metaTitle: optionalString(dto, 'metaTitle'),
    metaDescription: optionalString(dto, 'metaDescription'),
    alternates: toAlternates(dto),
  }
}

export const toProducts = (dto) => {
  if (!Array.isArray(dto)) throw new ApiContractError('products')
  return dto.map(toProduct)
}
