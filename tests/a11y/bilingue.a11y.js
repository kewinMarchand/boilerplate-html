import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { BILINGUAL_PORT } from '../../playwright.config.js'
import { enableDarkMode, enableEnhancedMode } from '../e2e/routes.js'

// Pages anglaises du site bilingue des tests (tests/e2e/bilingue.e2e.js), dans les trois modes
const ENGLISH_ROUTES = [
  '/en',
  '/en/catalogue',
  '/en/catalogue/indoor-plants',
  '/en/produit/swiss-cheese-plant',
  '/en/blog',
  '/en/blog/enhanced-accessibility-mode',
  '/en/contact',
  '/en/taches',
  '/en/mentions-legales',
  '/en/donnees-personnelles',
  '/en/plan-du-site',
  '/en/panier',
]

const MODES = [
  { name: 'standard' },
  { name: 'sombre', setup: enableDarkMode },
  { name: 'renforcé', setup: enableEnhancedMode },
]

test.use({ baseURL: `http://localhost:${BILINGUAL_PORT}` })

for (const mode of MODES) {
  for (const route of ENGLISH_ROUTES) {
    test(`${route}, mode ${mode.name}, sans violation axe`, async ({ page }) => {
      await mode.setup?.(page)
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
}
