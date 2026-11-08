import { expect, test } from '@playwright/test'

import { ROUTES } from './routes.js'

const SITE_URL = 'https://www.example.com'

test.describe('SEO', () => {
  test.skip(({ isMobile }) => isMobile, 'métadonnées identiques sur mobile')

  for (const route of ROUTES) {
    test(`la page ${route} porte ses métadonnées`, async ({ page }) => {
      await page.goto(route)
      const head = page.locator('head')

      const title = await page.title()
      expect(title.length).toBeGreaterThan(0)
      expect(title.length).toBeLessThanOrEqual(60)

      const description = await head.locator('meta[name="description"]').getAttribute('content')
      expect(description?.length).toBeGreaterThanOrEqual(50)
      expect(description?.length).toBeLessThanOrEqual(160)
      await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${SITE_URL}${route}`,
      )
      for (const property of ['og:title', 'og:description', 'og:image']) {
        await expect(head.locator(`meta[property="${property}"]`)).toHaveAttribute('content', /.+/)
      }

      const blocks = await head.locator('script[type="application/ld+json"]').allTextContents()
      const data = blocks.map((block) => JSON.parse(block))
      expect(data.length).toBeGreaterThan(0)
      if (route !== '/') {
        const breadcrumb = data.find((item) => item['@type'] === 'BreadcrumbList')
        const visible = await page.getByTestId('layout-breadcrumb').getByRole('listitem').count()
        expect(breadcrumb.itemListElement).toHaveLength(visible)
      }
    })
  }
})
