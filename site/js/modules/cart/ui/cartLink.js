import { countLabel } from '/js/shared/labels.js'
import { pageLocale } from '/js/shared/locale.js'

import { countItems } from '../domain/cart.js'
import { readCart, subscribeToCart } from '../infrastructure/cartStorage.js'

const link = document.querySelector('[data-cart-link]')

const part = (className, text) => {
  const element = document.createElement('span')
  element.className = className
  element.dataset.cartCountPart = ''
  element.textContent = text
  return element
}

/** Nom accessible « Panier, 3 articles » : le texte visible et des compléments masqués, sans aria-label (WCAG 2.5.3). */
const render = () => {
  const count = countItems(readCart())
  link.querySelectorAll('[data-cart-count-part]').forEach((element) => element.remove())
  if (count === 0) return
  const badge = part('cart-count', String(count))
  badge.dataset.testid = 'cart-count'
  link.append(
    part('bui-visually-hidden', ', '),
    badge,
    part(
      'bui-visually-hidden',
      countLabel(
        count,
        { one: link.dataset.labelItemsOne, other: link.dataset.labelItemsOther },
        pageLocale(),
      ),
    ),
  )
}

subscribeToCart(render)
render()
