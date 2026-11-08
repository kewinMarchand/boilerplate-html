import { expect, test } from '@playwright/test'

const PRODUCT = '/produit/monstera-deliciosa'

test.describe('Panier', () => {
  test('ajoute un produit depuis sa fiche, annonce l’ajout et compte les articles', async ({
    page,
  }) => {
    await page.goto(PRODUCT)
    await expect(page.getByTestId('cart-count')).toHaveCount(0)
    await expect(page.getByTestId('cart-link')).toHaveAccessibleName('Panier')

    await page.getByTestId('add-to-cart').click()
    await expect(page.getByTestId('add-to-cart-status')).toContainText(
      'Monstera deliciosa ajouté au panier.',
    )
    await expect(
      page.getByTestId('add-to-cart-status').getByRole('link', { name: 'Voir le panier' }),
    ).toHaveAttribute('href', '/panier')
    await expect(page.getByTestId('cart-count')).toHaveText('1')
    await expect(page.getByTestId('cart-link')).toHaveAccessibleName(/^Panier ?, 1 article$/)

    await page.getByTestId('add-to-cart').click()
    await expect(page.getByTestId('cart-count')).toHaveText('2')
    await expect(page.getByTestId('cart-link')).toHaveAccessibleName(/^Panier ?, 2 articles$/)
  })

  test('liste les lignes, recalcule le total et retire un produit', async ({ page }) => {
    await page.goto(PRODUCT)
    await page.getByTestId('add-to-cart').click()
    await expect(page.getByTestId('cart-count')).toHaveText('1')
    await page.getByTestId('cart-link').click()

    await expect(page).toHaveURL('/panier')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Panier')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await expect(page.getByTestId('cart-line')).toContainText('Monstera deliciosa')
    await expect(page.getByTestId('cart-total')).toHaveText(/34,90\s€/)

    await page.getByLabel('Quantité de Monstera deliciosa').fill('3')
    await expect(page.getByTestId('cart-total')).toHaveText(/104,70\s€/)
    await expect(page.getByTestId('cart-count')).toHaveText('3')

    await page.getByRole('button', { name: 'Retirer Monstera deliciosa' }).click()
    await expect(page.getByTestId('cart-empty')).toContainText('Votre panier est vide.')
    await expect(page.getByTestId('cart-count')).toHaveCount(0)
  })

  test('garde le panier après un rechargement', async ({ page }) => {
    await page.goto(PRODUCT)
    await page.getByTestId('add-to-cart').click()
    await expect(page.getByTestId('cart-count')).toHaveText('1')

    await page.reload()
    await expect(page.getByTestId('cart-count')).toHaveText('1')
  })

  test('désactive l’ajout d’un produit en rupture de stock', async ({ page }) => {
    await page.goto('/produit/monstera-thai-constellation')

    await expect(page.getByTestId('add-to-cart')).toBeDisabled()
  })

  test('affiche un panier vide avec un lien vers le catalogue', async ({ page }) => {
    await page.goto('/panier')

    await expect(page.getByTestId('cart-empty')).toBeVisible()
    await expect(page.getByTestId('cart-empty').getByRole('link')).toHaveAttribute(
      'href',
      '/catalogue',
    )
  })
})

test.describe('Panier sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la fiche n’affiche pas de bouton d’ajout et la page panier prévient', async ({ page }) => {
    await page.goto(PRODUCT)
    await expect(page.getByTestId('product-title')).toHaveText('Monstera deliciosa')
    await expect(page.getByTestId('add-to-cart')).toHaveCount(0)

    // Playwright coupe les scripts sans afficher les <noscript> : le message est lu dans le HTML servi
    const html = await (await page.request.get('/panier')).text()
    expect(html).toMatch(
      /<noscript[\s\S]*<p>Le panier demande JavaScript\.<\/p>[\s\S]*<\/noscript\s*>/,
    )
  })
})
