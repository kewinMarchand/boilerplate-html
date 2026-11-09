import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

import { BILINGUAL_PORT } from '../../playwright.config.js'

// Site bilingue des tests : généré depuis le scénario `bilingual` de l'API (français par défaut, anglais
// sous /en), servi par Playwright sur BILINGUAL_PORT. Fixtures de l'API : la fiche « monstera-deliciosa »
// a son équivalent anglais « swiss-cheese-plant », la catégorie « plantes-interieur » s'appelle
// « indoor-plants » en anglais ; un slug inconnu n'a d'équivalent dans aucune langue.
const BILINGUAL = `http://localhost:${BILINGUAL_PORT}`
const SITE_URL = JSON.parse(readFileSync(new URL('../../site.config.json', import.meta.url))).url
const EN = JSON.parse(readFileSync(new URL('../../i18n/en.json', import.meta.url)))
const FR_PRODUCT = '/produit/monstera-deliciosa'
const EN_PRODUCT = '/en/produit/swiss-cheese-plant'
const FR_CATEGORY = '/catalogue/plantes-interieur'
const EN_CATEGORY = '/en/catalogue/indoor-plants'

/** Libellé de `i18n/en.json` en expression régulière, `{nom}` valant n'importe quel texte. */
const labelPattern = (key) =>
  new RegExp(`^${EN[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.+')}$`)

const expectLanguages = async (page, { current, fr, en }) => {
  const languages = page.getByTestId('layout-languages')
  await expect(languages).toBeVisible()
  for (const [code, href, name] of [
    ['fr', fr, 'Français'],
    ['en', en, 'English'],
  ]) {
    const link = page.getByTestId(`layout-language-${code}`)
    await expect(link).toHaveAttribute('href', href)
    await expect(link).toHaveAttribute('lang', code)
    await expect(link).toHaveAttribute('hreflang', code)
    await expect(link).toHaveText(name)
    if (code === current) await expect(link).toHaveAttribute('aria-current', 'true')
    else await expect(link).not.toHaveAttribute('aria-current')
  }
}

