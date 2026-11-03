import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate'

import { prerenderCarousel, prerenderLegalPage } from '../../scripts/prerender-content.js'
import { renderPage, SITE_DIR } from './renderedPages.js'

const HOME = readFileSync(join(SITE_DIR, 'index.html'), 'utf8')
const LEGAL = readFileSync(join(SITE_DIR, 'accessibilite/index.html'), 'utf8')

const SLIDES = [
  { id: '1', slug: 'heliconia', title: 'Heliconia <rouge>', text: 'Des bractées $1.', image: 1 },
  { id: '2', slug: 'anthurium', title: 'Anthurium', text: 'Une spathe.', image: 2 },
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
      page.includes('srcset="/images/slide-2-640.avif 640w, /images/slide-2-1280.avif 1280w"'),
    )
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
