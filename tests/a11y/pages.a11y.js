import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { enableDarkMode, enableEnhancedMode, ROUTES } from '../e2e/routes.js'

const MODES = [
  { name: 'standard', enhanced: false },
  { name: 'sombre', enhanced: false, dark: true },
  { name: 'renforcé', enhanced: true },
]

const EXTRA_ROUTES = [
  '/route-inexistante',
  '/_erreur-test',
  '/charte-graphique',
  '/catalogue?exposition=soleil&tri=prix-asc',
  '/panier',
  '/contact?produit=monstera-deliciosa',
  '/blog?rubrique=conseils',
  '/blog/un-carrousel-accessible-sans-dependance',
]

const audit = async (page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
}

for (const mode of MODES) {
  test.describe(`mode ${mode.name}`, () => {
    test.beforeEach(async ({ page }) => {
      if (mode.enhanced) await enableEnhancedMode(page)
      if (mode.dark) await enableDarkMode(page)
    })

    for (const route of [...ROUTES, ...EXTRA_ROUTES]) {
      test(`${route} ne présente aucune violation axe WCAG 2.1 AA`, async ({ page }) => {
        await page.goto(route)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        if (mode.enhanced) {
          await expect(page.locator('html')).toHaveAttribute('data-a11y-mode', 'enhanced')
        }
        await audit(page)
      })
    }

    test('panier rempli sans violation axe', async ({ page }) => {
      await page.goto('/produit/monstera-deliciosa')
      await page.getByTestId('add-to-cart').click()
      await expect(page.getByTestId('cart-count')).toHaveText('1')
      await page.goto('/panier')
      await expect(page.getByTestId('cart-line')).toHaveCount(1)
      await audit(page)
    })

    test('facette d’attribut cochée sans violation axe', async ({ page }) => {
      await page.goto('/catalogue?attr-feuillage=persistant')
      await expect(page.getByTestId('catalog-filter-attribute-feuillage-persistant')).toBeChecked()
      await audit(page)
    })

    test('menu ouvert sans violation axe', async ({ page, isMobile }) => {
      await page.goto('/')
      if (isMobile) {
        await page.getByTestId('layout-mobile-menu-toggle').click()
        await page.getByTestId('layout-mobile-menu-level-catalogue').click()
      } else {
        await page.getByTestId('layout-category-menu-toggle').click()
        await page
          .getByTestId('layout-category-menu')
          .getByRole('link', { name: 'Plantes d’intérieur' })
          .hover()
      }
      await audit(page)
    })
  })
}
