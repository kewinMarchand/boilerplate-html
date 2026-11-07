import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate'

import {
  prerenderArticle,
  prerenderCarousel,
  prerenderLegalPage,
  withArticlesInSitemap,
} from '../../scripts/prerender-content.js'
import { apiImage } from './apiImage.js'
import { renderPage, SITE_DIR } from './renderedPages.js'

const HOME = readFileSync(join(SITE_DIR, 'index.html'), 'utf8')
const LEGAL = readFileSync(join(SITE_DIR, 'accessibilite/index.html'), 'utf8')
const FICHE = readFileSync(join(SITE_DIR, 'blog/fiche.html'), 'utf8')

const SLIDES = [
  { id: '1', slug: 'heliconia', title: 'Heliconia <rouge>', text: 'Des bractées $1.', image: null },
  {
    id: '2',
    slug: 'anthurium',
    title: 'Anthurium',
    text: 'Une spathe.',
    image: apiImage('s2', [640, 1280]),
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
  const html = prerenderCarousel(HOME, SLIDES)
  const page = outsideTemplates(html)

  it('écrit les diapositives à partir du template, sans squelette ni message sans JavaScript', () => {
    assert.equal(page.match(/data-testid="carousel-slide"/g)?.length, 2)
    assert.ok(page.includes('aria-label="1 sur 2"'))
    assert.ok(page.includes('Heliconia &lt;rouge&gt;'))
    assert.ok(page.includes('Des bractées $1.'))
    assert.ok(
      page.includes(
        'srcset="http://localhost:8090/media/s2-640.avif 640w, http://localhost:8090/media/s2-1280.avif 1280w"',
      ),
    )
    assert.equal(page.match(/<picture>/g)?.length, 1)
    assert.ok(!page.includes('data-testid="home-carousel-loading"'))
    assert.ok(!page.includes('data-testid="home-carousel-noscript"'))
  })

  it('produit un HTML valide', async () => {
    assert.deepEqual(await validate(html, 'index.html'), [])
  })

  it('laisse l’accueil tel quel sans diapositive', () => {
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
