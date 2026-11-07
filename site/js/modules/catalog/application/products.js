import { findFeaturedProducts, findProduct } from '../infrastructure/http/catalogRepository.js'

/** Fiche d'un produit ; `null` si l'API ne le connaît pas, rejet si elle ne répond pas. */
export const loadProduct = (slug) => findProduct(slug)

/** Produits « À la une » du carrousel de l'accueil ; rejet si l'API ne répond pas. */
export const loadFeaturedProducts = () => findFeaturedProducts()
