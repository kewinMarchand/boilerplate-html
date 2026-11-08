import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate'

import {
  prerenderArticle,
  prerenderBlogList,
  prerenderCarousel,
  prerenderLegalPage,
  prerenderProduct,
  withArticlesInSitemap,
  withCategoryHrefs,
  withPagesInSitemap,
} from '../../scripts/prerender-content.js'
import { apiImage } from './apiImage.js'
import { renderPage, SITE_DIR } from './renderedPages.js'

const HOME = readFileSync(join(SITE_DIR, 'index.html'), 'utf8')
const LEGAL = readFileSync(join(SITE_DIR, 'accessibilite/index.html'), 'utf8')
const BLOG = readFileSync(join(SITE_DIR, 'blog/index.html'), 'utf8')
const FICHE = readFileSync(join(SITE_DIR, 'blog/fiche.html'), 'utf8')
const PRODUCT_FICHE = readFileSync(join(SITE_DIR, 'produit/fiche.html'), 'utf8')

const PRODUCTS = [
  {
    id: 16,
    slug: 'heliconia-rostrata',
    name: 'Heliconia <rouge> $1',
    categorySlug: 'heliconia',
    price: 5490,
    exposure: 'soleil',
    size: 'L',
    inStock: true,
    image: null,
  },
  {
    id: 7,
    slug: 'anthurium-andreanum-rouge',
    name: 'Anthurium',
    categorySlug: 'anthurium',
    price: 2490,
    exposure: 'mi-ombre',
    size: 'M',
    inStock: false,
    image: apiImage('s2', [400, 640, 800]),
  },
]

const LEGAL_PAGE = {
  slug: 'accessibilite',
  title: 'Déclaration d’accessibilité',
  introduction: '<p>Avant-propos.</p>',
  sections: [
    { title: 'État de conformité', html: '<p>Ce site est <strong>non conforme</strong>.</p>' },
    {
      title: 'Voies de recours',
      html: '<ul>\n<li><a href="https://example.com/">Lien</a> $&amp;</li>\n</ul>',
    },
  ],
}

const outsideTemplates = (html) => html.replace(/<template[\s\S]*?<\/template>/g, '')

const validate = async (html, file) => {
  const report = await new HtmlValidate(new FileSystemConfigLoader()).validateString(
    renderPage(html),
    join(SITE_DIR, file),
  )
  return report.results.flatMap((result) => result.messages.map((message) => message.message))
}

describe('pré-rendu du carrousel', () => {
  const html = prerenderCarousel(HOME, PRODUCTS)
  const page = outsideTemplates(html)

  it('écrit une diapositive par produit, liée à sa fiche, sans squelette ni message sans JavaScript', () => {
    assert.equal(page.match(/data-testid="carousel-slide"/g)?.length, 2)
    assert.ok(page.includes('aria-label="1 sur 2"'))
    assert.ok(page.includes('Heliconia &lt;rouge&gt; $1'))
    assert.ok(page.includes('href="/produit/heliconia-rostrata"'))
    assert.match(page, /54,90\s€/)
    assert.ok(page.includes('http://localhost:8090/media/s2-800.avif 800w'))
    assert.equal(page.match(/<picture>/g)?.length, 1)
    assert.ok(!page.includes('data-testid="home-carousel-loading"'))
    assert.ok(!page.includes('data-testid="home-carousel-noscript"'))
  })

  it('produit un HTML valide', async () => {
    assert.deepEqual(await validate(html, 'index.html'), [])
  })

  it('laisse l’accueil tel quel sans produit à la une', () => {
    assert.equal(prerenderCarousel(HOME, []), HOME)
  })
})

describe('pré-rendu des pages légales', () => {
  const html = prerenderLegalPage(LEGAL, LEGAL_PAGE)
  const page = outsideTemplates(html)

  it('écrit le titre, l’introduction et chaque section avec son HTML tel quel', () => {
    assert.match(page, /<h1 data-legal-title>Déclaration d’accessibilité<\/h1>/)
    assert.ok(page.includes('<p>Avant-propos.</p>'))
    assert.equal(page.match(/data-testid="legal-section"/g)?.length, 2)
    assert.ok(page.includes('<p>Ce site est <strong>non conforme</strong>.</p>'))
    assert.ok(page.includes('<a href="https://example.com/">Lien</a> $&amp;'))
    assert.ok(!page.includes('data-testid="legal-loading"'))
    assert.ok(!page.includes('data-testid="legal-noscript"'))
  })

  it('produit un HTML valide', async () => {
    assert.deepEqual(await validate(html, 'accessibilite/index.html'), [])
  })
})

