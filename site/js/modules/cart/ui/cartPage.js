import { formatLabel } from '/js/shared/labels.js'
import { localizePath, pageLocale } from '/js/shared/locale.js'

import { lineIn, removeItem, setQuantity, totalPrice } from '../domain/cart.js'
import { formatPrice } from '../domain/price.js'
import { readCart, saveCart, subscribeToCart } from '../infrastructure/cartStorage.js'

const container = document.querySelector('[data-cart]')
const lineTemplate = document.getElementById('cart-line-template')
const productHref = (slug) => localizePath(`/produit/${slug}`)
const labels = container.dataset
const price = (cents) => formatPrice(cents, pageLocale())

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

/**
 * Après un retrait, le focus va au bouton « Retirer » de la ligne qui prend la place, sinon de la
 * précédente, sinon au message de panier vide : sans cela, il retombe en haut de la page.
 */
const focusAfterRemoval = (removedIndex) => {
  const buttons = container.querySelectorAll('[data-cart-line-remove]')
  const target =
    buttons[Math.min(removedIndex, buttons.length - 1)] ??
    container.querySelector('[data-cart-empty]')
  target.focus()
}

/** Ligne affichée avec le slug et le nom de la langue de la page. */
const createLine = (line) => {
  const { slug, name } = lineIn(line, pageLocale())
  const element = lineTemplate.content.firstElementChild.cloneNode(true)
  element.dataset.id = line.id
  const link = element.querySelector('[data-cart-line-link]')
  link.href = productHref(slug)
  link.textContent = name
  element.querySelector('[data-cart-line-price]').textContent = formatLabel(labels.labelUnitPrice, {
    price: price(line.price),
  })
  const input = element.querySelector('[data-cart-line-quantity]')
  input.id = `quantite-${slug}`
  const label = element.querySelector('label')
  label.htmlFor = input.id
  label.textContent = formatLabel(labels.labelQuantity, { name })
  input.addEventListener('input', () => {
    if (!Number.isNaN(input.valueAsNumber))
      saveCart(setQuantity(readCart(), line.id, input.valueAsNumber))
  })
  const remove = element.querySelector('[data-cart-line-remove]')
  remove.setAttribute('aria-label', formatLabel(labels.labelRemove, { name }))
  remove.addEventListener('click', () => {
    const index = [...element.parentElement.children].indexOf(element)
    saveCart(removeItem(readCart(), line.id))
    focusAfterRemoval(index)
  })
  return element
}

/** Met à jour les lignes sans les déplacer : le champ de quantité garde le focus pendant la saisie. */
const render = () => {
  const lines = readCart()
  if (lines.length === 0) {
    container.replaceChildren(fromTemplate('cart-empty-template'))
    return
  }
  if (!container.querySelector('[data-cart-lines]')) {
    container.replaceChildren(fromTemplate('cart-summary-template'))
  }
  const list = container.querySelector('[data-cart-lines]')
  const ids = new Set(lines.map((line) => line.id))
  for (const element of [...list.children]) {
    if (!ids.has(element.dataset.id)) element.remove()
  }
  for (const line of lines) {
    let element = [...list.children].find((child) => child.dataset.id === line.id)
    if (!element) {
      element = createLine(line)
      list.append(element)
    }
    const input = element.querySelector('[data-cart-line-quantity]')
    if (input.valueAsNumber !== line.quantity) input.value = String(line.quantity)
    element.querySelector('[data-cart-line-subtotal]').textContent = price(
      line.price * line.quantity,
    )
  }
  container.querySelector('[data-cart-total]').textContent = price(totalPrice(lines))
}

subscribeToCart(render)
render()
