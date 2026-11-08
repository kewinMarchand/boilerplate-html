import { expect, test } from '@playwright/test'

const PRODUCT = '/produit/monstera-deliciosa'

test.describe('Fiche produit', () => {
  test('s’ouvre depuis une carte du catalogue', async ({ page }) => {
    await page.goto('/catalogue')

    const card = page.getByTestId('catalog-product').first()
    await expect(card.locator('h2')).not.toHaveText('Produit')
    const name = ((await card.locator('h2').textContent()) ?? '').trim()
    await card.getByTestId('catalog-product-link').click()

    await expect(page).toHaveURL(/\/produit\/[a-z0-9-]+$/)
    await expect(page.getByTestId('product-title')).toHaveText(name)
  })

  test('affiche le nom, le prix, la description, les caractéristiques, l’image de l’API et le chemin de sa catégorie', async ({
    page,
  }) => {
    await page.goto(PRODUCT)

    await expect(page.getByTestId('product-title')).toHaveText('Monstera deliciosa')
    await expect(page.getByTestId('product-price')).toHaveText(/34,90\s€/)
    const description = page.getByTestId('product-description').locator('p')
    await expect(description).toHaveCount(2)
    await expect(description.first()).toContainText('Grandes feuilles vert profond')
    await expect(page.getByTestId('product-page').locator('dd').first()).toHaveText('Mi-ombre')
    const image = page.getByTestId('product-page').locator('img').first()
    await expect(image).toHaveAttribute('fetchpriority', 'high')
    await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0)
    const breadcrumb = page.getByTestId('layout-breadcrumb')
    await expect(breadcrumb).toContainText('Feuillages')
    await expect(breadcrumb.getByRole('link', { name: 'Monstera', exact: true })).toHaveAttribute(
      'href',
      '/catalogue/plantes-interieur/feuillages/monstera',
    )
  })

  test('affiche ses attributs en liste de définitions, et aucune liste sans attribut', async ({
    page,
  }) => {
    await page.goto(PRODUCT)
    const attributes = page.getByTestId('product-attributes')
    await expect(attributes.locator('dt')).toHaveText(['Feuillage', 'Hauteur adulte'])
    await expect(attributes.locator('dd')).toHaveText(['Persistant', '300\u00a0cm'])

    await page.goto('/produit/anthurium-andreanum-rouge')
    await expect(page.getByTestId('product-title')).toHaveText(/Anthurium/)
    await expect(page.getByTestId('product-attributes')).toHaveCount(0)
  })

  test('affiche une galerie : vignettes en boutons, image changée au clic et aux flèches', async ({
    page,
  }) => {
    await page.goto(PRODUCT)
    const gallery = page.getByTestId('product-gallery')
    const main = gallery.locator('picture img')
    const thumbs = gallery.getByTestId('product-gallery-thumb')

    await expect(thumbs).toHaveCount(3)
    await expect(thumbs.first()).toHaveJSProperty('tagName', 'BUTTON')
    await expect(thumbs.nth(1)).toHaveAccessibleName("Voir l'image 2 sur 3")
    await expect(thumbs.first()).toHaveAttribute('aria-current', 'true')
    await expect(main).toHaveAttribute('fetchpriority', 'high')
    await expect(thumbs.first().locator('img')).toHaveAttribute('loading', 'lazy')
    const first = await main.getAttribute('src')

    await thumbs.nth(1).click()
    await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
    await expect(thumbs.first()).toHaveAttribute('aria-current', 'false')
    await expect(main).not.toHaveAttribute('src', first)

    await page.keyboard.press('ArrowRight')
    await expect(thumbs.nth(2)).toBeFocused()
    await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(thumbs.first()).toBeFocused()
    await expect(thumbs.first()).toHaveAttribute('aria-current', 'true')
    await expect(main).toHaveAttribute('src', first)
    await page.keyboard.press('ArrowLeft')
    await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true')
  })

  test('n’affiche pas de galerie sans images supplémentaires', async ({ page }) => {
    await page.goto('/produit/anthurium-andreanum-rouge')

    await expect(page.getByTestId('product-title')).toHaveText(/Anthurium/)
    await expect(page.getByTestId('product-gallery')).toHaveCount(0)
    await expect(page.getByTestId('product-gallery-thumb')).toHaveCount(0)
    await expect(page.getByTestId('product-page').locator('picture img')).toHaveAttribute(
      'fetchpriority',
      'high',
    )
  })

  test('porte le titre et la description saisis dans l’admin', async ({ page }) => {
    await page.route('**/api/products/monstera-deliciosa', async (route) => {
      const response = await route.fetch()
      const product = await response.json()
      await route.fulfill({
        response,
        json: {
          ...product,
          metaTitle: 'Monstera deliciosa en pot, livraison soignée',
          metaDescription:
            'Monstera deliciosa de 60 cm en pot : une grande plante d’intérieur facile, livrée avec ses conseils.',
        },
      })
    })
    await page.goto(PRODUCT)

    await expect(page).toHaveTitle('Monstera deliciosa en pot, livraison soignée')
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /^Monstera deliciosa de 60 cm en pot/,
    )
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Monstera deliciosa en pot, livraison soignée',
    )
  })

  test('garde le titre et la description calculés sans saisie', async ({ page }) => {
    await page.goto(PRODUCT)

    await expect(page).toHaveTitle(/^Monstera deliciosa · /)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /^Monstera deliciosa : exposition mi-ombre/,
    )
  })

  test('expose ses données structurées de produit', async ({ page }) => {
    await page.goto(PRODUCT)

    const data = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
      (text) => JSON.parse(text),
    )
    expect(data.map((item) => item['@type'])).toEqual(
      expect.arrayContaining(['Product', 'BreadcrumbList']),
    )
    const product = data.find((item) => item['@type'] === 'Product')
    expect(product?.offers?.price).toBe('34.90')
    expect(product?.description).toMatch(/^Grandes feuilles vert profond.+aide à grimper\.$/)
  })

  test('propose les autres produits de sa catégorie, sans lui-même', async ({ page }) => {
    await page.goto(PRODUCT)

    const similar = page.getByTestId('product-similar')
    await expect(similar.getByRole('heading', { level: 2 })).toHaveText('Produits similaires')
    const links = similar.getByTestId('carousel-slide-link')
    await expect(links).toHaveText(['Monstera adansonii', 'Monstera Thai Constellation'])
    await expect(similar).not.toContainText('Monstera deliciosa')
    await links.first().click()

    await expect(page).toHaveURL('/produit/monstera-adansonii')
    await expect(page.getByTestId('product-title')).toHaveText('Monstera adansonii')
  })

  test('annonce un produit inconnu, page hors de l’index (pas de vraie 404 sans serveur)', async ({
    page,
  }) => {
    await page.goto('/produit/produit-inconnu')

    await expect(page.getByTestId('product-not-found')).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })
})

test.describe('Fiche produit sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('les vignettes de la galerie sont des liens vers l’image en grand', async ({ page }) => {
    await page.goto(PRODUCT)
    const thumbs = page.getByTestId('product-gallery').getByTestId('product-gallery-thumb')

    await expect(thumbs).toHaveCount(3)
    await expect(thumbs.first()).toHaveJSProperty('tagName', 'A')
    await expect(thumbs.nth(2)).toHaveAttribute('href', /-800\.webp$/)
    await expect(thumbs.nth(2)).toHaveAccessibleName("Voir l'image 3 sur 3")
  })
})
