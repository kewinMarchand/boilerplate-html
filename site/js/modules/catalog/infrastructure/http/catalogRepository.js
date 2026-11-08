import { ApiError, apiGet } from '/js/shared/api.js'

import { SIMILAR_PRODUCTS_LIMIT } from '../../domain/product.js'

import {
  toFacetsQuery,
  toProductDetail,
  toProducts,
  toProductsQuery,
  toSearchResult,
} from './catalogTranslation.js'

export const searchProducts = async ({ categorySlug, query }) => {
  const [products, facets] = await Promise.all([
    apiGet('/api/products', toProductsQuery(categorySlug, query)),
    apiGet('/api/product-facets', toFacetsQuery(categorySlug, query)),
  ])
  return toSearchResult(products, facets, query.page)
}

/** `null` si l'API ne connaît pas le produit (404). */
export const findProduct = async (slug) => {
  try {
    return toProductDetail(await apiGet(`/api/products/${encodeURIComponent(slug)}`))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Produits de la catégorie, sans celui affiché : le carrousel de la fiche. */
export const findSimilarProducts = async (categorySlug, excludedSlug) =>
  toProducts(
    await apiGet('/api/products', {
      category: categorySlug,
      itemsPerPage: SIMILAR_PRODUCTS_LIMIT + 1,
    }),
  )
    .filter((product) => product.slug !== excludedSlug)
    .slice(0, SIMILAR_PRODUCTS_LIMIT)

/** Produits « À la une » : le carrousel de l'accueil. */
export const findFeaturedProducts = async () => toProducts(await apiGet('/api/featured-products'))
