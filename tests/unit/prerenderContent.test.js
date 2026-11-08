import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate'

import {
  prerenderArticle,
  prerenderBlogList,
  prerenderCarousel,
  prerenderContactProduct,
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
    assert.equal(page.match(/<picture class="bui-picture">/g)?.length, 1)
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
  const SECTIONS = [
    { slug: 'conseils', name: 'Conseils' },
    { slug: 'actualites', name: 'Actualités' },
  ]
  ARTICLES[0].section = SECTIONS[0]
  const html = prerenderBlogList(BLOG, ARTICLES, SECTIONS)
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

  it('écrit la rubrique en sur-titre de la carte qui en a une', () => {
    assert.equal(page.match(/data-testid="article-section"/g)?.length, 1)
    assert.ok(page.includes('data-testid="article-section">Conseils</p>'))
  })

  it('écrit le filtre par rubrique, « Toutes » active, et le retire sans rubrique', () => {
    const nav = page.match(/<nav\s+class="blog-sections"[\s\S]*?<\/nav>/)[0]
    assert.ok(!/\shidden\s*>/.test(nav))
    assert.deepEqual(
      [...nav.matchAll(/<a class="bui-link" href="([^"]*)"[^>]*>([^<]*)/g)].map(
        ([, href, name]) => [href, name],
      ),
      [
        ['/blog', 'Toutes'],
        ['/blog?rubrique=conseils', 'Conseils'],
        ['/blog?rubrique=actualites', 'Actualités'],
      ],
    )
    assert.ok(nav.includes('href="/blog" aria-current="page"'))
    assert.ok(!prerenderBlogList(BLOG, ARTICLES).includes('blog-sections'))
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
  const RICH = {
    ...ARTICLE,
    section: { slug: 'conseils', name: 'Conseils' },
    format: { slug: 'guide', name: 'Guide <pas à pas>' },
    audio: { src: 'http://localhost:8090/media/a.mp3', type: 'audio/mpeg', durationSeconds: 1560 },
    speaker: 'Présenté par Hina',
    metaTitle: 'Titre saisi pour les moteurs',
    metaDescription: 'Description saisie pour les moteurs.',
  }
  const rich = prerenderArticle(FICHE, RICH, 'https://www.example.com')

  it('écrit rubrique, format et lecteur audio avec sa durée et l’intervenant', () => {
    assert.match(rich, /data-article-section-name>Conseils</)
    assert.match(rich, /data-article-format-name>Guide &lt;pas à pas&gt;</)
    assert.match(
      rich,
      /<audio src="http:\/\/localhost:8090\/media\/a\.mp3"\s+controls\s+preload="none"/,
    )
    assert.ok(
      rich.includes("data-article-audio-caption>Écouter l'article (26 min) · Présenté par Hina<"),
    )
    assert.ok(!rich.includes('autoplay'))
  })

  it('retire rubrique, format et lecteur absents', () => {
    assert.ok(!page.includes('article-taxonomy'))
    assert.ok(!page.includes('<audio'))
    const sectionOnly = prerenderArticle(
      FICHE,
      { ...ARTICLE, section: RICH.section },
      'https://www.example.com',
    )
    assert.ok(sectionOnly.includes('data-testid="article-section"'))
    assert.ok(!sectionOnly.includes('data-testid="article-format"'))
  })

  it('écrit le titre et la description saisis, sinon ceux calculés', () => {
    assert.ok(rich.includes('<title>Titre saisi pour les moteurs</title>'))
    assert.ok(rich.includes('<meta property="og:title" content="Titre saisi pour les moteurs" />'))
    assert.match(rich, /name="description"\s+content="Description saisie pour les moteurs\."/)
    assert.match(
      rich,
      /property="og:description"\s+content="Description saisie pour les moteurs\."/,
    )
    assert.match(html, /name="description"\s+content="Défilement natif\."/)
  })

  it('produit un HTML valide avec rubrique, format et audio', async () => {
    assert.deepEqual(await validate(rich, 'blog/un-carrousel/index.html'), [])
  })

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
  const GALLERY = [apiImage('g1', [400, 640]), apiImage('g2', [400])]
  const withGallery = prerenderProduct(
    PRODUCT_FICHE,
    {
      ...product,
      gallery: GALLERY,
      metaTitle: 'Titre saisi',
      metaDescription: 'Description saisie.',
    },
    'https://www.example.com/',
  )

  it('écrit la galerie : vignettes en liens vers l’image en grand, la première courante', () => {
    const gallery = outsideTemplates(withGallery).match(
      /<div class="product-gallery"[\s\S]*?<\/ul>/,
    )[0]
    assert.ok(gallery.includes('data-testid="product-gallery"'))
    const links = [...gallery.matchAll(/<a href="([^"]*)"/g)].map(([, href]) => href)
    assert.deepEqual(links, [
      'http://localhost:8090/media/s2-800.webp',
      'http://localhost:8090/media/g1-640.webp',
      'http://localhost:8090/media/g2-400.webp',
    ])
    assert.equal(gallery.match(/aria-current="true"/g)?.length, 1)
    assert.ok(gallery.includes("Voir l'image 3 sur 3"))
    assert.equal(gallery.match(/loading="lazy"/g)?.length, 3)
    assert.match(
      gallery,
      /<picture class="product-page-media bui-picture">[\s\S]*?fetchpriority="high"/,
    )
  })

  it('n’écrit pas de galerie sans images supplémentaires', () => {
    const page = outsideTemplates(html)
    assert.ok(!page.includes('product-gallery-thumbs'))
    assert.ok(!page.includes('data-testid="product-gallery"'))
    assert.ok(page.includes('<picture class="product-page-media bui-picture">'))
  })

  it('écrit le titre et la description saisis, sinon ceux calculés', () => {
    assert.ok(withGallery.includes('<title>Titre saisi</title>'))
    assert.match(withGallery, /name="description"\s+content="Description saisie\."/)
    assert.match(withGallery, /name="twitter:title" content="Titre saisi"/)
  })

  it('produit un HTML valide avec la galerie', async () => {
    assert.deepEqual(await validate(withGallery, 'produit/fiche.html'), [])
  })

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

  it('prépare la demande de renseignement dans son gabarit, retiré par l’identité', () => {
    const template = html.match(/<template id="product-inquiry-template">[\s\S]*?<\/template>/)[0]
    assert.match(template, /href="\/contact\?produit=anthurium-andreanum-rouge"/)
    assert.match(template, /data-product-inquiry-name\s*> sur Anthurium<\/span/)
    assert.match(html, /data-product-price\s+data-testid="product-price"\s*>24,90/)
  })

  it('prépare la demande de renseignement dans son gabarit, retiré par l’identité', () => {
    const template = html.match(/<template id="product-inquiry-template">[\s\S]*?<\/template>/)[0]
    assert.match(template, /href="\/contact\?produit=anthurium-andreanum-rouge"/)
    assert.match(template, /data-product-inquiry-name\s*> sur Anthurium<\/span/)
    assert.match(html, /data-product-price\s+data-testid="product-price"\s*>24,90/)
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

describe('pré-rendu de la demande de renseignement', () => {
  const CONTACT = readFileSync(join(SITE_DIR, 'contact/index.html'), 'utf8')
  const html = prerenderContactProduct(CONTACT, PRODUCTS[0])

  it('écrit la ligne du produit liée à sa fiche, au-dessus du formulaire', () => {
    assert.match(
      html,
      /<p class="contact-product" data-testid="contact-product">Votre demande concerne : <a class="bui-link" href="\/produit\/heliconia-rostrata">Heliconia &lt;rouge&gt; \$1<\/a><\/p>\s*<div class="contact-layout">/,
    )
  })

  it('envoie le produit avec le message, et confirme la demande', () => {
    assert.match(
      html,
      /data-testid="contact-form"\s*><input type="hidden" name="product" value="heliconia-rostrata" \/>/,
    )
    assert.ok(html.includes('<p>Votre demande de renseignement a bien été envoyée.</p>'))
    assert.ok(!html.includes('Merci, votre message a bien été envoyé.'))
  })

  it('garde la canonique de /contact et produit un HTML valide', async () => {
    assert.ok(html.includes('<link rel="canonical" href="https://www.example.com/contact" />'))
    assert.deepEqual(await validate(html, 'contact/index.html'), [])
  })
})
