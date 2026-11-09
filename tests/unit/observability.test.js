import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import {
  apiOrigin,
  DEFAULT_API_URL,
  glitchtipOrigin,
  matomoOrigin,
  observabilityVariables,
  resolveVariables,
  runtimeVariables,
} from '../../scripts/runtimeVariables.js'
import { PAGES, renderPage, ROOT } from './renderedPages.js'

const DSN = 'https://cle@glitchtip.example.com/1'
const NONE = observabilityVariables({})
const CONFIGURED = observabilityVariables({
  GLITCHTIP_DSN: DSN,
  GLITCHTIP_ENVIRONMENT: 'production',
  MATOMO_URL: 'https://matomo.example.com/',
  MATOMO_SITE_ID: '3',
})

const scriptTags = (html) =>
  [...html.matchAll(/<script\b([^>]*)>/g)].map(([, attributes]) =>
    Object.fromEntries(
      [...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]),
    ),
  )

const glitchtipScripts = (html) =>
  scriptTags(html).filter((attributes) => attributes.src === '/js/shared/glitchtip.js')

const matomoScripts = (html) =>
  scriptTags(html).filter((attributes) => attributes.src === '/js/shared/matomo.js')

const audienceSection = (html) => html.includes('data-testid="legal-audience-measurement"')

const csp = (variables) => {
  const conf = readFileSync(join(ROOT, 'docker/security-headers.conf'), 'utf8')
  const value = conf.match(/add_header Content-Security-Policy "([^"]*)"/)[1]
  return Object.fromEntries(
    resolveVariables(value, variables)
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .map(([name, ...sources]) => [name, sources]),
  )
}

const page = (route) => PAGES.find((item) => item.route === route)

describe('GlitchTip', () => {
  it('lit l’origine d’un DSN au format Sentry', () => {
    assert.equal(glitchtipOrigin(DSN), 'https://glitchtip.example.com')
    assert.equal(glitchtipOrigin('http://cle@localhost:4087/1'), 'http://localhost:4087')
    assert.equal(glitchtipOrigin(''), '')
  })

  it('n’injecte aucun script et n’ouvre aucune origine sans DSN', () => {
    for (const { route, source } of PAGES) {
      assert.deepEqual(glitchtipScripts(renderPage(source, NONE)), [], route)
    }
    assert.deepEqual(csp(NONE)['connect-src'], ["'self'"])
  })

  it('injecte le DSN et l’environnement sur les pages ordinaires', () => {
    assert.deepEqual(glitchtipScripts(renderPage(page('/contact').source, CONFIGURED)), [
      {
        type: 'module',
        src: '/js/shared/glitchtip.js',
        'data-glitchtip-dsn': DSN,
        'data-glitchtip-environment': 'production',
      },
    ])
    assert.deepEqual(csp(CONFIGURED)['connect-src'], [
      "'self'",
      'https://glitchtip.example.com',
      'https://matomo.example.com',
    ])
  })

  it('ne charge rien sur les pages d’erreur attendues', () => {
    for (const route of ['/404', '/405', '/50x', '/503']) {
      assert.deepEqual(glitchtipScripts(renderPage(page(route).source, CONFIGURED)), [], route)
    }
  })

  it('échappe une valeur injectée', () => {
    const [script] = glitchtipScripts(
      renderPage(page('/').source, { ...CONFIGURED, glitchtip_environment: 'a"b<c' }),
    )
    assert.equal(script['data-glitchtip-environment'], 'a&quot;b&lt;c')
  })
})

describe('Matomo', () => {
  it('n’ouvre l’origine que si l’adresse et le site sont renseignés', () => {
    assert.equal(
      matomoOrigin('https://matomo.example.com/stats/', '3'),
      'https://matomo.example.com',
    )
    assert.equal(matomoOrigin('https://matomo.example.com/', ''), '')
    assert.equal(matomoOrigin('', '3'), '')
  })

  it('n’injecte ni traceur ni paragraphe sans configuration', () => {
    for (const { route, source } of PAGES) {
      const html = renderPage(source, NONE)
      assert.deepEqual(matomoScripts(html), [], route)
      assert.equal(audienceSection(html), false, route)
    }
    assert.equal(csp(NONE)['script-src'].length, 2)
  })

  it('injecte l’adresse et le site, et ouvre l’origine dans script-src', () => {
    assert.deepEqual(matomoScripts(renderPage(page('/').source, CONFIGURED)), [
      {
        type: 'module',
        src: '/js/shared/matomo.js',
        'data-matomo-url': 'https://matomo.example.com/',
        'data-matomo-site-id': '3',
      },
    ])
    assert.equal(csp(CONFIGURED)['script-src'].at(-1), 'https://matomo.example.com')
  })

  it('décrit la mesure d’audience sur la page Données personnelles seulement si elle est active', () => {
    assert.equal(
      audienceSection(renderPage(page('/donnees-personnelles').source, CONFIGURED)),
      true,
    )
    assert.equal(audienceSection(renderPage(page('/donnees-personnelles').source, NONE)), false)
  })
})

describe('API', () => {
  it('pointe sur API Platform par défaut et ouvre son origine dans connect-src, img-src et media-src', () => {
    const variables = runtimeVariables({})
    assert.equal(variables.api_url, DEFAULT_API_URL)
    assert.equal(apiOrigin('http://localhost:8091/'), 'http://localhost:8091')
    assert.deepEqual(csp(variables)['connect-src'], ["'self'", 'http://localhost:8090'])
    assert.deepEqual(csp(variables)['img-src'], ["'self'", 'http://localhost:8090'])
    assert.deepEqual(csp(variables)['media-src'], ["'self'", 'http://localhost:8090'])
  })

  it('injecte l’adresse de l’API dans chaque page', () => {
    const html = renderPage(
      page('/taches').source,
      runtimeVariables({ API_URL: 'http://localhost:8091' }),
    )
    assert.match(
      html,
      /<link rel="preconnect" href="http:\/\/localhost:8091" crossorigin data-api-url \/>/,
    )
  })
})
