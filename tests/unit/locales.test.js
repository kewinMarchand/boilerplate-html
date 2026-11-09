import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it } from 'node:test'

import { CATEGORIES } from '../../lib/categoryTree.js'
import {
  categoryTranslations,
  labelsOf,
  languageSwitcher,
  localizedSitemap,
  pageLocales,
  readDictionary,
  translatePage,
  translationTable,
  UNTRANSLATED_PAGES,
  withAlternates,
} from '../../scripts/prerender-locales.js'
import { sitePages } from '../../scripts/ssi.js'
import { countLabel, formatLabel } from '../../site/js/shared/labels.js'
import { languageTag, prefixPath } from '../../site/js/shared/locale.js'
import { SITE_DIR } from './renderedPages.js'

const FR = readDictionary('fr')
const EN = readDictionary('en')
const LOCALES = ['fr', 'en']
const SITE_URL = 'https://www.example.com'
const read = (file) => readFileSync(join(SITE_DIR, file), 'utf8')
const NO_CATEGORIES = { paths: new Map(), slugs: new Map(), labels: new Map() }

const english = (categories = NO_CATEGORIES) => ({
  table: translationTable(FR, EN),
  dictionary: EN,
  categories,
  locale: 'en',
  locales: LOCALES,
  siteUrl: SITE_URL,
})

describe('fichiers de traduction', () => {
  it('ont les mêmes clés en français et en anglais, sans libellé vide', () => {
    assert.deepEqual(Object.keys(EN).toSorted(), Object.keys(FR).toSorted())
    for (const [key, text] of [...Object.entries(FR), ...Object.entries(EN)]) {
      assert.ok(text.trim(), key)
    }
  })

  it('ne traduisent jamais un même texte français de deux façons', () => {
    assert.doesNotThrow(() => translationTable(FR, EN))
    assert.throws(() => translationTable({ a: 'Fermer', b: 'Fermer' }, { a: 'Close', b: 'Shut' }), {
      message: 'Libellé ambigu : « Fermer » (b)',
    })
  })

  it('couvrent chaque texte et chaque libellé des pages et des partials', () => {
    // Les noms des catégories viennent de l'API, dans la langue de la page
    const categories = {
      ...NO_CATEGORIES,
      labels: new Map(CATEGORIES.map(({ name }) => [name, name])),
    }
    const files = [
      ...sitePages(SITE_DIR)
        .map((file) => relative(SITE_DIR, file))
        .filter((file) => ![...UNTRANSLATED_PAGES, 'charte-graphique/index.html'].includes(file)),
      'partials/header.html',
      'partials/footer.html',
    ]
    for (const file of files) {
      const { missing } = translatePage(read(file), english(categories))
      assert.deepEqual([...missing], [], file)
    }
  })

  it('prennent les libellés français pour une langue sans fichier', () => {
    assert.equal(readDictionary('de'), null)
    assert.equal(translationTable(FR, null).get('Réessayer'), 'Réessayer')
  })
})

describe('libellés des scripts', () => {
  it('remplacent les valeurs nommées', () => {
    assert.equal(formatLabel('Retour : {name}', { name: 'Menu' }), 'Retour : Menu')
  })

  it('accordent le nombre selon la langue', () => {
    const fr = { one: '{count} produit', other: '{count} produits' }
    const en = { one: '{count} product', other: '{count} products' }
    assert.deepEqual(
      [0, 1, 2].map((count) => countLabel(count, fr, 'fr')),
      ['0 produit', '1 produit', '2 produits'],
    )
    assert.deepEqual(
      [0, 1, 2].map((count) => countLabel(count, en, 'en')),
      ['0 products', '1 product', '2 products'],
    )
    assert.equal(
      countLabel(2, { one: '{count} sur {total}', other: '{count} sur {total}' }, 'fr', {
        total: 5,
      }),
      '2 sur 5',
    )
  })

  it('sont lus dans la page, entités décodées, sous la forme de son dataset', () => {
    const labels = labelsOf(read('produit/fiche.html'), 'data-product-page')
    assert.equal(labels.labelThumb, "Voir l'image {number} sur {count}")
    assert.equal(labels.labelExposurePartialShade, 'Mi-ombre')
  })
})

