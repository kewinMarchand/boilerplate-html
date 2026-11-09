import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  eurosToCents,
  formatPrice,
  InvalidPriceError,
  Price,
} from '../../site/js/modules/catalog/domain/price.js'

describe('prix', () => {
  it('n’accepte que des centimes entiers positifs ou nuls', () => {
    assert.equal(Price.fromCents(3490), 3490)
    assert.equal(Price.fromCents(0), 0)
    assert.throws(() => Price.fromCents(-1), InvalidPriceError)
    assert.throws(() => Price.fromCents(12.5), {
      message: 'Un prix ne peut pas être négatif ni fractionnaire : 12.5 centimes.',
    })
  })

  it('convertit les euros de l’URL en centimes, arrondis', () => {
    assert.equal(eurosToCents(34.9), 3490)
    assert.equal(eurosToCents(19.99), 1999)
    assert.equal(eurosToCents(80), 8000)
  })

  it('formate en euros dans la langue de la page', () => {
    assert.equal(formatPrice(Price.fromCents(3490), 'fr').replace(/\s/g, ' '), '34,90 €')
    assert.equal(formatPrice(Price.fromCents(3490), 'en'), '€34.90')
  })
})
