import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { enableDarkMode, enableEnhancedMode } from './routes.js'

const MODES = [
  { name: 'standard' },
  { name: 'sombre', setup: enableDarkMode },
  { name: 'renforcé', setup: enableEnhancedMode },
]

// Images servies par l'API (`/media/`) : réponse 404 interceptée avant le réseau
const failApiImages = (page) => page.route('**/media/**', (route) => route.fulfill({ status: 404 }))

const firstCard = async (page) => {
  await page.goto('/catalogue')
  const card = page.getByTestId('catalog-product').first()
  await expect(card.locator('h2')).not.toHaveText('Produit')
  return card
}

test.describe('Image de l’API en échec', () => {
  test('une image chargée ne porte pas la marque', async ({ page }) => {
    const card = await firstCard(page)
    const image = card.locator('picture img')

    await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0)
    await expect(card.locator('picture')).not.toHaveAttribute('data-image-error')
    await expect(image).toHaveCSS('opacity', '1')
  })

  test('une image en 404 laisse un fond de remplacement, à dimensions de carte inchangées', async ({
    page,
  }) => {
    const loaded = await (await firstCard(page)).boundingBox()

    await failApiImages(page)
    const card = await firstCard(page)
    const picture = card.locator('picture')

    await expect(picture).toHaveAttribute('data-image-error', '')
    await expect(picture.locator('img')).toHaveCSS('opacity', '0')
    await expect(picture.locator('img')).toHaveAttribute('alt', /.+/)
    expect(await card.boundingBox()).toEqual(loaded)
  })

  test('une image pré-rendue en échec avant le JavaScript est marquée', async ({ page }) => {
    await failApiImages(page)
    await page.goto('/produit/monstera-deliciosa')

    const picture = page.getByTestId('product-page').locator('picture').first()
    await expect(picture).toHaveAttribute('data-image-error', '')
    await expect(picture.locator('img')).toHaveCSS('opacity', '0')
  })

  test('une vignette de la galerie en 404 est marquée, à taille inchangée', async ({ page }) => {
    const thumb = page.getByTestId('product-gallery-thumb').nth(1)
    await page.goto('/produit/monstera-deliciosa')
    await expect(thumb).toHaveJSProperty('tagName', 'BUTTON')
    const size = async () => {
      const { width, height } = (await thumb.boundingBox()) ?? {}
      return { width, height }
    }
    const loaded = await size()

    await failApiImages(page)
    await page.reload()
    await expect(thumb).toHaveJSProperty('tagName', 'BUTTON')
    await thumb.scrollIntoViewIfNeeded()
    const picture = thumb.locator('picture')
    await expect(picture).toHaveAttribute('data-image-error', '')
    await expect(picture.locator('img')).toHaveCSS('opacity', '0')
    expect(await size()).toEqual(loaded)
    expect(await picture.boundingBox()).toEqual(await picture.locator('img').boundingBox())
  })

  for (const mode of MODES) {
    test(`fond de remplacement sans violation axe, mode ${mode.name}`, async ({ page }) => {
      await mode.setup?.(page)
      await failApiImages(page)
      const card = await firstCard(page)
      await expect(card.locator('picture')).toHaveAttribute('data-image-error', '')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})
