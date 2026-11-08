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

  test('affiche sa rubrique et un lecteur audio avec durée et intervenant, sans autolecture', async ({
    page,
  }) => {
    await page.goto(ARTICLE)
    const audio = page.getByTestId('article-audio')

    await expect(page.getByTestId('article-section')).toHaveText('Rubrique : Conseils')
    await expect(page.getByTestId('article-format')).toHaveCount(0)
    await expect(audio).toHaveAttribute('controls', '')
    await expect(audio).toHaveAttribute('preload', 'none')
    await expect(audio).not.toHaveAttribute('autoplay')
    await expect(page.locator('[data-article-audio-caption]')).toHaveText(
      "Écouter l'article (4 s) · Présenté par Hina Teriierooiterai",
    )
    expect(await audio.evaluate((element) => element.paused)).toBe(true)
    // Le fichier vient de l'origine de l'API : la CSP l'autorise en media-src
    const duration = await audio.evaluate(
      (element) =>
        new Promise((resolve, reject) => {
          element.addEventListener('loadedmetadata', () => resolve(element.duration))
          element.addEventListener('error', () => reject(new Error('audio refusé')))
          element.preload = 'metadata'
          element.load()
        }),
    )
    expect(Math.round(duration)).toBe(4)
  })

  test('affiche son format, et aucun lecteur sans audio', async ({ page }) => {
    await page.goto('/blog/pourquoi-rendre-le-contenu-cote-serveur')

    await expect(page.getByTestId('article-section')).toHaveText('Rubrique : Conseils')
    await expect(page.getByTestId('article-format')).toHaveText('Format : Guide')
    await expect(page.getByTestId('article-audio')).toHaveCount(0)
  })

  test('n’affiche ni rubrique ni format quand l’article n’en a pas', async ({ page }) => {
    await page.route('**/api/articles/le-mode-accessibilite-renforcee', async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...(await response.json()), section: null } })
    })
    await page.goto('/blog/le-mode-accessibilite-renforcee')

    await expect(page.getByTestId('article-section')).toHaveCount(0)
    await expect(page.getByTestId('article-format')).toHaveCount(0)
    await expect(page.locator('[data-article-taxonomy]')).toHaveCount(0)
  })

  test('porte le titre et la description saisis dans l’admin, sinon ceux calculés', async ({
    page,
  }) => {
    await page.goto(ARTICLE)
    await expect(page).toHaveTitle(/^Un carrousel accessible sans dépendance · /)

    await page.route(`**/api${ARTICLE.replace('/blog', '/articles')}`, async (route) => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        json: {
          ...(await response.json()),
          metaTitle: 'Carrousel accessible : le guide sans dépendance',
          metaDescription:
            'Construire un carrousel accessible sans bibliothèque : défilement natif, boutons explicites et aucune lecture automatique.',
        },
      })
    })
    await page.reload()

    await expect(page).toHaveTitle('Carrousel accessible : le guide sans dépendance')
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      /^Construire un carrousel accessible sans bibliothèque/,
    )
  })

  test('propose le lien « Tous les articles » vers la liste', async ({ page }) => {
    await page.goto(ARTICLE)

    await page.getByTestId('article-back').click()

    await expect(page).toHaveURL(/\/blog$/)
  })

  test('a un fil d’Ariane Accueil › Blog › titre, qui mène à la liste', async ({ page }) => {
    await page.goto(ARTICLE)

    const breadcrumb = page.getByTestId('layout-breadcrumb')
    await expect(breadcrumb.getByRole('listitem')).toHaveText([
      'Accueil',
      'Blog',
      'Un carrousel accessible sans dépendance',
    ])
    await breadcrumb.getByRole('link', { name: 'Blog' }).click()

    await expect(page).toHaveURL(/\/blog$/)
    await expect(page.getByTestId('blog-list')).toBeVisible()
  })

  test('signale un article inconnu, hors de l’index', async ({ page }) => {
    await page.goto('/blog/article-inconnu')

    await expect(page.getByTestId('article-not-found')).toBeVisible()
    await expect(page.getByTestId('article-title')).toHaveText('Article introuvable')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })
})
