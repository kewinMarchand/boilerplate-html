import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { labelsOf } from '../../scripts/prerender-locales.js'
import {
  applyColorScheme,
  colorSchemeLabel,
  currentColorScheme,
} from '../../site/js/shared/colorScheme.js'
import { SITE_DIR } from './renderedPages.js'

// Libellés de la bascule, écrits dans le header partagé
const LABELS = labelsOf(
  readFileSync(join(SITE_DIR, 'partials/header.html'), 'utf8'),
  'data-color-scheme-toggle',
)

const fakeStorage = () => {
  const values = new Map()
  return {
    values,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('applyColorScheme', () => {
  it('pose le thème choisi et le mémorise', () => {
    const root = { dataset: { colorScheme: 'auto' } }
    const storage = fakeStorage()

    applyColorScheme({ root, storage }, 'dark')

    assert.equal(currentColorScheme(root), 'dark')
    assert.equal(storage.values.get('color-scheme'), 'dark')
  })

  it('« système » remet auto et le mémorise', () => {
    const root = { dataset: { colorScheme: 'light' } }
    const storage = fakeStorage()
    storage.setItem('color-scheme', 'light')

    applyColorScheme({ root, storage }, 'auto')

    assert.equal(root.dataset.colorScheme, 'auto')
    assert.equal(storage.values.get('color-scheme'), 'auto')
  })

  it('reste utilisable quand le stockage est indisponible', () => {
    const root = { dataset: {} }

    applyColorScheme({ root, storage: undefined }, 'dark')

    assert.equal(root.dataset.colorScheme, 'dark')
  })

  it('lit auto pour une valeur inconnue', () => {
    assert.equal(currentColorScheme({ dataset: { colorScheme: 'violet' } }), 'auto')
  })
})

describe('colorSchemeLabel', () => {
  it('nomme le thème courant', () => {
    assert.equal(colorSchemeLabel('auto', false, LABELS), 'Thème : système')
    assert.equal(colorSchemeLabel('dark', false, LABELS), 'Thème : sombre')
  })

  it('signale un choix suspendu par le mode renforcé, sauf le clair', () => {
    assert.equal(
      colorSchemeLabel('dark', true, LABELS),
      "Thème : sombre, suspendu par l'accessibilité renforcée",
    )
    assert.equal(colorSchemeLabel('light', true, LABELS), 'Thème : clair')
  })
})
