import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate'

import { prerenderCatalogPage } from '../../scripts/prerender-catalog.js'
import { formatPrice } from '../../site/js/modules/catalog/domain/price.js'
import { apiImage } from './apiImage.js'
import { renderPage, SITE_DIR } from './renderedPages.js'

const SOURCE = readFileSync(join(SITE_DIR, 'catalogue/plantes-interieur/index.html'), 'utf8')

const product = (overrides) => ({
  id: 1,
  slug: 'monstera-deliciosa',
  name: 'Monstera <deliciosa>',
  categorySlug: 'monstera',
  price: 2990,
  exposure: 'mi-ombre',
  size: 'M',
  inStock: true,
  image: apiImage('p3', [400, 800], { alt: 'Monstera <deliciosa>', ratio: 1 }),
  ...overrides,
})

const RESULT = {
  items: [product(), product({ id: 2, slug: 'calathea', name: 'Calathea', inStock: false })],
  total: 13,
  page: 1,
  pageCount: 2,
  exposureCounts: { soleil: 0, 'mi-ombre': 9, ombre: 4 },
  sizeCounts: { S: 3, M: 6, L: 4 },
  categoryCounts: [{ category: { slug: 'feuillages', name: 'Feuillages' }, count: 7 }],
  attributeFacets: [
    {
      code: 'feuillage',
      label: 'Feuillage <persistant>',
      values: [
        { value: 'persistant', label: 'Persistant', count: 6 },
        { value: 'caduc', label: 'Caduc', count: 0 },
      ],
    },
  ],
}

const outsideTemplates = (html) => html.replace(/<template[\s\S]*?<\/template>/g, '')

const jsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) =>
    JSON.parse(match[1]),
  )

describe('pré-rendu du catalogue', () => {
  const html = prerenderCatalogPage(SOURCE, RESULT)
  const page = outsideTemplates(html)

  it('remplace le message du bloc noscript, pas celui du catalogue vide', () => {
    const noscript = html.match(/data-testid="catalog-noscript">[\s\S]*?<\/noscript>/)?.[0] ?? ''
    const empty = html.match(/data-testid="catalog-empty">[\s\S]*?<\/template>/)?.[0] ?? ''
    assert.ok(noscript.includes('seule la première page'), noscript)
    assert.ok(empty.includes('Aucun produit ne correspond à ces filtres.'), empty)
  })

  it('écrit la première page de produits à partir du template, sans squelette', () => {
    assert.equal(page.match(/data-testid="catalog-product"/g)?.length, 2)
    assert.ok(page.includes('data-product-id="1"'))
    assert.ok(page.includes('id="produit-monstera-deliciosa"'))
    assert.ok(page.includes('alt="Monstera &lt;deliciosa&gt;"'))
    assert.ok(page.includes(formatPrice(2990, 'fr')))
    assert.ok(
      page.includes(
        'srcset="http://localhost:8090/media/p3-400.avif 400w, http://localhost:8090/media/p3-800.avif 800w"',
      ),
    )
    assert.ok(!page.includes('data-testid="catalog-loading"'))
  })

  it('masque le badge de rupture des seuls produits en stock', () => {
    const [first, second] = page.split('data-testid="catalog-product"').slice(1)
    assert.ok(first.includes('data-product-out-of-stock hidden'))
    assert.ok(!second.includes('data-product-out-of-stock hidden'))
  })

  it('écrit les compteurs, la page suivante et la liste JSON-LD', () => {
    assert.match(page, /data-catalog-count[^>]*>13 produits/)
    assert.ok(page.includes('data-count="exposures-mi-ombre">(9)'))
    assert.match(page, /data-count="category-feuillages"\s*>\(7\)/)
    assert.ok(html.includes('<link rel="next" href="/catalogue/plantes-interieur?page=2" />'))
    const list = jsonLd(html).find((data) => data['@type'] === 'ItemList')
    assert.equal(list.numberOfItems, 13)
    assert.equal(list.itemListElement[0].item.offers.price, '29.90')
    assert.equal(list.itemListElement[1].item.offers.availability, 'https://schema.org/OutOfStock')
  })

  it('écrit la facette de chaque attribut filtrable, case à 0 désactivée, formulaire GET', () => {
    assert.ok(page.includes('<summary>Feuillage &lt;persistant&gt;</summary>'))
    assert.match(
      page,
      /<input [^>]*name="attr-feuillage" value="persistant"[^>]*data-testid="catalog-filter-attribute-feuillage-persistant" \/>/,
    )
    assert.ok(page.includes('data-count="attribute-feuillage-persistant">(6)'))
    assert.match(page, /data-testid="catalog-filter-attribute-feuillage-caduc" disabled \/>/)
  })

  it('produit un HTML valide', async () => {
    const report = await new HtmlValidate(new FileSystemConfigLoader()).validateString(
      renderPage(html),
      join(SITE_DIR, 'catalogue/plantes-interieur/index.html'),
    )
    assert.deepEqual(
      report.results.flatMap((result) => result.messages.map((message) => message.message)),
      [],
    )
  })

  it('lit l’URL canonique écrite sur plusieurs lignes par Prettier', () => {
    const source = readFileSync(
      join(SITE_DIR, 'catalogue/plantes-interieur/plantes-a-fleurs/index.html'),
      'utf8',
    )
    assert.ok(
      prerenderCatalogPage(source, RESULT).includes(
        '<link rel="next" href="/catalogue/plantes-interieur/plantes-a-fleurs?page=2" />',
      ),
    )
  })

  it('laisse une catégorie sans produit telle quelle', () => {
    assert.equal(prerenderCatalogPage(SOURCE, { ...RESULT, items: [], total: 0 }), SOURCE)
  })
})
