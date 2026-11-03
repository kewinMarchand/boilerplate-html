import { initCarousel } from '/js/shared/carousel/carousel.js'

import { findSlides } from '../infrastructure/http/slideRepository.js'
import { SlidesLoadError } from '../infrastructure/SlidesLoadError.js'

const carousel = document.querySelector('[data-carousel]')
const state = carousel.querySelector('[data-carousel-state]')
const controls = carousel.querySelector('[data-carousel-controls]')
const viewport = carousel.querySelector('[data-carousel-viewport]')
const slidesContainer = carousel.querySelector('[data-carousel-slides]')
const slideTemplate = document.getElementById('carousel-slide-template')
// Absent d'un accueil pré-rendu dans l'image de production, qui sert déjà ses diapositives
const loading = state.firstElementChild?.cloneNode(true)

const renderSlide = (slide, index, slides) => {
  const element = slideTemplate.content.firstElementChild.cloneNode(true)
  const image = `/images/slide-${slide.image}`
  element.setAttribute('aria-label', `${index + 1} sur ${slides.length}`)
  element.querySelector('[data-slide-avif]').srcset =
    `${image}-640.avif 640w, ${image}-1280.avif 1280w`
  element.querySelector('[data-slide-webp]').srcset =
    `${image}-640.webp 640w, ${image}-1280.webp 1280w`
  element.querySelector('[data-slide-image]').src = `${image}-1280.webp`
  element.querySelector('[data-slide-title]').textContent = slide.title
  element.querySelector('[data-slide-text]').textContent = slide.text
  return element
}

const renderError = () => {
  controls.hidden = true
  viewport.hidden = true
  state.replaceChildren(document.getElementById('carousel-error-template').content.cloneNode(true))
  state.querySelector('[data-carousel-error-message]').textContent = new SlidesLoadError().message
  state.querySelector('[data-carousel-retry]').addEventListener('click', loadSlides)
}

const loadSlides = async () => {
  const prerendered = slidesContainer.children.length > 0
  if (!prerendered) state.replaceChildren(loading.cloneNode(true))
  let slides
  try {
    slides = await findSlides()
  } catch {
    if (prerendered) initCarousel(carousel)
    else renderError()
    return
  }
  if (!slides.length) {
    carousel.remove()
    return
  }
  controls.hidden = false
  viewport.hidden = false
  state.replaceChildren()
  slidesContainer.replaceChildren(...slides.map(renderSlide))
  initCarousel(carousel)
}

loadSlides()
