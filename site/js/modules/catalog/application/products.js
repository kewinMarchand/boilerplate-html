import {
  findFeaturedProducts,
  findProduct,
  findSimilarProducts,
} from '../infrastructure/http/catalogRepository.js'

/** Fiche d'un produit ; `null` si l'API ne le connaît pas, rejet si elle ne répond pas. */
export const loadProduct = (slug) => findProduct(slug)

/** Produits similaires de la fiche (même catégorie) ; aucun si l'API ne répond pas : la fiche reste l'essentiel. */
export const loadSimilarProducts = (categorySlug, excludedSlug) =>
  findSimilarProducts(categorySlug, excludedSlug).catch(() => [])

/** Produits « À la une » du carrousel de l'accueil ; rejet si l'API ne répond pas. */
export const loadFeaturedProducts = () => findFeaturedProducts()
