import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import {
  BRANDED_IDENTITY,
  enableDarkMode,
  enableEnhancedMode,
  withIdentity,
} from '../e2e/routes.js'

const MODES = [
  { name: 'standard' },
  { name: 'sombre', setup: enableDarkMode },
  { name: 'renforcé', setup: enableEnhancedMode },
]

for (const mode of MODES) {
  for (const route of ['/', '/contact']) {
    test(`${route} avec logo et couleurs de l’API, mode ${mode.name}, sans violation axe`, async ({
      page,
    }) => {
      await mode.setup?.(page)
      await withIdentity(page, BRANDED_IDENTITY)
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
}
