import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { gunzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'

import { OBSERVABILITY_PORT } from '../../playwright.config.js'

// Second serveur de développement lancé par Playwright avec des valeurs factices : son DSN
// pointe vers le faux GlitchTip local ci-dessous. Aucune instance réelle n'est contactée.
const OBSERVED = `http://localhost:${OBSERVABILITY_PORT}`
const GLITCHTIP_PORT = 4087

const envelopes = []
const events = () => envelopes.filter((body) => body.includes('"type":"event"'))

const startFakeGlitchtip = () =>
  createServer((request, response) => {
    response.setHeader('access-control-allow-origin', '*')
    response.setHeader('access-control-allow-headers', '*')
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end()
      return
    }
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks)
      const gzipped = request.headers['content-encoding'] === 'gzip'
      envelopes.push((gzipped ? gunzipSync(body) : body).toString('utf8'))
      response.writeHead(200, { 'content-type': 'application/json' }).end('{}')
    })
  }).listen(GLITCHTIP_PORT)

const MATOMO_TRACKER = readFileSync(
  new URL('./fixtures/matomo-tracker.js', import.meta.url),
  'utf8',
)

const interceptMatomo = async (page) => {
  const pageViews = []
  await page.route('http://matomo.test/matomo.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: MATOMO_TRACKER }),
  )
  await page.route('http://matomo.test/matomo.php?*', (route) => {
    pageViews.push(route.request().url())
    return route.fulfill({ status: 204 })
  })
  return pageViews
}

const throwInBrowser = async (page, message) => {
  await page.evaluate((text) => {
    setTimeout(() => {
      throw new Error(text)
    })
  }, message)
}

test('sans configuration, aucun traceur n’est chargé', async ({ page }) => {
  const requests = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/contact')
  await page.waitForLoadState('load')

  await expect(page.locator('script[data-glitchtip-dsn]')).toHaveCount(0)
  await expect(page.locator('script[data-matomo-url]')).toHaveCount(0)
  expect(
    requests.filter((url) => url.includes('sentry-browser') || url.includes('matomo')),
  ).toEqual([])
})

test('sans configuration, la page Données personnelles ne décrit pas de mesure d’audience', async ({
  page,
}) => {
  await page.goto('/donnees-personnelles')
  await expect(page.getByTestId('legal-audience-measurement')).toHaveCount(0)
})

test.describe('Mesure d’audience Matomo, avec un traceur factice', () => {
  test.skip(({ isMobile }) => isMobile, 'navigation par les liens du header desktop')

  test('une page vue par navigation, sans cookie', async ({ page, context }) => {
    const pageViews = await interceptMatomo(page)
    await page.goto(`${OBSERVED}/`)
    await expect.poll(() => pageViews.length).toBe(1)

    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Contact' })
      .click()
    await expect(page).toHaveURL(/\/contact$/)
    await expect.poll(() => pageViews.length).toBe(2)
    expect(new URL(pageViews[1]).searchParams.get('url')).toMatch(/\/contact$/)

    const commands = await page.evaluate(() => window.__matomoCommands ?? [])
    expect(commands[0]).toEqual(['disableCookies'])
    expect(await context.cookies()).toEqual([])
  })

  test('la page Données personnelles décrit la mesure d’audience', async ({ page }) => {
    await interceptMatomo(page)
    await page.goto(`${OBSERVED}/donnees-personnelles`)

    await expect(page.getByTestId('legal-audience-measurement')).toContainText('sans cookie')
  })

  test('un visiteur qui s’oppose à la mesure n’est plus mesuré, même après rechargement', async ({
    page,
  }) => {
    const pageViews = await interceptMatomo(page)
    await page.goto(`${OBSERVED}/donnees-personnelles`)
    await expect.poll(() => pageViews.length).toBe(1)

    await page.getByTestId('legal-opposition-mesure').check()
    await expect(page.getByTestId('legal-opposition-etat')).toHaveText(/ne sont plus mesurées/)

    // Le refus est lu avant la première commande : la file Matomo n'est jamais créée, donc aucun
    // traceur chargé ni aucune requête, sans dépendre d'un délai d'attente.
    await page.reload()
    await expect(page.getByTestId('legal-opposition-etat')).toHaveText(/ne sont plus mesurées/)
    expect(await page.evaluate(() => window._paq)).toBeUndefined()
    expect(pageViews).toHaveLength(1)

    await page.getByTestId('legal-opposition-mesure').uncheck()
    await expect(page.getByTestId('legal-opposition-etat')).toHaveText(/sont mesurées, de façon/)
  })
})

test.describe('Suivi des erreurs GlitchTip, avec un DSN factice', () => {
  test.describe.configure({ mode: 'serial' })

  let glitchtip

  test.beforeAll(() => {
    test.skip(test.info().project.name !== 'desktop', 'vérification des envois, une seule fois')
    glitchtip = startFakeGlitchtip()
  })

  test.afterAll(() => {
    glitchtip?.close()
  })

  test.beforeEach(() => {
    envelopes.length = 0
  })

  test('une erreur du navigateur est envoyée après l’affichage', async ({ page }) => {
    await page.goto(`${OBSERVED}/`)
    await page.waitForFunction(() => typeof window.Sentry?.getClient?.() === 'object')
    await throwInBrowser(page, 'Erreur navigateur volontaire')

    await expect
      .poll(() => events().some((body) => body.includes('Erreur navigateur volontaire')))
      .toBe(true)
  })

  test('rien n’est chargé ni envoyé pour une 404', async ({ page }) => {
    const requests = []
    page.on('request', (request) => requests.push(request.url()))
    expect((await page.goto(`${OBSERVED}/route-inexistante`))?.status()).toBe(404)
    await page.waitForLoadState('load')
    await throwInBrowser(page, 'Erreur sur une 404')

    await expect(page.locator('script[data-glitchtip-dsn]')).toHaveCount(0)
    expect(requests.filter((url) => url.includes('sentry-browser'))).toEqual([])
    expect(events()).toEqual([])
  })
})
