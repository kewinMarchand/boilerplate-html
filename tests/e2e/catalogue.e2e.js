import { expect, test } from '@playwright/test'

import { withScenario } from './routes.js'

const openFilters = async (page, isMobile) => {
  if (isMobile) await page.getByTestId('catalog-filters-open').click()
}

const closeFilters = async (page, isMobile) => {
  if (isMobile) await page.getByTestId('catalog-filters-done').click()
}

test.describe('Catalogue', () => {
  test('filtre par exposition, met à jour l’URL, le compteur et les puces', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/catalogue')
    await expect(page.getByTestId('catalog-active-filters')).toBeHidden()

    await openFilters(page, isMobile)
    await page.getByTestId('catalog-filter-exposure-mi-ombre').check()
    await expect(page).toHaveURL(/\?exposition=mi-ombre$/)
    await closeFilters(page, isMobile)

    await expect(page.getByTestId('catalog-results-count')).toHaveText('7 produits')
    await expect(page.getByTestId('catalog-product')).toHaveCount(7)
    await expect(page.getByTestId('catalog-active-filters')).toBeVisible()
    await expect(page.getByTestId('catalog-active-filter')).toHaveAccessibleName(
      'Retirer le filtre : Mi-ombre',
    )
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')

    await page.getByTestId('catalog-active-filter').click()
    await expect(page).toHaveURL(/\/catalogue$/)
    await expect(page.getByTestId('catalog-active-filters')).toBeHidden()
    await expect(page.getByTestId('catalog-results-count')).toHaveText('24 produits')
  })

  test('filtre par attribut, met à jour l’URL, remet la page à 1 et ajoute la puce', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/catalogue?page=2')
    await openFilters(page, isMobile)
    const caduc = page.getByTestId('catalog-filter-attribute-feuillage-caduc')
    await expect(caduc).toHaveAccessibleName('Caduc (2)')

    await caduc.check()
    await expect(page).toHaveURL(/\/catalogue\?attr-feuillage=caduc$/)
    await expect(caduc).toBeFocused()
    await closeFilters(page, isMobile)

    await expect(page.getByTestId('catalog-results-count')).toHaveText('2 produits')
    await expect(page.getByTestId('catalog-product')).toHaveCount(2)
    await expect(page.getByTestId('catalog-active-filter')).toHaveAccessibleName(
      'Retirer le filtre : Caduc',
    )

    await page.getByTestId('catalog-active-filter').click()
    await expect(page).toHaveURL(/\/catalogue$/)
    await expect(page.getByTestId('catalog-results-count')).toHaveText('24 produits')
  })

  test('n’affiche aucune facette d’attribut dans une branche sans attribut', async ({ page }) => {
    await page.goto('/catalogue/plantes-exterieur/arbustes-a-fleurs')
    await expect(page.getByTestId('catalog-product')).toHaveCount(6)
    await expect(page.locator('[data-testid^="catalog-filter-attribute-"]')).toHaveCount(0)
  })

  test('Tout effacer garde la catégorie et la vue', async ({ page }) => {
    await page.goto('/catalogue/plantes-interieur?taille=S&en_stock=1&tri=nom&vue=liste')
    await expect(page.getByTestId('catalog-active-filter')).toHaveCount(2)

    await page.getByTestId('catalog-clear-filters').click()

    await expect(page).toHaveURL(/\/catalogue\/plantes-interieur\?vue=liste$/)
    await expect(page.getByTestId('catalog-active-filters')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  })

  test('trie par prix croissant', async ({ page }) => {
    await page.goto('/catalogue')
    await page.getByTestId('catalog-sort').selectOption('prix-asc')

    await expect(page).toHaveURL(/tri=prix-asc/)
    const prices = page.getByTestId('catalog-product-price')
    await expect(prices.nth(0)).toHaveText(/12,90/)
    await expect(prices.nth(1)).toHaveText(/14,90/)
  })

  test('pagine en conservant les autres paramètres', async ({ page }) => {
    await page.goto('/catalogue?vue=liste')
    const pagination = page.getByTestId('catalog-pagination')
    await expect(pagination).toBeVisible()

    await pagination.getByRole('link', { name: 'Page 2' }).click()
    await expect(page).toHaveURL(/\?vue=liste&page=2$/)
    await expect(page.getByTestId('catalog-product')).toHaveCount(12)
    await expect(pagination.locator('[aria-current="page"]')).toHaveText('Page 2')
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()

    await pagination.getByRole('link', { name: 'Précédent' }).click()
    await expect(page).toHaveURL(/\?vue=liste$/)
  })

  test('masque la pagination quand tout tient sur une page', async ({ page }) => {
    await page.goto('/catalogue/plantes-interieur/feuillages')
    await expect(page.getByTestId('catalog-product')).toHaveCount(6)
    await expect(page.getByTestId('catalog-pagination')).toBeHidden()
  })

  test('bascule en vue liste et la conserve au rechargement', async ({ page }) => {
    await page.goto('/catalogue')
    await page.getByTestId('catalog-view-list').click()

    await expect(page).toHaveURL(/\?vue=liste$/)
    await expect(page.getByTestId('catalog-view-list')).toHaveAttribute('aria-current', 'page')
    await page.reload()
    await expect(page.locator('[data-catalog-list]')).toHaveAttribute('data-view', 'liste')
    await expect(page.getByTestId('catalog-view-grid')).not.toHaveAttribute('aria-current')
  })

  test('affiche l’état vide avec Tout effacer', async ({ page }) => {
    await page.goto('/catalogue?prix_min=1000')

    await expect(page.getByTestId('catalog-empty')).toContainText(
      'Aucun produit ne correspond à ces filtres.',
    )
    await expect(page.getByTestId('catalog-product')).toHaveCount(0)
    await page.getByTestId('catalog-empty-clear').click()
    await expect(page.getByTestId('catalog-product')).toHaveCount(12)
    await expect(page.getByTestId('catalog-empty')).toHaveCount(0)
  })

  test('affiche l’erreur et propose de réessayer', async ({ page }) => {
    await withScenario(page, 'error')
    await page.goto('/catalogue')

    await expect(page.getByTestId('catalog-error')).toContainText(
      'Impossible de charger les produits pour le moment.',
    )
    await page.getByTestId('catalog-retry').click()
    await expect(page.getByTestId('catalog-error')).toBeVisible()
  })
})

test.describe('Catalogue mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'panneau de filtres réservé au mobile')

  test('ouvre le panneau de filtres, le ferme avec Échap et rend le focus', async ({ page }) => {
    await page.goto('/catalogue')
    const open = page.getByTestId('catalog-filters-open')

    await open.click()
    await expect(page.getByRole('dialog', { name: 'Filtres' })).toBeVisible()
    await expect(open).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('catalog-filter-size-M')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Filtres' })).toBeHidden()
    await expect(open).toBeFocused()
  })
})

test.describe('Catalogue sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('le formulaire GET porte les filtres dans l’URL et la page explique la limite', async ({
    page,
  }) => {
    await page.goto('/catalogue')
    await page.getByTestId('catalog-filter-exposure-soleil').check()
    await page.getByTestId('catalog-filters-apply').click()

    await expect(page).toHaveURL(/exposition=soleil/)
    await expect(page.getByTestId('catalog-noscript')).toBeVisible()
    await expect(page.getByTestId('catalog-product')).toHaveCount(0)
  })
})
