import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  addItem,
  countItems,
  lineIn,
  MAX_QUANTITY,
  removeItem,
  setQuantity,
  totalPrice,
} from '../../site/js/modules/cart/domain/cart.js'
import { parseCart } from '../../site/js/modules/cart/infrastructure/cartStorage.js'

const MONSTERA = {
  id: '1',
  slug: 'monstera-deliciosa',
  name: 'Monstera deliciosa',
  price: 3490,
  translations: [
    { locale: 'fr', slug: 'monstera-deliciosa', name: 'Monstera deliciosa' },
    { locale: 'en', slug: 'swiss-cheese-plant', name: 'Swiss cheese plant' },
  ],
}
const FERN = {
  id: '2',
  slug: 'fougere-de-boston',
  name: 'Fougère de Boston',
  price: 1590,
  translations: [],
}

describe('panier', () => {
  it('ajoute une ligne puis cumule les ajouts du même produit', () => {
    const lines = addItem(addItem(addItem([], MONSTERA), FERN), MONSTERA)

    assert.deepEqual(lines, [
      { ...MONSTERA, quantity: 2 },
      { ...FERN, quantity: 1 },
    ])
    assert.equal(countItems(lines), 3)
    assert.equal(totalPrice(lines), 2 * 3490 + 1590)
  })

  it('plafonne la quantité à 99 et la garde au moins à 1', () => {
    const lines = setQuantity(addItem([], MONSTERA), MONSTERA.id, 250)

    assert.equal(lines[0].quantity, MAX_QUANTITY)
    assert.equal(addItem(lines, MONSTERA)[0].quantity, MAX_QUANTITY)
    assert.equal(setQuantity(lines, MONSTERA.id, 0)[0].quantity, 1)
  })

  it('retire une ligne', () => {
    assert.deepEqual(removeItem(addItem(addItem([], MONSTERA), FERN), MONSTERA.id), [
      { ...FERN, quantity: 1 },
    ])
  })
})

describe('ligne dans la langue de la page', () => {
  it('prend le slug et le nom de la langue, ceux de l’ajout sans traduction', () => {
    const [monstera, fern] = addItem(addItem([], MONSTERA), FERN)

    assert.deepEqual(
      { ...lineIn(monstera, 'en') },
      { locale: 'en', slug: 'swiss-cheese-plant', name: 'Swiss cheese plant' },
    )
    assert.equal(lineIn(monstera, 'de').name, 'Monstera deliciosa')
    assert.equal(lineIn(fern, 'en').slug, 'fougere-de-boston')
  })
})

describe('lecture du panier enregistré', () => {
  it('lit un panier valide', () => {
    const lines = [{ ...MONSTERA, quantity: 2 }]

    assert.deepEqual(parseCart(JSON.stringify(lines)), lines)
  })

  it('relit un panier enregistré avant les langues, le slug servant d’identifiant', () => {
    const old = { slug: 'monstera-deliciosa', name: 'Monstera deliciosa', price: 3490, quantity: 2 }

    assert.deepEqual(parseCart(JSON.stringify([old])), [
      { ...old, id: 'monstera-deliciosa', translations: [] },
    ])
  })

  it('refuse une traduction incomplète', () => {
    const line = { ...MONSTERA, quantity: 1, translations: [{ locale: 'en', slug: 'x' }] }

    assert.deepEqual(parseCart(JSON.stringify([line])), [])
  })

  it('rend un panier vide pour une entrée absente, illisible ou invalide', () => {
    assert.deepEqual(parseCart(null), [])
    assert.deepEqual(parseCart('{pas du json'), [])
    assert.deepEqual(parseCart(JSON.stringify({ slug: 'x' })), [])
    assert.deepEqual(
      parseCart(JSON.stringify([{ slug: 'x', name: 'X', price: -1, quantity: 1 }])),
      [],
    )
    assert.deepEqual(
      parseCart(JSON.stringify([{ slug: 'x', name: 'X', price: 1, quantity: 100 }])),
      [],
    )
    assert.deepEqual(
      parseCart(JSON.stringify([{ slug: 'x', name: 'X', price: 1.5, quantity: 1 }])),
      [],
    )
  })
})
