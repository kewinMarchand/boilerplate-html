import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { toArticles } from '../../site/js/modules/blog/infrastructure/http/articleTranslation.js'
import { DEFAULT_QUERY } from '../../site/js/modules/catalog/domain/catalogQuery.js'
import {
  toProductsQuery,
  toSearchResult,
} from '../../site/js/modules/catalog/infrastructure/http/catalogTranslation.js'
import { toFieldErrors } from '../../site/js/modules/contact/infrastructure/http/contactTranslation.js'
import { toLegalPage } from '../../site/js/modules/content/infrastructure/http/legalPageTranslation.js'
import { toSlides } from '../../site/js/modules/content/infrastructure/http/slideTranslation.js'
import { toTasks } from '../../site/js/modules/task/infrastructure/http/taskTranslation.js'
import { ApiContractError } from '../../site/js/shared/api.js'

const PRODUCT = {
  id: 1,
  slug: 'monstera-deliciosa',
  name: 'Monstera deliciosa',
  categorySlug: 'monstera',
  exposure: 'mi-ombre',
  size: 'M',
  inStock: true,
  image: 1,
  price: 3490,
}

describe('traduction des réponses de l’API', () => {
  it('traduit les filtres de l’URL en paramètres de l’API', () => {
    assert.deepEqual(
      toProductsQuery('feuillages', {
        ...DEFAULT_QUERY,
        exposures: ['ombre'],
        priceMin: 10.5,
        inStock: true,
        sort: 'prix-desc',
        page: 2,
      }),
      {
        category: 'feuillages',
        'exposure[]': ['ombre'],
        'size[]': [],
        priceMin: 1050,
        inStock: true,
        'order[price]': 'desc',
        page: 2,
        itemsPerPage: 12,
      },
    )
  })

  it('traduit une liste de produits et ses facettes', () => {
    const result = toSearchResult({
      items: [PRODUCT],
      totalItems: 6,
      page: 1,
      itemsPerPage: 12,
      totalPages: 1,
      facets: {
        exposure: [{ value: 'mi-ombre', count: 4 }],
        size: [{ value: 'M', count: 2 }],
        category: [{ slug: 'monstera', name: 'Monstera', count: 3 }],
      },
    })
    assert.equal(result.items[0].price, 3490)
    assert.deepEqual(result.exposureCounts, { soleil: 0, 'mi-ombre': 4, ombre: 0 })
    assert.deepEqual(result.categoryCounts, [
      { category: { slug: 'monstera', name: 'Monstera' }, count: 3 },
    ])
  })

  it('traduit les diapositives et les pages légales', () => {
    assert.deepEqual(
      toSlides([{ id: 1, slug: 'heliconia', title: 'Heliconia', text: 'Des bractées.', image: 1 }]),
      [{ id: '1', slug: 'heliconia', title: 'Heliconia', text: 'Des bractées.', image: 1 }],
    )
    assert.deepEqual(
      toLegalPage({
        slug: 'accessibilite',
        title: 'Déclaration',
        introduction: '<p>Avant-propos.</p>',
        sections: [{ title: 'État de conformité', html: '<p>Non conforme.</p>' }],
      }),
      {
        slug: 'accessibilite',
        title: 'Déclaration',
        introduction: '<p>Avant-propos.</p>',
        sections: [{ title: 'État de conformité', html: '<p>Non conforme.</p>' }],
      },
    )
  })

  it('refuse une réponse qui ne suit pas le contrat', () => {
    assert.throws(() => toTasks([{ id: '1', title: 'x', done: false }]), ApiContractError)
    assert.throws(() => toArticles({}), ApiContractError)
    assert.throws(
      () => toSlides([{ id: 1, slug: 'a', title: 'A', text: '', image: '1' }]),
      ApiContractError,
    )
    assert.throws(
      () => toLegalPage({ slug: 'a', title: 'A', introduction: '', sections: [{ title: 'B' }] }),
      ApiContractError,
    )
    assert.throws(
      () => toSearchResult({ items: [{ ...PRODUCT, exposure: 'lune' }], facets: {} }),
      ApiContractError,
    )
  })

  it('relaie les violations 422 vers les champs du formulaire', () => {
    assert.deepEqual(
      toFieldErrors({
        violations: [
          { propertyPath: 'email', message: 'Indiquez une adresse e-mail valide.' },
          { propertyPath: 'inconnu', message: 'ignoré' },
        ],
      }),
      [{ field: 'email', message: 'Indiquez une adresse e-mail valide.' }],
    )
    assert.deepEqual(toFieldErrors(null), [])
  })
})
