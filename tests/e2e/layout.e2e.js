import { expect, test } from '@playwright/test'

import { enableEnhancedMode, ROUTES } from './routes.js'

const WIDTHS = [375, 768, 1280]
const MODES = [
  { name: 'standard', enhanced: false },
  { name: 'renforcé', enhanced: true },
]

test.describe('Mise en page', () => {
  test.skip(({ isMobile }) => isMobile, 'largeurs pilotées explicitement')

  for (const mode of MODES) {
    for (const width of WIDTHS) {
      test(`aucun débordement horizontal à ${width} px en mode ${mode.name}`, async ({ page }) => {
        if (mode.enhanced) await enableEnhancedMode(page)
        await page.setViewportSize({ width, height: 900 })

        for (const route of ROUTES) {
          await page.goto(route)
          const [scrollWidth, innerWidth] = await page.evaluate(() => [
            document.documentElement.scrollWidth,
            window.innerWidth,
          ])
          expect(scrollWidth, route).toBeLessThanOrEqual(innerWidth)
        }
      })

      test(`capture de l’accueil et du catalogue à ${width} px en mode ${mode.name}`, async ({
        page,
      }, testInfo) => {
        if (mode.enhanced) await enableEnhancedMode(page)
        await page.setViewportSize({ width, height: 900 })
        for (const route of ['/', '/catalogue']) {
          await page.goto(route)
          if (route === '/catalogue')
            await expect(page.getByTestId('catalog-pagination')).toBeVisible()
          await page.screenshot({
            path: testInfo.outputPath(
              `${route === '/' ? 'accueil' : 'catalogue'}-${mode.enhanced ? 'renforce' : 'standard'}-${width}.png`,
            ),
            fullPage: true,
          })
        }
      })
    }
  }

  test('le mode renforcé agrandit sans casser la structure du header', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const measure = async (route) => {
      await page.goto(route)
      const header = await page.locator('header.site-header').boundingBox()
      const h1 = await page.getByRole('heading', { level: 1 }).boundingBox()
      return { header: header.height, h1: h1.y }
    }

    const normal = {}
    for (const route of ROUTES) normal[route] = await measure(route)
    await enableEnhancedMode(page)
    for (const route of ROUTES) {
      const enhanced = await measure(route)
      expect(enhanced.header, route).toBeLessThanOrEqual(normal[route].header * 1.4)
      expect(enhanced.h1, route).toBeLessThanOrEqual(normal[route].h1 * 1.4)
    }
  })

  test('le logo mène à l’accueil et porte aria-current sur l’accueil', async ({ page }) => {
    await page.goto('/')
    const logo = page.getByTestId('layout-logo')
    await expect(logo).toHaveAccessibleName('Boilerplate HTML')
    await expect(logo).toHaveAttribute('aria-current', 'page')

    await page.goto('/contact')
    await expect(logo).toHaveAttribute('href', '/')
    await expect(logo).not.toHaveAttribute('aria-current')
  })

  test('le fil d’Ariane est absent de l’accueil et présent sur une page interne', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('layout-breadcrumb')).toHaveCount(0)

    await page.goto('/catalogue/plantes-interieur/feuillages')
    const breadcrumb = page.getByTestId('layout-breadcrumb')
    await expect(breadcrumb.getByRole('listitem')).toHaveText([
      'Accueil',
      'Catalogue',
      'Plantes d’intérieur',
      'Feuillages',
    ])
    await expect(breadcrumb.getByText('Feuillages')).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('Header mobile compact', () => {
  test.skip(({ isMobile }) => !isMobile, 'header compact réservé au mobile')

  for (const mode of MODES) {
    test(`tient sur une ligne à 375 px avec deux boutons icône en mode ${mode.name}`, async ({
      page,
    }) => {
      if (mode.enhanced) await enableEnhancedMode(page)
      await page.setViewportSize({ width: 375, height: 800 })
      await page.goto('/contact')
      const logo = await page.getByTestId('layout-logo').boundingBox()
      const menu = page.getByTestId('layout-mobile-menu-toggle')
      const a11y = page.getByTestId('a11y-mode-toggle')

      await expect(menu).toHaveAccessibleName('Menu')
      await expect(a11y).toHaveAccessibleName('Accessibilité renforcée')
      for (const button of [menu, a11y]) {
        const box = await button.boundingBox()
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.x).toBeGreaterThan(logo.x + logo.width - 1)
        expect(Math.abs(box.y + box.height / 2 - (logo.y + logo.height / 2))).toBeLessThan(
          logo.height / 2,
        )
      }

      await expect(menu).toHaveAttribute('aria-expanded', 'false')
      await menu.click()
      await expect(page.getByTestId('layout-mobile-menu')).toBeVisible()
      await expect(menu).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('Escape')
      await expect(menu).toBeFocused()

      const pressed = mode.enhanced ? 'true' : 'false'
      await expect(a11y).toHaveAttribute('aria-pressed', pressed)
    })
  }
})

test.describe('Header desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'libellés visibles réservés au desktop')

  test('garde le libellé visible du bouton du mode renforcé et masque le bouton Menu', async ({
    page,
  }) => {
    await page.goto('/contact')

    await expect(page.getByTestId('a11y-mode-toggle')).toContainText('Accessibilité renforcée')
    await expect(page.getByTestId('a11y-mode-toggle')).toHaveAccessibleName(
      'Accessibilité renforcée',
    )
    await expect(page.getByTestId('layout-mobile-menu-toggle')).toBeHidden()
  })
})
