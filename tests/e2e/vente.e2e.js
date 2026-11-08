import { expect, test } from '@playwright/test'

import { withIdentity } from './routes.js'

// Vente en ligne et demande de renseignement (section 27 de la spec commune). L'identité de l'API est
// simulée comme pour le logo (section 22) : la case de l'admin n'est jamais modifiée.
const API_URL = process.env.API_URL || 'http://localhost:8090'
const SLUG = 'monstera-deliciosa'
const PRODUCT = `/produit/${SLUG}`
const OUT_OF_STOCK = '/produit/monstera-thai-constellation'
const STORED_CART = JSON.stringify([
  { slug: SLUG, name: 'Monstera deliciosa', price: 3490, quantity: 2 },
])

const apiIdentity = async (request) => (await request.get(`${API_URL}/api/site-identity`)).json()

const fillContactForm = async (page) => {
  await page.getByTestId('contact-name').fill('Ada')
  await page.getByTestId('contact-email').fill('ada@exemple.fr')
  await page.getByTestId('contact-message').fill('Bonjour, ce produit est-il livrable ?')
}

test.describe('vente en ligne coupée', () => {
  test.beforeEach(async ({ page, request }) => {
    await withIdentity(page, { ...(await apiIdentity(request)), salesEnabled: false })
  })

  test('le catalogue n’affiche ni prix, ni filtre, ni tri par prix', async ({ page }) => {
    await page.goto('/catalogue')

    await expect(page.getByTestId('catalog-product').first()).toBeVisible()
    await expect(page.getByTestId('catalog-product-price')).toHaveCount(0)
    await expect(page.getByTestId('catalog-filter-price-min')).toHaveCount(0)
    await expect(page.getByTestId('catalog-filter-price-max')).toHaveCount(0)
    await expect(page.getByTestId('catalog-sort').locator('option[value^="prix"]')).toHaveCount(0)
    await expect(page.getByTestId('catalog-filter-in-stock')).toHaveCount(1)
  })

  test('le catalogue ignore les paramètres de prix de l’URL', async ({ page }) => {
    await page.goto('/catalogue?prix_max=1&tri=prix-desc')

    await expect(page.getByTestId('catalog-product').first()).toBeVisible()
    await expect(page.getByTestId('catalog-empty')).toHaveCount(0)
    await expect(page.getByTestId('catalog-active-filter')).toHaveCount(0)
    await expect(page.getByTestId('catalog-sort')).toHaveValue('pertinence')
  })

  test('l’accueil n’affiche aucun prix dans le carrousel', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('carousel-slide').first()).toBeAttached()
    await expect(page.locator('[data-slide-text]')).toHaveCount(0)
  })

  test('ni lien du panier, ni page panier, et le panier enregistré reste intact', async ({
    page,
  }) => {
    await page.addInitScript((cart) => {
      if (!sessionStorage.getItem('panier-pose')) {
        localStorage.setItem('panier', cart)
        sessionStorage.setItem('panier-pose', '1')
      }
    }, STORED_CART)
    await page.goto(PRODUCT)
    await expect(page.getByTestId('product-title')).toBeVisible()
    await expect(page.getByTestId('cart-link')).toHaveCount(0)

    const response = await page.goto('/panier')
    expect(response.status()).toBe(404)
    expect(await page.evaluate(() => localStorage.getItem('panier'))).toBe(STORED_CART)
  })

  test('la fiche propose la demande de renseignement à la place du prix et du panier', async ({
    page,
  }) => {
    await page.goto(PRODUCT)
    const name = await page.getByTestId('product-title').textContent()
    const inquiry = page.getByTestId('product-inquiry')

    await expect(page.getByTestId('product-price')).toHaveCount(0)
    await expect(page.getByTestId('add-to-cart')).toHaveCount(0)
    await expect(inquiry).toHaveAccessibleName(`Demande de renseignement sur ${name}`)
    expect((await inquiry.boundingBox()).height).toBeGreaterThanOrEqual(44)
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent)))
    expect(jsonLd.find((data) => data['@type'] === 'Product').offers).toBeUndefined()

    await inquiry.click()
    await expect(page).toHaveURL(`/contact?produit=${SLUG}`)
    const line = page.getByTestId('contact-product')
    await expect(line).toHaveText(`Votre demande concerne : ${name}`)
    await expect(line.getByRole('link', { name })).toHaveAttribute('href', PRODUCT)
  })

  test('la demande est proposée même en rupture de stock', async ({ page }) => {
    await page.goto(OUT_OF_STOCK)

    await expect(page.getByTestId('product-title')).toBeVisible()
    await expect(page.getByTestId('product-inquiry')).toHaveAttribute(
      'href',
      '/contact?produit=monstera-thai-constellation',
    )
  })

  test('l’envoi confirme la demande, et le corps de la requête porte le produit', async ({
    page,
  }) => {
    await page.goto(`/contact?produit=${SLUG}`)
    await fillContactForm(page)
    const requestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/contact_messages'),
    )
    await page.getByTestId('contact-submit').click()

    expect((await requestPromise).postDataJSON().product).toBe(SLUG)
    await expect(page.getByTestId('contact-success')).toHaveText(
      /Votre demande de renseignement a bien été envoyée\./,
    )
  })
})

test.describe('vente en ligne coupée, sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la fiche porte le lien de demande, et la page contact la ligne du produit', async ({
    page,
    request,
  }) => {
    await withIdentity(page, { ...(await apiIdentity(request)), salesEnabled: false })
    await page.goto(PRODUCT)

    await page.getByTestId('product-inquiry').click()
    await expect(page).toHaveURL(`/contact?produit=${SLUG}`)
    await expect(page.getByTestId('contact-product')).toBeVisible()
  })
})

test.describe('vente en ligne active', () => {
  test('la fiche garde l’ajout au panier, sans lien de demande', async ({ page, request }) => {
    await withIdentity(page, await apiIdentity(request))
    await page.goto(PRODUCT)

    await expect(page.getByTestId('add-to-cart')).toBeVisible()
    await expect(page.getByTestId('product-price')).not.toBeEmpty()
    await expect(page.getByTestId('cart-link')).toBeVisible()
    await expect(page.getByTestId('product-inquiry')).toHaveCount(0)
  })

  test('la page contact prend en charge le produit de l’URL', async ({ page }) => {
    await page.goto(`/contact?produit=${SLUG}`)

    await expect(page.getByTestId('contact-product')).toContainText('Votre demande concerne :')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/contact$/)
  })

  test('produit inconnu : formulaire de contact simple, sans la ligne', async ({ page }) => {
    await page.goto('/contact?produit=produit-inconnu')

    await expect(page.getByTestId('contact-form')).toBeVisible()
    await expect(page.getByTestId('contact-product')).toHaveCount(0)
  })

  test('sans produit, le message de contact simple n’envoie pas de produit', async ({ page }) => {
    await page.goto('/contact')
    await fillContactForm(page)
    const requestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/contact_messages'),
    )
    await page.getByTestId('contact-submit').click()

    expect((await requestPromise).postDataJSON()).not.toHaveProperty('product')
    await expect(page.getByTestId('contact-success')).toHaveText(
      /Merci, votre message a bien été envoyé\./,
    )
  })
})
