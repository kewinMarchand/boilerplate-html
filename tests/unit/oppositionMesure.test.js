import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isMesureRefusee, setOppositionMesure } from '../../site/js/shared/oppositionMesure.js'

const createStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('opposition à la mesure d’audience', () => {
  it('est absente par défaut', () => {
    assert.equal(isMesureRefusee(createStorage()), false)
  })

  it('se pose puis se retire', () => {
    const storage = createStorage()
    setOppositionMesure(storage, true)
    assert.equal(isMesureRefusee(storage), true)
    setOppositionMesure(storage, false)
    assert.equal(isMesureRefusee(storage), false)
  })

  it('vaut absence de refus quand le stockage est indisponible ou bloqué', () => {
    assert.equal(isMesureRefusee(undefined), false)
    const bloque = {
      getItem: () => {
        throw new Error('stockage bloqué')
      },
    }
    assert.equal(isMesureRefusee(bloque), false)
  })
})
