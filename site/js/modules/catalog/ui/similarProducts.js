import { initCarousel } from '/js/shared/carousel/carousel.js'

import { loadSimilarProducts } from '../application/products.js'

import { renderProductSlide } from './productSlide.js'

/** Carrousel des autres produits de la catégorie ; retiré s'il n'y en a pas ou si l'API échoue. */
export const showSimilarProducts = async (product) => {
  const section = document.querySelector('[data-similar-products]')
  const products = await loadSimilarProducts(product.categorySlug, product.slug)
  if (!products.length) {
    section.remove()
    return
  }
  const template = document.getElementById('carousel-slide-template')
  section
    .querySelector('[data-carousel-slides]')
    .replaceChildren(
      ...products.map((similar, index) =>
        renderProductSlide(template, section.dataset.labelSlide, similar, index, products.length),
      ),
    )
  section.hidden = false
  initCarousel(section)
}