describe('adresses dans la langue', () => {
  it('préfixent toute langue sauf celle par défaut', () => {
    assert.equal(prefixPath('/catalogue', 'fr', LOCALES), '/catalogue')
    assert.equal(prefixPath('/catalogue', 'en', LOCALES), '/en/catalogue')
    assert.equal(prefixPath('/', 'en', LOCALES), '/en')
    assert.equal(prefixPath('/', 'fr', ['fr']), '/')
  })

  it('donnent l’étiquette de langue avec sa région', () => {
    assert.equal(languageTag('fr'), 'fr-FR')
    assert.equal(languageTag('en'), 'en-US')
  })
})

describe('page traduite', () => {
  const sourceTree = [
    {
      slug: 'plantes-interieur',
      name: 'Plantes d’intérieur',
      children: [{ slug: 'feuillages', name: 'Feuillages', children: [] }],
    },
  ]
  const englishTree = [
    {
      slug: 'indoor-plants',
      name: 'Indoor plants',
      alternates: [
        { locale: 'fr', slug: 'plantes-interieur' },
        { locale: 'en', slug: 'indoor-plants' },
      ],
      children: [
        {
          slug: 'foliage-plants',
          name: 'Foliage plants',
          alternates: [
            { locale: 'fr', slug: 'feuillages' },
            { locale: 'en', slug: 'foliage-plants' },
          ],
          children: [],
        },
      ],
    },
  ]
  const categories = categoryTranslations(sourceTree, englishTree, 'fr')
  const { html } = translatePage(
    read('catalogue/plantes-interieur/index.html'),
    english(categories),
  )

  it('lit les chemins, slugs et noms des catégories dans l’arbre de l’API', () => {
    assert.equal(
      categories.paths.get('/catalogue/plantes-interieur/feuillages'),
      '/catalogue/indoor-plants/foliage-plants',
    )
    assert.equal(categories.slugs.get('feuillages'), 'foliage-plants')
    assert.equal(categories.labels.get('Plantes d’intérieur'), 'Indoor plants')
  })

  it('traduit textes, attributs, libellés des scripts et titre', () => {
    assert.match(html, /<title>Indoor plants · Catalogue · Boilerplate HTML<\/title>/)
    assert.match(html, /<h1 id="catalog-title" tabindex="-1">Indoor plants<\/h1>/)
    assert.ok(html.includes('aria-label="Breadcrumb"'))
    assert.ok(html.includes('data-label-results-other="{count} products"'))
    assert.ok(
      html.includes(
        'content="Demo catalogue of a fictional tropical garden centre, indoor plants: plants to filter by exposure, size, price and stock."',
      ),
    )
    assert.ok(!html.includes('Chargement'))
  })

  it('préfixe les liens internes et les partials, garde les fichiers', () => {
    assert.ok(html.includes('href="/en/catalogue/indoor-plants/foliage-plants"'))
    assert.ok(html.includes('action="/en/catalogue/indoor-plants"'))
    assert.ok(html.includes('<a class="bui-link" href="/en">Home</a>'))
    assert.ok(html.includes('<!--# include virtual="/en/partials/header.html" -->'))
    assert.ok(html.includes('href="/css/main.css"'))
    assert.ok(html.includes('<use href="/icons.svg#info"></use>'))
    assert.ok(html.includes('data-category="indoor-plants"'))
    assert.ok(html.includes('data-count="category-foliage-plants"'))
  })

  it('traduit les données structurées', () => {
    const breadcrumb = JSON.parse(
      html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1],
    )
    assert.deepEqual(
      breadcrumb.itemListElement.map(({ name, item }) => [name, item]),
      [
        ['Home', `${SITE_URL}/en`],
        ['Catalogue', `${SITE_URL}/en/catalogue`],
        ['Indoor plants', `${SITE_URL}/en/catalogue/indoor-plants`],
      ],
    )
    const home = translatePage(read('index.html'), english()).html
    assert.match(home, /"inLanguage":"en-US"/)
  })
})