describe('pré-rendu de la liste des articles', () => {
  const ARTICLES = [
    {
      id: '3',
      slug: 'le-mode-renforce',
      title: 'Le mode <renforcé> $1',
      excerpt: 'Texte agrandi.',
      publishedAt: '2026-10-01',
      image: apiImage('a3', [480, 960], { alt: 'Mode renforcé' }),
    },
    {
      id: '2',
      slug: 'un-carrousel',
      title: 'Un carrousel',
      excerpt: 'Défilement natif.',
      publishedAt: '2026-09-22',
      image: null,
    },
  ]
  const html = prerenderBlogList(BLOG, ARTICLES)
  const page = outsideTemplates(html)

  it('écrit une carte par article, liée à sa fiche, sans squelette ni message sans JavaScript', () => {
    assert.equal(page.match(/data-testid="blog-card"/g)?.length, 2)
    assert.ok(
      page.includes('href="/blog/le-mode-renforce" data-blog-title>Le mode &lt;renforcé&gt; $1'),
    )
    assert.ok(page.includes('data-blog-excerpt>Texte agrandi.'))
    assert.ok(page.includes('<time data-blog-date datetime="2026-09-22">22 septembre 2026'))
    assert.ok(page.includes('srcset="http://localhost:8090/media/a3-480.avif 480w'))
    assert.equal(page.match(/<picture/g)?.length, 1)
    assert.ok(!page.includes('data-testid="blog-loading"'))
    assert.ok(!page.includes('data-testid="blog-noscript"'))
  })

  it('produit un HTML valide', async () => {
    assert.deepEqual(await validate(html, 'blog/index.html'), [])
  })

  it('laisse la page telle quelle sans article', () => {
    assert.equal(prerenderBlogList(BLOG, []), BLOG)
  })
})

describe('pré-rendu d’une fiche article', () => {
  const ARTICLE = {
    id: '2',
    slug: 'un-carrousel',
    title: 'Un carrousel <accessible>',
    excerpt: 'Défilement natif.',
    publishedAt: '2026-09-22',
    image: apiImage('a2', [480, 960], { alt: 'Piste du carrousel' }),
    html: '<p>Premier paragraphe.</p>\n<h2>Intertitre</h2>\n',
  }
  const html = prerenderArticle(FICHE, ARTICLE, 'https://www.example.com')
  const page = outsideTemplates(html)

  it('écrit le titre, la date, l’image, le chapeau et le texte, sans squelette ni message sans JavaScript', () => {
    assert.ok(page.includes('data-testid="article-title">Un carrousel &lt;accessible&gt;'))
    assert.ok(page.includes('<time data-article-date datetime="2026-09-22">22 septembre 2026'))
    assert.ok(page.includes('srcset="http://localhost:8090/media/a2-480.avif 480w'))
    assert.ok(page.includes('alt="Piste du carrousel"'))
    assert.ok(page.includes('data-article-excerpt>Défilement natif.'))
    assert.ok(page.includes('<h2>Intertitre</h2>'))
    assert.ok(page.includes('<div data-article-content>'))
    assert.ok(!page.includes('data-testid="article-loading"'))
    assert.ok(!page.includes('data-testid="article-noscript"'))
  })

  it('écrit l’en-tête d’un article indexable, avec ses données structurées', () => {
    assert.ok(html.includes('<title>Un carrousel &lt;accessible&gt; · Boilerplate HTML</title>'))
    assert.ok(html.includes('<meta name="robots" content="index, follow" />'))
    assert.ok(
      html.includes('<link rel="canonical" href="https://www.example.com/blog/un-carrousel"'),
    )
    assert.ok(html.includes('<meta property="og:type" content="article" />'))
    assert.ok(html.includes('content="http://localhost:8090/media/a2-960.webp"'))
    assert.ok(html.includes('"@type":"BlogPosting"'))
    assert.ok(html.includes('"@type":"BreadcrumbList"'))
    assert.ok(html.includes('"position":2,"name":"Blog","item":"https://www.example.com/blog"'))
  })

  it('produit un HTML valide', async () => {
    assert.deepEqual(await validate(html, 'blog/un-carrousel/index.html'), [])
  })

  it('ajoute les fiches au sitemap', () => {
    assert.equal(
      withArticlesInSitemap('<urlset>\n</urlset>', ['a', 'b'], 'https://www.example.com/'),
      '<urlset>\n  <url><loc>https://www.example.com/blog/a</loc></url>\n  <url><loc>https://www.example.com/blog/b</loc></url>\n</urlset>',
    )
  })
})

