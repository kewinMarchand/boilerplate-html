import { fillPicture } from '/js/shared/picture.js'

import { formatPrice } from '../domain/price.js'
import { productHref } from '../domain/product.js'

/** Diapositive d'un produit (photo, nom lié à sa fiche, prix), depuis le `<template>` de la page. */
export const renderProductSlide = (template, product, index, count) => {
  const element = template.content.firstElementChild.cloneNode(true)
  element.setAttribute('aria-label', `${index + 1} sur ${count}`)
  fillPicture(element.querySelector('picture'), product.image)
  const link = element.querySelector('[data-slide-title]')
  link.textContent = product.name
  link.href = productHref(product.slug)
  element.querySelector('[data-slide-text]').textContent = formatPrice(product.price)
  return element
}
