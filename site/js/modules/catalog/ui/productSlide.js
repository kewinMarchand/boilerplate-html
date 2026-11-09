import { formatLabel } from '/js/shared/labels.js'
import { localizePath, pageLocale } from '/js/shared/locale.js'
import { fillPicture } from '/js/shared/picture.js'

import { formatPrice } from '../domain/price.js'
import { productHref } from '../domain/product.js'

/**
 * Diapositive d'un produit (photo, nom lié à sa fiche, prix s'il est vendu en ligne), depuis le
 * `<template>` de la page ; `label` : position (« {number} sur {count} ») dans la langue de la page.
 */
export const renderProductSlide = (template, label, product, index, count) => {
  const element = template.content.firstElementChild.cloneNode(true)
  element.setAttribute('aria-label', formatLabel(label, { number: index + 1, count }))
  fillPicture(element.querySelector('picture'), product.image)
  const link = element.querySelector('[data-slide-title]')
  link.textContent = product.name
  link.href = localizePath(productHref(product.slug))
  const price = element.querySelector('[data-slide-text]')
  if (price) price.textContent = formatPrice(product.price, pageLocale())
  return element
}