test.describe('site bilingue', () => {
  test.use({ baseURL: BILINGUAL })

  test('l’accueil anglais est sous /en, en anglais, avec le sélecteur de langue', async ({
    page,
  }) => {
    await page.goto('/en')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('layout-logo')).toHaveAttribute('href', '/en')
    await expect(page).toHaveTitle(new RegExp(EN['home.title'].split(', ')[1]))
    await expectLanguages(page, { current: 'en', fr: '/', en: '/en' })
  })

  test('une page française mène à son équivalent anglais, catégorie traduite', async ({ page }) => {
    await page.goto(FR_CATEGORY)

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expectLanguages(page, { current: 'fr', fr: FR_CATEGORY, en: EN_CATEGORY })
    await page.getByTestId('layout-language-en').click()

    await expect(page).toHaveURL(EN_CATEGORY)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('la fiche anglaise porte son contenu, ses liens préfixés et ses équivalents', async ({
    page,
  }) => {
    await page.goto(EN_PRODUCT)

    await expect(page.getByTestId('product-title')).toHaveText('Swiss cheese plant')
    await expect(page.getByTestId('product-price')).toHaveText('€34.90')
    await expect(page.getByTestId('layout-breadcrumb').getByRole('link').first()).toHaveText(
      EN['common.home'],
    )
    await expect(
      page.getByTestId('layout-breadcrumb').getByRole('link', { name: 'Monstera', exact: true }),
    ).toHaveAttribute('href', '/en/catalogue/indoor-plants/foliage-plants/monstera')
    await expectLanguages(page, { current: 'en', fr: FR_PRODUCT, en: EN_PRODUCT })
    await page.getByTestId('add-to-cart').click()
    await expect(page.getByTestId('add-to-cart-status')).toContainText(
      EN['product.added'].replace('{name}', 'Swiss cheese plant'),
    )
    await expect(page.getByTestId('add-to-cart-status').getByRole('link')).toHaveAttribute(
      'href',
      '/en/panier',
    )

    await page.getByTestId('layout-language-fr').click()
    await expect(page).toHaveURL(FR_PRODUCT)
    await expect(page.getByTestId('product-title')).toHaveText('Monstera deliciosa')
  })

  test('sans équivalent connu, le sélecteur mène à l’accueil de chaque langue', async ({
    page,
  }) => {
    await page.goto('/en/produit/produit-inconnu')

    await expect(page.getByTestId('product-not-found')).toBeVisible()
    await expect(page.getByTestId('product-title')).toHaveText(EN['product.notFound'])
    await expectLanguages(page, { current: 'en', fr: '/', en: '/en' })
  })

  test('le catalogue anglais lit l’API en anglais et écrit ses libellés en anglais', async ({
    page,
    isMobile,
  }) => {
    const request = page.waitForRequest(
      (candidate) =>
        candidate.url().includes('/api/products?') &&
        new URL(candidate.url()).searchParams.get('locale') === 'en',
    )
    await page.goto(EN_CATEGORY)

    const apiRequest = await request
    expect(new URL(apiRequest.url()).searchParams.get('category')).toBe('indoor-plants')
    expect(apiRequest.headers()['x-scenario']).toBe('bilingual')
    await expect(page.getByTestId('catalog-results-count')).toHaveText(
      labelPattern('catalog.resultsOther'),
    )
    await expect(page.getByTestId('catalog-product-link').first()).toHaveAttribute(
      'href',
      /^\/en\/produit\/[a-z0-9-]+$/,
    )
    // En mobile, les filtres sont dans le tiroir
    if (isMobile) await page.getByTestId('catalog-filters-open').click()
    await page.getByTestId('catalog-filter-exposure-mi-ombre').check()
    if (isMobile) await page.getByTestId('catalog-filters-done').click()
    await expect(page.getByTestId('catalog-active-filter')).toContainText(
      EN['catalog.exposurePartialShade'],
    )
  })

  test('le contact anglais valide en anglais et envoie la langue à l’API', async ({ page }) => {
    await page.goto('/en/contact')

    await page.getByTestId('contact-submit').click()
    await expect(page.getByTestId('contact-name-error')).toHaveText(EN['contact.nameInvalid'])
    await page.getByTestId('contact-name').fill('Ada')
    await page.getByTestId('contact-email').fill('ada@example.com')
    await page.getByTestId('contact-message').fill('Hello, is this plant available?')
    const request = page.waitForRequest(
      (candidate) =>
        candidate.method() === 'POST' && candidate.url().endsWith('/api/contact_messages'),
    )
    await page.getByTestId('contact-submit').click()

    expect((await request).headers()['accept-language']).toBe('en')
    await expect(page.getByTestId('contact-success')).toContainText(EN['contact.success'])
  })

  test('les tâches comptent en anglais', async ({ page }) => {
    await page.goto('/en/taches')

    await expect(page.getByTestId('tasks-count')).toHaveText(labelPattern('tasks.visibleOther'))
  })

  test('l’en-tête porte langue, canonique, og:locale, hreflang et données structurées', async ({
    page,
  }) => {
    await page.goto(EN_PRODUCT)
    const head = page.locator('head')

    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${SITE_URL}${EN_PRODUCT}`,
    )
    await expect(head.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US')
    await expect(head.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
      'content',
      'fr_FR',
    )
    for (const [code, path] of [
      ['fr', FR_PRODUCT],
      ['en', EN_PRODUCT],
      ['x-default', FR_PRODUCT],
    ]) {
      await expect(head.locator(`link[rel="alternate"][hreflang="${code}"]`)).toHaveAttribute(
        'href',
        `${SITE_URL}${path}`,
      )
    }
    const blocks = await head.locator('script[type="application/ld+json"]').allTextContents()
    const breadcrumb = blocks
      .map((block) => JSON.parse(block))
      .find((data) => data['@type'] === 'BreadcrumbList')
    expect(breadcrumb.itemListElement[0]).toMatchObject({
      name: EN['common.home'],
      item: `${SITE_URL}/en`,
    })
  })

  test('l’article anglais déclare sa langue dans ses données structurées', async ({ page }) => {
    await page.goto('/en/blog/enhanced-accessibility-mode')
    const blocks = await page.locator('head script[type="application/ld+json"]').allTextContents()
    const posting = blocks
      .map((block) => JSON.parse(block))
      .find((data) => data['@type'] === 'BlogPosting')

    expect(posting.inLanguage).toBe('en-US')
    await expectLanguages(page, {
      current: 'en',
      fr: '/blog/le-mode-accessibilite-renforcee',
      en: '/en/blog/enhanced-accessibility-mode',
    })
  })

  test('le sitemap donne chaque adresse dans chaque langue, avec ses équivalents', async ({
    request,
  }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()

    expect(sitemap).toContain(
      `<url><loc>${SITE_URL}${EN_CATEGORY}</loc><xhtml:link rel="alternate" hreflang="fr" href="${SITE_URL}${FR_CATEGORY}"/>`,
    )
    expect(sitemap).toContain(`<loc>${SITE_URL}${EN_PRODUCT}</loc>`)
  })

  test('un préfixe de langue non activée répond 404', async ({ request }) => {
    for (const path of ['/de', '/de/catalogue', '/de/produit/monstera-deliciosa']) {
      expect((await request.get(path)).status(), path).toBe(404)
    }
  })
})

test.describe('site d’une seule langue', () => {
  test('n’a ni sélecteur, ni hreflang, ni préfixe', async ({ page, request }) => {
    await page.goto('/')

    await expect(page.locator('html')).not.toHaveAttribute('data-locales')
    await expect(page.getByTestId('layout-languages')).toHaveCount(0)
    await expect(page.locator('link[hreflang]')).toHaveCount(0)
    expect((await request.get('/en')).status()).toBe(404)
  })
})
