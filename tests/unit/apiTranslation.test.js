import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  toArticleDetail,
  toArticles,
} from '../../site/js/modules/blog/infrastructure/http/articleTranslation.js'
import { DEFAULT_QUERY } from '../../site/js/modules/catalog/domain/catalogQuery.js'
import {
  toFacetsQuery,
  toProductDetail,
  toProducts,
  toProductsQuery,
  toSearchResult,
} from '../../site/js/modules/catalog/infrastructure/http/catalogTranslation.js'
import { toFieldErrors } from '../../site/js/modules/contact/infrastructure/http/contactTranslation.js'
import { toLegalPage } from '../../site/js/modules/content/infrastructure/http/legalPageTranslation.js'
import { toTasks } from '../../site/js/modules/task/infrastructure/http/taskTranslation.js'
import { ApiContractError } from '../../site/js/shared/api.js'
import { apiImage } from './apiImage.js'

const PRODUCT_IMAGE = apiImage('a', [400, 640, 800], { alt: 'Heliconia rostrata' })

const PRODUCT = {
  id: 1,
  slug: 'monstera-deliciosa',
  name: 'Monstera deliciosa',
  categorySlug: 'monstera',
  exposure: 'mi-ombre',
  size: 'M',
  inStock: true,
  image: null,
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
    assert.deepEqual(toFacetsQuery('feuillages', { ...DEFAULT_QUERY, sort: 'nom', page: 3 }), {
      category: 'feuillages',
      'exposure[]': [],
      'size[]': [],
    })
  })

  it('traduit une liste de produits et ses facettes', () => {
    const result = toSearchResult(
      [PRODUCT],
      {
        totalItems: 6,
        exposure: [{ value: 'mi-ombre', count: 4 }],
        size: [{ value: 'M', count: 2 }],
        category: [{ slug: 'monstera', name: 'Monstera', count: 3 }],
      },
      1,
    )
    assert.equal(result.items[0].price, 3490)
    assert.deepEqual(result.exposureCounts, { soleil: 0, 'mi-ombre': 4, ombre: 0 })
    assert.deepEqual(result.categoryCounts, [
      { category: { slug: 'monstera', name: 'Monstera' }, count: 3 },
    ])
  })

  it('calcule le nombre de pages à partir du total des facettes, au moins une', () => {
    const facets = (totalItems) => ({ totalItems, exposure: [], size: [], category: [] })
    const result = toSearchResult([], facets(25), 3)
    assert.equal(result.total, 25)
    assert.equal(result.page, 3)
    assert.equal(result.pageCount, 3)
    assert.equal(toSearchResult([], facets(0), 1).pageCount, 1)
  })

  it('traduit les produits à la une, la fiche produit et les pages légales', () => {
    const product = {
      id: 16,
      slug: 'heliconia-rostrata',
      name: 'Heliconia rostrata',
      categorySlug: 'heliconia',
      price: 5490,
      exposure: 'soleil',
      size: 'L',
      inStock: true,
      image: PRODUCT_IMAGE,
    }
    assert.deepEqual(toProducts([product]), [product])
    const detail = toProductDetail({
      ...product,
      categoryPath: [
        { slug: 'plantes-exterieur', name: 'Plantes d’extérieur' },
        { slug: 'heliconia', name: 'Heliconia' },
      ],
      description: '',
    })
    assert.deepEqual(
      detail.categoryPath.map(({ href }) => href),
      ['/catalogue/plantes-exterieur', '/catalogue/plantes-exterieur/heliconia'],
    )
    assert.deepEqual(detail.description, [])
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

  it('découpe la description de la fiche produit en paragraphes aux lignes vides', () => {
    const detail = toProductDetail({
      ...PRODUCT,
      categoryPath: [{ slug: 'monstera', name: 'Monstera' }],
      description: 'Rustique.\n\n  \nRésiste au vent,\naux embruns.',
    })
    assert.deepEqual(detail.description, ['Rustique.', 'Résiste au vent,\naux embruns.'])
  })

  it('traduit la fiche d’un article, texte en HTML compris', () => {
    const dto = {
      id: 2,
      slug: 'un-carrousel',
      title: 'Un carrousel',
      excerpt: '',
      publishedAt: '2026-09-22',
      image: null,
      html: '<p>Texte.</p>\n',
    }
    assert.deepEqual(toArticleDetail(dto), { ...dto, id: '2' })
    assert.throws(() => toArticleDetail({ ...dto, html: null }), ApiContractError)
  })

  it('refuse une réponse qui ne suit pas le contrat', () => {
    assert.throws(() => toTasks([{ id: '1', title: 'x', done: false }]), ApiContractError)
    assert.throws(() => toArticles({}), ApiContractError)
    assert.throws(() => toProducts({}), ApiContractError)
    assert.throws(
      () => toLegalPage({ slug: 'a', title: 'A', introduction: '', sections: [{ title: 'B' }] }),
      ApiContractError,
    )
    assert.throws(
      () =>
        toSearchResult(
          [{ ...PRODUCT, exposure: 'lune' }],
          { totalItems: 1, exposure: [], size: [], category: [] },
          1,
        ),
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
