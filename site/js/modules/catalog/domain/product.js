export const PRODUCT_ROOT_PATH = '/produit'

/** Produits du carrousel « Produits similaires » de la fiche. */
export const SIMILAR_PRODUCTS_LIMIT = 8

export const productHref = (slug) => `${PRODUCT_ROOT_PATH}/${slug}`

/** Slug de la fiche ouverte, lu dans l'adresse : /produit/<slug>, ou /<langue>/produit/<slug>. */
export const productSlugFromPath = (pathname) =>
  /^(?:\/[a-z]{2})?\/produit\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null
