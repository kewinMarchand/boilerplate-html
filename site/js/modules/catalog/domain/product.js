export const PRODUCT_ROOT_PATH = '/produit'

/** Produits du carrousel « Produits similaires » de la fiche. */
export const SIMILAR_PRODUCTS_LIMIT = 8

export const productHref = (slug) => `${PRODUCT_ROOT_PATH}/${slug}`

/** Slug de la fiche ouverte, lu dans l'adresse : /produit/<slug>. */
export const productSlugFromPath = (pathname) =>
  /^\/produit\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null
