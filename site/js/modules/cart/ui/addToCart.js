import { addItem } from '../domain/cart.js'
import { readCart, saveCart } from '../infrastructure/cartStorage.js'

const CART_PATH = '/panier'

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
    link.href = CART_PATH
    link.textContent = 'Voir le panier'
    status.replaceChildren(`${product.name} ajouté au panier. `, link)
  })
})
