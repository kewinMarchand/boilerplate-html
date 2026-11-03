import { expect, test } from '@playwright/test'

import { prerenderCarousel } from '../../scripts/prerender-content.js'
import { withScenario } from './routes.js'

const currentDot = (page) => page.locator('[data-testid="carousel-dot"][aria-current="true"]')

// Cinq diapositives fictives, écrites dans l'accueil comme le fait l'image de production
const SLIDES = [1, 2, 3, 4, 5].map((image) => ({
  id: String(image),
  slug: `diapositive-${image}`,
  title: `Diapositive ${image}`,
  text: 'Texte de la diapositive.',
  image,
}))

test.describe('Accueil', () => {
  test('le hero porte le titre, les deux appels à l’action et une image prioritaire', async ({
    page,
  }) => {
    await page.goto('/')

    const hero = page.getByTestId('home-hero')
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Boilerplate HTML')
    await expect(page.getByTestId('home-tasks-link')).toHaveAttribute('href', '/taches')
    await expect(page.getByTestId('home-contact-link')).toHaveAttribute('href', '/contact')
    await expect(hero.locator('img')).toHaveAttribute('fetchpriority', 'high')
    await expect(hero.locator('img')).not.toHaveAttribute('loading', 'lazy')
    const box = await page.getByTestId('home-tasks-link').boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  })

  test('le carrousel avance avec Suivant et désactive Précédent au début', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('carousel-slide')).toHaveCount(5)
    await expect(page.getByTestId('carousel-prev')).toBeDisabled()
    await expect(currentDot(page)).toHaveAttribute('aria-label', 'Aller à la diapositive 1')

    await page.getByTestId('carousel-next').click()
    await expect(currentDot(page)).toHaveAttribute('aria-label', 'Aller à la diapositive 2')
    await expect(page.getByTestId('carousel-prev')).toBeEnabled()

    await page.getByTestId('carousel-prev').click()
    await expect(currentDot(page)).toHaveAttribute('aria-label', 'Aller à la diapositive 1')
  })

  test('le carrousel affiche les diapositives de l’API, sans message d’erreur', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByTestId('carousel-slide').first()).toContainText('Heliconia')
    await expect(page.getByTestId('carousel-slide').first()).toHaveAttribute(
      'aria-label',
      '1 sur 5',
    )
    await expect(page.getByTestId('home-carousel-error')).toHaveCount(0)
  })

  test('le carrousel affiche un message et propose de réessayer quand l’API échoue', async ({
    page,
  }) => {
    await withScenario(page, 'error')
    await page.goto('/')

    await expect(page.getByTestId('home-carousel-error')).toContainText(
      'Impossible de charger le carrousel pour le moment.',
    )
    await expect(page.getByTestId('carousel-next')).toBeHidden()
    await page.getByTestId('home-carousel-retry').click()
    await expect(page.getByTestId('home-carousel-error')).toBeVisible()
  })

  test('la section du carrousel disparaît quand l’API ne renvoie aucune diapositive', async ({
    page,
  }) => {
    await withScenario(page, 'empty')
    await page.goto('/')

    await expect(page.getByTestId('home-carousel')).toHaveCount(0)
    await expect(page.getByTestId('home-hero')).toBeVisible()
  })

  test('le carrousel se glisse à la souris', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('carousel-track').scrollIntoViewIfNeeded()
    const track = await page.getByTestId('carousel-track').boundingBox()
    const y = track.y + track.height / 2

    // Glisser de 80 % de la piste : au-delà de la moitié d'une diapositive en mobile, Embla
    // avance même si le relâcher n'est pas compté comme un geste vif (machine chargée).
    await page.mouse.move(track.x + track.width * 0.9, y)
    await page.mouse.down()
    await page.mouse.move(track.x + track.width * 0.1, y, { steps: 10 })
    await page.mouse.up()

    await expect(currentDot(page)).not.toHaveAttribute('aria-label', 'Aller à la diapositive 1')
    await expect(page.getByTestId('carousel-prev')).toBeEnabled()
  })

  test('un geste de trackpad n’avance que d’une diapositive', async ({ page }) => {
    await page.goto('/')
    const track = page.getByTestId('carousel-track')
    await track.scrollIntoViewIfNeeded()
    const box = await track.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

    for (let index = 0; index < 4; index += 1) await page.mouse.wheel(120, 0)

    await expect(currentDot(page)).toHaveAttribute('aria-label', 'Aller à la diapositive 2')
  })

  test('la grille de blog affiche trois articles datés, sans message vide', async ({ page }) => {
    await page.goto('/')

    const cards = page.getByTestId('home-blog-card')
    await expect(cards).toHaveCount(3)
    await expect(cards.first().locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/)
    await expect(page.getByTestId('home-blog-empty')).toBeHidden()
  })

  test('la grille de blog affiche un message amical quand l’API ne renvoie aucun article', async ({
    page,
  }) => {
    await withScenario(page, 'empty')
    await page.goto('/')

    await expect(page.getByTestId('home-blog-empty')).toBeVisible()
    await expect(page.getByTestId('home-blog-card')).toHaveCount(0)
  })

  test('la grille de blog propose de réessayer quand l’API échoue', async ({ page }) => {
    await withScenario(page, 'error')
    await page.goto('/')

    await expect(page.getByTestId('home-blog-error')).toContainText(
      'Impossible de charger les articles pour le moment.',
    )
    await page.getByTestId('home-blog-retry').click()
    await expect(page.getByTestId('home-blog-error')).toBeVisible()
  })
})

test.describe('Accueil sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('le carrousel annonce que ses diapositives demandent JavaScript', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('home-carousel-noscript')).toBeVisible()
    await expect(page.getByTestId('carousel-slide')).toHaveCount(0)
  })

  test('la piste du carrousel pré-rendu défile nativement', async ({ page }) => {
    // Le serveur de développement ne pré-rend rien : l'accueil est pré-rendu ici comme dans l'image
    await page.route('/', async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, body: prerenderCarousel(await response.text(), SLIDES) })
    })
    await page.goto('/')
    const track = page.getByTestId('carousel-track')

    await expect(page.getByTestId('carousel-next')).toBeHidden()
    await expect(page.getByTestId('carousel-slide').last()).not.toBeInViewport()
    await track.scrollIntoViewIfNeeded()
    const box = await track.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(5000, 0)
    await expect(page.getByTestId('carousel-slide').last()).toBeInViewport()
  })
})
