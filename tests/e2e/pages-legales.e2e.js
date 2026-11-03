import { expect, test } from '@playwright/test'

import { withScenario } from './routes.js'

test.describe('Pages légales', () => {
  test('les mentions légales affichent le texte de l’API, section par section', async ({
    page,
  }) => {
    await page.goto('/mentions-legales')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mentions légales')
    await expect(page.getByTestId('legal-section')).toHaveCount(4)
    await expect(page.getByTestId('legal-section').first()).toContainText('Exemple SAS')
    await expect(page.getByTestId('legal-error')).toHaveCount(0)
    await expect(page.getByTestId('legal-loading')).toHaveCount(0)
  })

  test('la déclaration est non conforme tant qu’aucun audit n’est renseigné', async ({ page }) => {
    await page.goto('/accessibilite')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Déclaration d'accessibilité")
    const compliance = page.getByTestId('legal-section').first()
    await expect(compliance).toContainText('non conforme')
    await expect(compliance).toContainText("Aucun audit n'a encore été réalisé.")
  })

  test('la page garde son titre et propose de réessayer quand l’API échoue', async ({ page }) => {
    await withScenario(page, 'error')
    await page.goto('/donnees-personnelles')

    await expect(page.getByTestId('legal-error')).toContainText(
      'Impossible de charger cette page pour le moment. Réessayez dans quelques minutes.',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Données personnelles')
    await expect(page.getByTestId('legal-section')).toHaveCount(0)
    await page.getByTestId('legal-retry').click()
    await expect(page.getByTestId('legal-error')).toBeVisible()
  })
})

test.describe('Pages légales sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la page annonce que son texte demande JavaScript', async ({ page }) => {
    await page.goto('/mentions-legales')

    await expect(page.getByTestId('legal-noscript')).toBeVisible()
    await expect(page.getByTestId('legal-section')).toHaveCount(0)
  })
})
