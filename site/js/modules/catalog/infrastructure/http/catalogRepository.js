import { ApiError, apiGet } from '/js/shared/api.js'

import {
  toProductDetail,
  toProducts,
  toProductsQuery,
  toSearchResult,
} from './catalogTranslation.js'

export const searchProducts = async ({ categorySlug, query }) =>
  toSearchResult(await apiGet('/api/products', toProductsQuery(categorySlug, query)))

/** `null` si l'API ne connaît pas le produit (404). */
export const findProduct = async (slug) => {
  try {
    return toProductDetail(await apiGet(`/api/products/${encodeURIComponent(slug)}`))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Produits « À la une » : le carrousel de l'accueil. */
export const findFeaturedProducts = async () => toProducts(await apiGet('/api/featured-products'))
