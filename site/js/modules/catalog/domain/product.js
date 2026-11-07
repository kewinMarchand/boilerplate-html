export const PRODUCT_ROOT_PATH = '/produit'

export const productHref = (slug) => `${PRODUCT_ROOT_PATH}/${slug}`

/** Slug de la fiche ouverte, lu dans l'adresse : /produit/<slug>. */
export const productSlugFromPath = (pathname) =>
  /^\/produit\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null
