import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  clearFilters,
  countActiveFilters,
  DEFAULT_QUERY,
  isFiltered,
  parseQuery,
  serializeQuery,
  withFilters,
} from '../../site/js/modules/catalog/domain/catalogQuery.js'
import { activeFilters } from '../../site/js/modules/catalog/ui/activeFilters.js'
import { formatResultsCount } from '../../site/js/modules/catalog/ui/labels.js'
import { paginationWindow } from '../../site/js/modules/catalog/ui/pagination.js'

describe('requête du catalogue', () => {
  it('fait l’aller-retour URL vers requête vers URL', () => {
    const url =
      'exposition=soleil&exposition=ombre&taille=L&prix_min=10&prix_max=50&en_stock=1&tri=prix-asc&vue=liste&page=2'
    assert.equal(serializeQuery(parseQuery(new URLSearchParams(url))), url)
  })

  it('fait l’aller-retour des attributs, une valeur par occurrence de attr-<code>', () => {
    const url = 'taille=M&attr-feuillage=persistant&attr-feuillage=caduc&attr-hauteur-adulte=300'
    const query = parseQuery(new URLSearchParams(url))
    assert.deepEqual(query.attributes, {
      feuillage: ['persistant', 'caduc'],
      'hauteur-adulte': ['300'],
    })
    assert.equal(serializeQuery(query), url)
    assert.equal(countActiveFilters(query), 4)
  })

  it('ignore les valeurs invalides', () => {
    const query = parseQuery(
      new URLSearchParams(
        'exposition=lune&taille=XL&prix_min=-3&tri=hasard&vue=mosaique&page=1&en_stock=oui&attr-Feuillage=caduc&attr-feuillage=Caduc&attr-=x',
      ),
    )
    assert.deepEqual(query, DEFAULT_QUERY)
    assert.equal(serializeQuery(query), '')
  })

  it('remet la page à 1 et conserve la vue à chaque changement de filtre', () => {
    const query = { ...DEFAULT_QUERY, view: 'liste', page: 3 }
    const next = withFilters(query, { sizes: ['M'] })
    assert.equal(next.page, 1)
    assert.equal(next.view, 'liste')
    assert.deepEqual(clearFilters({ ...next, sort: 'nom' }), { ...DEFAULT_QUERY, view: 'liste' })
  })

  it('compte et décrit les filtres actifs', () => {
    const query = { ...DEFAULT_QUERY, exposures: ['mi-ombre'], priceMax: 30, inStock: true }
    assert.equal(countActiveFilters(query), 3)
    assert.deepEqual(
      activeFilters(query).map((filter) => filter.label),
      ['Mi-ombre', 'Prix maximum : 30 €', 'En stock'],
    )
    const attributes = { ...DEFAULT_QUERY, attributes: { feuillage: ['caduc', 'inconnue'] } }
    const facets = [
      {
        code: 'feuillage',
        label: 'Feuillage',
        values: [{ value: 'caduc', label: 'Caduc', count: 2 }],
      },
    ]
    const filters = activeFilters(attributes, facets)
    assert.deepEqual(
      filters.map((filter) => filter.label),
      ['Caduc', 'inconnue'],
    )
    assert.deepEqual(withFilters(attributes, filters[0].remove(attributes)).attributes, {
      feuillage: ['inconnue'],
    })
    assert.equal(isFiltered(attributes), true)
    assert.deepEqual(clearFilters(attributes).attributes, {})
    assert.equal(isFiltered(DEFAULT_QUERY), false)
    assert.equal(isFiltered({ ...DEFAULT_QUERY, sort: 'nom' }), true)
  })
})

describe('pagination et formats', () => {
  it('affiche toutes les pages jusqu’à 7', () => {
    assert.deepEqual(paginationWindow(3, 7), [1, 2, 3, 4, 5, 6, 7])
  })

  it('insère des ellipses au-delà de 7 pages', () => {
    assert.deepEqual(paginationWindow(5, 10), [1, '…', 4, 5, 6, '…', 10])
    assert.deepEqual(paginationWindow(1, 10), [1, 2, '…', 10])
    assert.deepEqual(paginationWindow(10, 10), [1, '…', 9, 10])
  })

  it('formate les compteurs', () => {
    assert.equal(formatResultsCount(1), '1 produit')
    assert.equal(formatResultsCount(12), '12 produits')
  })
})
