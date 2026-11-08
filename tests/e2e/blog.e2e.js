import { expect, test } from '@playwright/test'

import { withScenario } from './routes.js'

const apiArticles = async (request) => {
  const response = await request.get(
    `${process.env.API_URL || 'http://localhost:8090'}/api/articles`,
  )
  return response.json()
}

test.describe('Liste des articles', () => {
  test('affiche tous les articles de l’API, du plus récent au plus ancien', async ({
    page,
    request,
  }) => {
    const articles = await apiArticles(request)
    await page.goto('/blog')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blog')
    const cards = page.getByTestId('blog-list').getByTestId('blog-card')
    await expect(cards).toHaveCount(articles.length)
    await expect(cards.locator('h2')).toHaveText(articles.map((article) => article.title))
    await expect(cards.first().locator('time')).toHaveAttribute('datetime', articles[0].publishedAt)
    await expect(page.getByTestId('blog-empty')).toHaveCount(0)
    await expect(page.getByTestId('layout-breadcrumb').getByRole('listitem')).toHaveText([
      'Accueil',
      'Blog',
    ])
  })

  test('écrit la rubrique en sur-titre des cartes, sur /blog et sur l’accueil', async ({
    page,
    request,
  }) => {
    const articles = await apiArticles(request)
    await page.goto('/blog')
    await expect(page.getByTestId('blog-card').getByTestId('article-section')).toHaveText(
      articles.map((article) => article.section.name),
    )

    await page.goto('/')
    await expect(
      page.getByTestId('home-blog-card').first().getByTestId('article-section'),
    ).toHaveText(articles[0].section.name)
  })

  test('filtre par rubrique, active dans la navigation et dans l’adresse', async ({ page }) => {
    await page.goto('/blog')
    const nav = page.getByRole('navigation', { name: 'Rubriques' })

    await expect(nav.getByRole('link')).toHaveText(['Toutes', 'Conseils', 'Actualités'])
    await expect(nav.getByRole('link', { name: 'Toutes' })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('link', { name: 'Conseils' }).click()

    await expect(page).toHaveURL(/\/blog\?rubrique=conseils$/)
    await expect(nav.getByRole('link', { name: 'Conseils' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.getByRole('link', { name: 'Toutes' })).not.toHaveAttribute('aria-current')
    const sections = page.getByTestId('blog-card').getByTestId('article-section')
    await expect(sections).toHaveText(['Conseils', 'Conseils'])
  })

  test('sans rubrique, ni filtre ni sur-titre', async ({ page }) => {
    await page.route('**/api/article-sections', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/articles', async (route) => {
      const response = await route.fetch()
      const articles = await response.json()
      await route.fulfill({
        response,
        json: articles.map((article) => ({ ...article, section: null })),
      })
    })
    await page.goto('/blog')

    await expect(page.getByTestId('blog-card').first()).toBeVisible()
    await expect(page.getByTestId('blog-sections')).toHaveCount(0)
    await expect(page.getByTestId('article-section')).toHaveCount(0)
  })

  test('une carte ouvre la fiche de son article', async ({ page }) => {
    await page.goto('/blog')

    const card = page.getByTestId('blog-card').first()
    await expect(card.locator('h2')).not.toHaveText('Article')
    const title = ((await card.locator('h2').textContent()) ?? '').trim()
    await card.getByRole('link').click()

    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/)
    await expect(page.getByTestId('article-title')).toHaveText(title)
  })

  test('répartit les cartes sur trois colonnes en desktop', async ({ page, isMobile }) => {
    test.skip(isMobile, 'une seule colonne en mobile, vérifiée par le test suivant')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/blog')

    const cards = page.getByTestId('blog-card')
    await expect(cards.nth(2)).toBeVisible()
    const boxes = await Promise.all([0, 1, 2].map((index) => cards.nth(index).boundingBox()))
    expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1)
  })

  test('empile les cartes sur une colonne en mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile seulement')
    await page.goto('/blog')

    const cards = page.getByTestId('blog-card')
    await expect(cards.nth(1)).toBeVisible()
    const [first, second] = await Promise.all([
      cards.nth(0).boundingBox(),
      cards.nth(1).boundingBox(),
    ])
    expect(second.y).toBeGreaterThan(first.y + first.height - 1)
    expect(Math.round(second.x)).toBe(Math.round(first.x))
  })

  test('affiche un message amical quand l’API ne renvoie aucun article', async ({ page }) => {
    await withScenario(page, 'empty')
    await page.goto('/blog')

    await expect(page.getByTestId('blog-empty')).toBeVisible()
    await expect(page.getByTestId('blog-card')).toHaveCount(0)
  })

  test('propose de réessayer quand l’API échoue', async ({ page }) => {
    await withScenario(page, 'error')
    await page.goto('/blog')

    await expect(page.getByTestId('blog-error')).toContainText(
      'Impossible de charger les articles pour le moment.',
    )
    await page.getByTestId('blog-retry').click()
    await expect(page.getByTestId('blog-error')).toBeVisible()
  })

  test('est liée depuis la grille de l’accueil', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('home-blog-all').click()

    await expect(page).toHaveURL(/\/blog$/)
  })
})
