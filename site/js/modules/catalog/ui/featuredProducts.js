import { initCarousel } from '/js/shared/carousel/carousel.js'
import { fillPicture } from '/js/shared/picture.js'

import { formatPrice } from '../domain/price.js'
import { productHref } from '../domain/product.js'
import { FeaturedProductsLoadError } from '../application/FeaturedProductsLoadError.js'
import { loadFeaturedProducts } from '../application/products.js'

const carousel = document.querySelector('[data-carousel]')
const state = carousel.querySelector('[data-carousel-state]')
const controls = carousel.querySelector('[data-carousel-controls]')
const viewport = carousel.querySelector('[data-carousel-viewport]')
const slidesContainer = carousel.querySelector('[data-carousel-slides]')
const slideTemplate = document.getElementById('carousel-slide-template')
// Absent d'un accueil pré-rendu dans l'image de production, qui sert déjà ses diapositives
const loading = state.firstElementChild?.cloneNode(true)

const renderSlide = (product, index, products) => {
  const element = slideTemplate.content.firstElementChild.cloneNode(true)
  element.setAttribute('aria-label', `${index + 1} sur ${products.length}`)
  fillPicture(element.querySelector('picture'), product.image)
  const link = element.querySelector('[data-slide-title]')
  link.textContent = product.name
  link.href = productHref(product.slug)
  element.querySelector('[data-slide-text]').textContent = formatPrice(product.price)
  return element
}

const renderError = () => {
  controls.hidden = true
  viewport.hidden = true
  state.replaceChildren(document.getElementById('carousel-error-template').content.cloneNode(true))
  state.querySelector('[data-carousel-error-message]').textContent =
    new FeaturedProductsLoadError().message
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
  slidesContainer.replaceChildren(...products.map(renderSlide))
  initCarousel(carousel)
}

loadSlides()
