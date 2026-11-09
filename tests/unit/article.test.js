import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  audioCaption,
  blogHref,
  formatDuration,
  sectionFromSearch,
} from '../../site/js/modules/blog/domain/article.js'

describe('article', () => {
  it('écrit la durée d’un audio en secondes, minutes ou heures', () => {
    assert.equal(formatDuration(4), '4 s')
    assert.equal(formatDuration(1560), '26 min')
    assert.equal(formatDuration(3600), '1 h')
    assert.equal(formatDuration(3900), '1 h 5 min')
  })

  it('légende le lecteur audio avec la durée, puis l’intervenant s’il est saisi', () => {
    const audio = { src: 'a.mp3', type: 'audio/mpeg', durationSeconds: 4 }
    const label = "Écouter l'article ({duration})"
    assert.equal(audioCaption(audio, '', label), "Écouter l'article (4 s)")
    assert.equal(
      audioCaption(audio, 'Présenté par Hina', label),
      "Écouter l'article (4 s) · Présenté par Hina",
    )
  })

  it('lit la rubrique de /blog dans l’adresse, et l’y écrit', () => {
    assert.equal(sectionFromSearch('?rubrique=conseils'), 'conseils')
    assert.equal(sectionFromSearch(''), null)
    assert.equal(sectionFromSearch('?rubrique=<b>'), null)
    assert.equal(blogHref('conseils'), '/blog?rubrique=conseils')
    assert.equal(blogHref(null), '/blog')
  })
})
