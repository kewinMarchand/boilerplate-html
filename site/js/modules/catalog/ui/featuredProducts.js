import { initCarousel } from '/js/shared/carousel/carousel.js'

import { loadFeaturedProducts } from '../application/products.js'

import { renderProductSlide } from './productSlide.js'

const carousel = document.querySelector('[data-carousel]')
const state = carousel.querySelector('[data-carousel-state]')
const controls = carousel.querySelector('[data-carousel-controls]')
const viewport = carousel.querySelector('[data-carousel-viewport]')
const slidesContainer = carousel.querySelector('[data-carousel-slides]')
const slideTemplate = document.getElementById('carousel-slide-template')
// Absent d'un accueil pré-rendu dans l'image de production, qui sert déjà ses diapositives
const loading = state.firstElementChild?.cloneNode(true)

const renderError = () => {
  controls.hidden = true
  viewport.hidden = true
  state.replaceChildren(document.getElementById('carousel-error-template').content.cloneNode(true))
  state.querySelector('[data-carousel-retry]').addEventListener('click', loadSlides)
}

const loadSlides = async () => {
  const prerendered = slidesContainer.children.length > 0
  if (!prerendered) state.replaceChildren(loading.cloneNode(true))
  let products
  try {
    products = await loadFeaturedProducts()
  } catch {
    if (prerendered) initCarousel(carousel)
    else renderError()
    return
  }
  if (!products.length) {
    carousel.remove()
    return
  }
  controls.hidden = false
  viewport.hidden = false
  state.replaceChildren()
  slidesContainer.replaceChildren(
    ...products.map((product, index) =>
      renderProductSlide(
        slideTemplate,
        carousel.dataset.labelSlide,
        product,
        index,
        products.length,
      ),
    ),
  )
  initCarousel(carousel)
}

loadSlides()