describe('pré-rendu d’une fiche produit', () => {
  const product = withCategoryHrefs({
    ...PRODUCTS[1],
    categoryPath: [
      { slug: 'plantes-interieur', name: 'Plantes d’intérieur' },
      { slug: 'plantes-a-fleurs', name: 'Plantes à fleurs' },
      { slug: 'anthurium', name: 'Anthurium' },
    ],
    description: 'Spathes <rouges> $1.\n\nArrosage modéré.',
    attributes: [
      { label: 'Feuillage', valueLabel: 'Persistant <vert> $1', unit: null },
      { label: 'Hauteur adulte', valueLabel: '300', unit: 'cm' },
    ],
  })
  const html = prerenderProduct(PRODUCT_FICHE, product, 'https://www.example.com/')

  it('écrit le contenu, le fil d’Ariane, l’indexation et les données structurées', () => {
    assert.ok(html.includes('<title>Anthurium · Boilerplate HTML</title>'))
    assert.ok(html.includes('<meta name="robots" content="index, follow" />'))
    assert.ok(html.includes('href="https://www.example.com/produit/anthurium-andreanum-rouge"'))
    assert.ok(html.includes('href="/catalogue/plantes-interieur/plantes-a-fleurs/anthurium"'))
    assert.ok(html.includes('Rupture de stock'))
    assert.ok(html.includes('"@type":"Product"'))
    assert.ok(html.includes('"price":"24.90"'))
    assert.ok(html.includes('"availability":"https://schema.org/OutOfStock"'))
    assert.ok(!html.includes('data-product-content hidden'))
    assert.ok(!html.includes('data-testid="product-noscript"'))
  })

  it('écrit la description, un paragraphe échappé par bloc, et la reprend dans les données structurées', () => {
    assert.ok(
      html.includes(
        'data-testid="product-description"><p>Spathes &lt;rouges&gt; $1.</p><p>Arrosage modéré.</p></div>',
      ),
    )
    assert.ok(html.includes('"description":"Spathes \\u003crouges> $1. Arrosage modéré."'))
  })

  it('écrit les attributs en liste de définitions, et la retire sans attribut', () => {
    assert.match(
      html,
      /data-testid="product-attributes"\s*><dt>Feuillage<\/dt><dd>Persistant &lt;vert&gt; \$1<\/dd><dt>Hauteur adulte<\/dt><dd>300\u00a0cm<\/dd><\/dl>/,
    )
    const without = prerenderProduct(
      PRODUCT_FICHE,
      { ...product, attributes: [] },
      'https://www.example.com/',
    )
    assert.ok(!without.includes('product-attributes'))
  })

  it('laisse la description cachée, et hors des données structurées, quand elle est vide', () => {
    const empty = prerenderProduct(
      PRODUCT_FICHE,
      { ...product, description: [] },
      'https://www.example.com/',
    )
    assert.match(empty, /data-testid="product-description"\s*hidden\s*><\/div>/)
    assert.ok(!empty.includes('"description":'))
  })

  it('produit un HTML valide', async () => {
    assert.deepEqual(await validate(html, 'produit/fiche.html'), [])
  })

  it('ajoute les fiches au sitemap', () => {
    assert.ok(
      withPagesInSitemap(
        '<urlset>\n</urlset>',
        'produit',
        ['a'],
        'https://www.example.com',
      ).includes('<loc>https://www.example.com/produit/a</loc>'),
    )
  })
})
