import { expect, test } from '@playwright/test'

import { prerenderCarousel } from '../../scripts/prerender-content.js'
import { withScenario } from './routes.js'

const currentDot = (page) => page.locator('[data-testid="carousel-dot"][aria-current="true"]')

const cardBoxes = async (page) => {
  const cards = page.getByTestId('home-blog-card')
  await expect(cards).toHaveCount(3)
  return Promise.all([0, 1, 2].map((index) => cards.nth(index).boundingBox()))
}

// Cinq produits à la une fictifs, écrits dans l'accueil comme le fait l'image de production
const SLIDES = [1, 2, 3, 4, 5].map((position) => ({
  id: position,
  slug: `produit-${position}`,
  name: `Produit ${position}`,
  categorySlug: 'heliconia',
  price: 1990,
  exposure: 'soleil',
  size: 'M',
  inStock: true,
  image: null,
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

  test('le carrousel affiche les produits à la une de l’API, sans message d’erreur', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByTestId('carousel-slide').first()).toContainText(
      'Anthurium andreanum rouge',
    )
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
    // Le geste part d'une diapositive cliquable : il fait défiler sans ouvrir la fiche
    await expect(page).toHaveURL('/')
  })

  test('une diapositive ouvre la fiche de son produit', async ({ page }) => {
    await page.goto('/')
    const link = page.getByTestId('carousel-slide-link').first()
    await expect(link).toHaveAttribute('href', /^\/produit\//)
    const name = ((await link.textContent()) ?? '').trim()
    await page.getByTestId('carousel-slide').first().click()

    await expect(page).toHaveURL(/\/produit\/[a-z0-9-]+$/)
    await expect(page.getByTestId('product-title')).toHaveText(name)
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

  test('la grille de blog garde les trois articles les plus récents quand l’API en renvoie plus', async ({
    page,
  }) => {
    await page.route('**/api/articles', async (route) => {
      const response = await route.fetch()
      const articles = await response.json()
      const older = {
        ...articles.at(-1),
        id: 99,
        slug: 'article-plus-ancien',
        title: 'Plus ancien',
      }
      await route.fulfill({ response, json: [...articles.slice(0, 3), older] })
    })
    await page.goto('/')

    const cards = page.getByTestId('home-blog-card')
    await expect(cards).toHaveCount(3)
    await expect(cards.filter({ hasText: 'Plus ancien' })).toHaveCount(0)
  })

  test('la grille de blog met l’article à la une sur 8 colonnes et empile les deux autres en desktop', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mise en page desktop')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')

    const [featured, second, third] = await cardBoxes(page)
    expect(featured.width / second.width).toBeGreaterThan(1.8)
    expect(second.width).toBeCloseTo(third.width, 0)
    expect(second.x).toBeCloseTo(third.x, 0)
    expect(second.x).toBeGreaterThan(featured.x + featured.width)
    expect(third.y).toBeGreaterThanOrEqual(second.y + second.height)
  })

  test('la grille de blog partage la largeur en deux colonnes égales en tablette', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'largeur pilotée explicitement')
    await page.setViewportSize({ width: 768, height: 900 })
    await page.goto('/')

    const [featured, second, third] = await cardBoxes(page)
    expect(featured.width).toBeCloseTo(second.width, 0)
    expect(second.x).toBeGreaterThan(featured.x + featured.width)
    expect(second.y).toBeCloseTo(featured.y, 0)
    expect(third.x).toBeCloseTo(second.x, 0)
    expect(third.y).toBeGreaterThanOrEqual(second.y + second.height)
  })

  test('la grille de blog empile les trois articles sur toute la largeur en mobile', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mise en page mobile')
    await page.goto('/')

    const [featured, second, third] = await cardBoxes(page)
    expect(second.width).toBeCloseTo(featured.width, 0)
    expect(third.width).toBeCloseTo(featured.width, 0)
    expect(second.x).toBeCloseTo(featured.x, 0)
    expect(second.y).toBeGreaterThanOrEqual(featured.y + featured.height)
    expect(third.y).toBeGreaterThanOrEqual(second.y + second.height)
  })

  test('les diapositives débordent du conteneur sans faire défiler la page', async ({ page }) => {
    await page.goto('/')
    const section = page.getByTestId('home-carousel')
    await expect(page.getByTestId('carousel-slide')).toHaveCount(5)
    await section.scrollIntoViewIfNeeded()

    const sectionBox = await section.boundingBox()
    const slideRights = await page
      .getByTestId('carousel-slide')
      .evaluateAll((slides) => slides.map((slide) => slide.getBoundingClientRect().right))
    expect(Math.max(...slideRights)).toBeGreaterThan(sectionBox.x + sectionBox.width)

    // Une diapositive est visible au bord droit de la fenêtre, au-delà de la piste
    const track = await page.getByTestId('carousel-track').boundingBox()
    const hit = await page.evaluate(
      (y) =>
        document
          .elementFromPoint(window.innerWidth - 2, y)
          ?.closest('[data-testid="carousel-slide"]') != null,
      track.y + track.height / 2,
    )
    expect(hit).toBe(true)

    const [scrollWidth, innerWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ])
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
  })

  test('l’image de l’article à la une annonce sa largeur propre, les autres celle du gabarit', async ({
    page,
  }) => {
    await page.goto('/')

    const cards = page.getByTestId('home-blog-card')
    await expect(cards).toHaveCount(3)
    for (const source of await cards.first().locator('source').all()) {
      await expect(source).toHaveAttribute('sizes', '(width >= 1024px) 66vw, 100vw')
    }
    for (const source of await cards.nth(1).locator('source').all()) {
      await expect(source).toHaveAttribute(
        'sizes',
        '(width >= 1024px) 460px, (width >= 640px) 50vw, 100vw',
      )
    }
  })

  test('la grille de blog affiche les illustrations servies par l’API', async ({ page }) => {
    await page.goto('/')

    const image = page.getByTestId('home-blog-card').first().locator('img')
    await image.scrollIntoViewIfNeeded()
    const apiOrigin = new URL(process.env.API_URL || 'http://localhost:8090').origin
    await expect(image).toHaveAttribute('src', new RegExp(`^${apiOrigin}/media/`))
    await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0)
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