describe('langues d’une page', () => {
  const paths = { fr: '/catalogue', en: '/en/catalogue' }
  const page = withAlternates(read('catalogue/index.html'), {
    locale: 'fr',
    locales: LOCALES,
    paths,
  })

  it('écrit la langue, la canonique, og:locale, hreflang et x-default', () => {
    assert.deepEqual(pageLocales(page), { locale: 'fr', locales: LOCALES })
    assert.match(page, /<html lang="fr" data-locales="fr en" data-color-scheme="auto">/)
    assert.ok(page.includes(`<link rel="canonical" href="${SITE_URL}/catalogue" />`))
    assert.ok(page.includes('<meta property="og:locale" content="fr_FR" />'))
    assert.ok(page.includes('<meta property="og:locale:alternate" content="en_US" />'))
    for (const [code, path] of [
      ['fr', '/catalogue'],
      ['en', '/en/catalogue'],
      ['x-default', '/catalogue'],
    ]) {
      assert.ok(
        page.includes(`<link rel="alternate" hreflang="${code}" href="${SITE_URL}${path}" />`),
      )
    }
    assert.ok(page.includes('<!--# set var="locale_en" value="/en/catalogue" -->'))
  })

  it('se rejoue sans doublon, et mène à l’accueil d’une langue sans équivalent', () => {
    const detail = withAlternates(page, {
      locale: 'fr',
      locales: LOCALES,
      paths: { fr: '/catalogue' },
    })
    assert.equal(detail.match(/hreflang=/g).length, 2)
    assert.ok(!detail.includes('og:locale:alternate'))
    assert.ok(detail.includes('<!--# set var="locale_en" value="/en" -->'))
    assert.equal(detail.match(/set var="locale_fr"/g).length, 1)
  })

  it('reste inchangée sur un site d’une seule langue', () => {
    assert.deepEqual(pageLocales(read('catalogue/index.html')), { locale: 'fr', locales: ['fr'] })
  })
})

describe('sélecteur de langue', () => {
  const switcher = languageSwitcher('en', LOCALES, 'Languages')

  it('nomme chaque langue dans sa langue, la courante marquée', () => {
    assert.match(switcher, /<nav class="container language-switcher" aria-label="Languages"/)
    assert.match(switcher, /lang="fr" hreflang="fr" data-testid="layout-language-fr">Français</)
    assert.match(
      switcher,
      /lang="en" hreflang="en" aria-current="true" data-testid="layout-language-en">English</,
    )
    assert.equal(switcher.match(/aria-current/g).length, 1)
  })
})

describe('sitemap', () => {
  const xml = read('sitemap.xml')

  it('donne une entrée par langue, chacune avec ses équivalents', () => {
    const alternates = (loc) => [
      ['fr', loc],
      ['en', loc.replace(SITE_URL, `${SITE_URL}/en`)],
      ['x-default', loc],
    ]
    const sitemap = localizedSitemap(xml, alternates)
    assert.ok(sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'))
    assert.equal(sitemap.match(/<url>/g).length, xml.match(/<url>/g).length * 2)
    assert.ok(
      sitemap.includes(
        `<url><loc>${SITE_URL}/en/catalogue</loc><xhtml:link rel="alternate" hreflang="fr" href="${SITE_URL}/catalogue"/><xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/catalogue"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/catalogue"/></url>`,
      ),
    )
  })

  it('garde une adresse sans équivalent telle quelle', () => {
    const sitemap = localizedSitemap(xml, () => [])
    assert.equal(sitemap.match(/<url>/g).length, xml.match(/<url>/g).length)
  })
})
