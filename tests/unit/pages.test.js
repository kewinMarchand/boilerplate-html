import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { complianceStatus } from '../../lib/accessibilityCompliance.js'
import { breadcrumbTrail } from '../../lib/breadcrumb.js'
import { PAGES, ROOT, SITE_DIR, text } from './renderedPages.js'

const SITE = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'))
const HEADERS = readFileSync(join(ROOT, 'docker/security-headers.conf'), 'utf8')
const ERROR_PAGES = ['/404', '/405', '/50x', '/503']
const DEV_PAGES = ['/charte-graphique']

const attribute = (html, pattern) => html.match(pattern)?.[1]
const hrefsIn = (html, label) => {
  const nav = html.match(new RegExp(`<nav[^>]*aria-label="${label}"[\\s\\S]*?</nav>`))?.[0] ?? ''
  return [...nav.matchAll(/<a [^>]*href="([^"]+)"/g)].map(([, href]) => href)
}
const PUBLIC_ROUTES = PAGES.map((page) => page.route).filter(
  (route) => !ERROR_PAGES.includes(route) && !DEV_PAGES.includes(route),
)

describe('pages statiques', () => {
  for (const { route, html } of PAGES) {
    describe(route, () => {
      it('a un seul h1 et le script inline autorisé par la CSP', () => {
        assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        assert.equal(inline.length, 1)
        const hash = createHash('sha256').update(inline[0][1]).digest('base64')
        assert.ok(HEADERS.includes(`'sha256-${hash}'`), `hash attendu : sha256-${hash}`)
      })

      it('reprend la navigation et les liens légaux de la configuration', () => {
        const main = hrefsIn(html, 'Navigation principale').filter(
          (href) => !href.startsWith('/catalogue/'),
        )
        assert.deepEqual(
          [...new Set(main)],
          SITE.navigation.map((item) => item.href),
        )
        assert.deepEqual(
          hrefsIn(html, 'Liens légaux'),
          SITE.legalNavigation.map((item) => item.href),
        )
        assert.ok(html.includes(`>Accessibilité : ${complianceStatus(SITE.accessibility)}<`))
      })

      it('affiche le fil d’Ariane calculé et son JSON-LD', () => {
        const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1])
        const trail = breadcrumbTrail(route === '/404' ? '/404' : route, h1)
        const nav = html.match(/<nav[^>]*data-testid="layout-breadcrumb"[\s\S]*?<\/nav>/)?.[0]
        if (route === '/') {
          assert.equal(nav, undefined)
          return
        }
        const labels = [...nav.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, item]) => text(item))
        assert.deepEqual(
          labels,
          trail.map((item) => item.label),
        )
        const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .map(([, json]) => JSON.parse(json))
          .find((data) => data['@type'] === 'BreadcrumbList')
        assert.equal(ld.itemListElement.length, trail.length)
      })

      if (!ERROR_PAGES.includes(route) && !DEV_PAGES.includes(route)) {
        it('porte des métadonnées SEO complètes', () => {
          const title = text(html.match(/<title>([\s\S]*?)<\/title>/)[1])
          const description = attribute(html, /<meta\s+name="description"\s+content="([^"]+)"/)
          assert.ok(title.length >= 30 && title.length <= 70, `${title.length} : ${title}`)
          assert.ok(description.length >= 120 && description.length <= 160, `${description.length}`)
          assert.equal(
            attribute(html, /<link\s+rel="canonical"\s+href="([^"]+)"/),
            `${SITE.url}${route}`,
          )
          for (const property of ['og:title', 'og:description', 'og:image', 'og:url']) {
            assert.ok(html.includes(`property="${property}"`), property)
          }
        })
      } else {
        it('n’est pas indexée', () => {
          assert.ok(html.includes('<meta name="robots" content="noindex" />'))
        })
      }
    })
  }

  it('inclut le header et le footer partagés après avoir nommé la page', () => {
    for (const { route, source } of PAGES) {
      const directives = [...source.matchAll(/<!--#\s*(set|include)\b[^>]*-->/g)].map(
        (match) => match[0],
      )
      assert.equal(directives.length, 3, route)
      assert.match(directives[0], /^<!--# set var="page" value="[a-z-]+" -->$/, route)
      assert.equal(directives[1], '<!--# include virtual="/partials/header.html" -->', route)
      assert.equal(directives[2], '<!--# include virtual="/partials/footer.html" -->', route)
      assert.ok(!source.includes('<header class="site-header"'), route)
    }
  })

  it('marque dans le header et le footer le lien de la page courante, et lui seul', () => {
    for (const { route, html } of PAGES) {
      const chrome = [
        html.match(/<header class="site-header"[\s\S]*?<\/header>/)[0],
        html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0],
      ].join('')
      const current = [...chrome.matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*aria-current="page"/g)]
      for (const [, href] of current) assert.equal(href, route, route)
    }
    const home = PAGES.find((page) => page.route === '/').html
    assert.match(home, /data-testid="layout-logo" aria-current="page"/)
  })

  it('donne un titre unique à chaque page', () => {
    const titles = PAGES.map(({ html }) => text(html.match(/<title>([\s\S]*?)<\/title>/)[1]))
    assert.equal(new Set(titles).size, titles.length)
  })
})

describe('sitemap et plan du site', () => {
  const sitemap = readFileSync(join(SITE_DIR, 'sitemap.xml'), 'utf8')
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) =>
    loc.replace(SITE.url, ''),
  )

  it('liste toutes les routes publiques et elles seules', () => {
    assert.deepEqual(locs.toSorted(), PUBLIC_ROUTES.toSorted())
    for (const item of [...SITE.navigation, ...SITE.legalNavigation]) {
      assert.ok(locs.includes(item.href), item.href)
    }
    for (const route of locs)
      assert.ok(
        PAGES.some((page) => page.route === route),
        route,
      )
  })

  it('est repris par le plan du site', () => {
    const plan = PAGES.find((page) => page.route === '/plan-du-site').html
    const main = plan.match(/<main[\s\S]*<\/main>/)[0]
    for (const route of PUBLIC_ROUTES) assert.ok(main.includes(`href="${route}"`), route)
    assert.ok(!main.includes('/charte-graphique'))
  })
})
