import { formatLabel } from '/js/shared/labels.js'
import { localizePath } from '/js/shared/locale.js'

import { addItem } from '../domain/cart.js'
import { readCart, saveCart } from '../infrastructure/cartStorage.js'

const CART_PATH = '/panier'
// Vider puis remplir la région : un lecteur d'écran ne relit pas un texte identique
const ANNOUNCE_DELAY_MS = 100

const slot = document.querySelector('[data-add-to-cart]')
const template = document.getElementById('add-to-cart-template')

/** La fiche annonce son produit (`product:shown`) ; sans JavaScript, ni produit ni bouton. */
document.addEventListener('product:shown', ({ detail: product }) => {
  slot.replaceChildren(template.content.cloneNode(true))
  const button = slot.querySelector('[data-add-to-cart-button]')
  const status = slot.querySelector('[data-add-to-cart-status]')
  button.disabled = !product.inStock
  button.addEventListener('click', () => {
    saveCart(addItem(readCart(), { slug: product.slug, name: product.name, price: product.price }))
    const link = document.createElement('a')
    link.className = 'bui-link'
    link.href = localizePath(CART_PATH)
    link.textContent = slot.dataset.labelCartLink
    status.replaceChildren()
    window.setTimeout(
      () =>
        status.replaceChildren(
          `${formatLabel(slot.dataset.labelAdded, { name: product.name })} `,
          link,
        ),
      ANNOUNCE_DELAY_MS,
    )
  })
})
