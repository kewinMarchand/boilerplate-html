import { removeItem, setQuantity, totalPrice } from '../domain/cart.js'
import { formatPrice } from '../domain/price.js'
import { readCart, saveCart, subscribeToCart } from '../infrastructure/cartStorage.js'

const container = document.querySelector('[data-cart]')
const lineTemplate = document.getElementById('cart-line-template')
const productHref = (slug) => `/produit/${slug}`

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const createLine = (line) => {
  const element = lineTemplate.content.firstElementChild.cloneNode(true)
  element.dataset.slug = line.slug
  const link = element.querySelector('[data-cart-line-link]')
  link.href = productHref(line.slug)
  link.textContent = line.name
  element.querySelector('[data-cart-line-price]').textContent = `${formatPrice(line.price)} l’unité`
  const input = element.querySelector('[data-cart-line-quantity]')
  input.id = `quantite-${line.slug}`
  const label = element.querySelector('label')
  label.htmlFor = input.id
  label.textContent = `Quantité de ${line.name}`
  input.addEventListener('input', () => {
    if (!Number.isNaN(input.valueAsNumber))
      saveCart(setQuantity(readCart(), line.slug, input.valueAsNumber))
  })
  const remove = element.querySelector('[data-cart-line-remove]')
  remove.setAttribute('aria-label', `Retirer ${line.name}`)
  remove.addEventListener('click', () => saveCart(removeItem(readCart(), line.slug)))
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
  const slugs = new Set(lines.map((line) => line.slug))
  for (const element of [...list.children]) {
    if (!slugs.has(element.dataset.slug)) element.remove()
  }
  for (const line of lines) {
    let element = [...list.children].find((child) => child.dataset.slug === line.slug)
    if (!element) {
      element = createLine(line)
      list.append(element)
    }
    const input = element.querySelector('[data-cart-line-quantity]')
    if (input.valueAsNumber !== line.quantity) input.value = String(line.quantity)
    element.querySelector('[data-cart-line-subtotal]').textContent = formatPrice(
      line.price * line.quantity,
    )
  }
  container.querySelector('[data-cart-total]').textContent = formatPrice(totalPrice(lines))
}

subscribeToCart(render)
render()
