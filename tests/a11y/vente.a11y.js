import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { enableDarkMode, enableEnhancedMode, withIdentity } from '../e2e/routes.js'

const API_URL = process.env.API_URL || 'http://localhost:8090'

const MODES = [
  { name: 'standard' },
  { name: 'sombre', setup: enableDarkMode },
  { name: 'renforcé', setup: enableEnhancedMode },
]

for (const mode of MODES) {
  for (const route of ['/produit/monstera-deliciosa', '/contact?produit=monstera-deliciosa']) {
    test(`${route} sans vente en ligne, mode ${mode.name}, sans violation axe`, async ({
      page,
      request,
    }) => {
      const identity = await (await request.get(`${API_URL}/api/site-identity`)).json()
      await mode.setup?.(page)
      await withIdentity(page, { ...identity, salesEnabled: false })
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(
        page.getByTestId('product-inquiry').or(page.getByTestId('contact-product')),
      ).toBeVisible()

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
}
