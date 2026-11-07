import { expect, test } from '@playwright/test'

const ARTICLE = '/blog/un-carrousel-accessible-sans-dependance'

test.describe('Fiche article', () => {
  test('s’ouvre depuis une carte de l’accueil', async ({ page }) => {
    await page.goto('/')

    const card = page.getByTestId('home-blog-card').first()
    await expect(card.locator('h3')).not.toHaveText('Article')
    const title = (await card.locator('h3').textContent()) ?? ''
    await card.getByRole('link').click()

    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/)
    await expect(page.getByTestId('article-title')).toHaveText(title.trim())
  })

  test('affiche le titre, la date, l’image de l’API et le texte', async ({ page }) => {
    await page.goto(ARTICLE)

    await expect(page.getByTestId('article-title')).toHaveText(
      'Un carrousel accessible sans dépendance',
    )
    await expect(page.getByTestId('article-page').locator('time')).toHaveAttribute(
      'datetime',
      '2026-09-22',
    )
    await expect(page.getByTestId('article-body').locator('h2').first()).toHaveText(
      'Partir du défilement natif',
    )
    await expect(page.getByTestId('article-body').locator('li')).toHaveCount(3)
    const image = page.getByTestId('article-page').locator('img').first()
    await expect(image).toHaveAttribute('fetchpriority', 'high')
    await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0)
    await expect(page.getByTestId('layout-breadcrumb')).toContainText(
      'Un carrousel accessible sans dépendance',
    )
    await expect(page).toHaveTitle(/^Un carrousel accessible sans dépendance · /)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  })

  test('signale un article inconnu, hors de l’index', async ({ page }) => {
    await page.goto('/blog/article-inconnu')

    await expect(page.getByTestId('article-not-found')).toBeVisible()
    await expect(page.getByTestId('article-title')).toHaveText('Article introuvable')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })
})
