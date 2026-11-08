import { expect, test } from '@playwright/test'

test.describe('Navigation', () => {
  test('le lien actif porte aria-current', async ({ page, isMobile }) => {
    test.skip(isMobile, 'la navigation principale passe dans le menu mobile')
    await page.goto('/contact')

    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(nav.getByRole('link', { name: 'Contact' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: 'Accueil' })).not.toHaveAttribute('aria-current')
  })

  test('le lien Blog suit Catalogue et mène à la liste des articles', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'la navigation principale passe dans le menu mobile')
    await page.goto('/')

    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    const labels = await nav.locator('.main-nav-list > li > a').allTextContents()
    expect(labels.indexOf('Blog')).toBe(labels.indexOf('Catalogue') + 1)
    await nav.getByRole('link', { name: 'Blog', exact: true }).click()

    await expect(page).toHaveURL(/\/blog$/)
    await expect(nav.getByRole('link', { name: 'Blog', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('le lien d’évitement mène au contenu principal', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')

    const skipLink = page.getByRole('link', { name: 'Aller au contenu principal' })
    await expect(skipLink).toBeFocused()
    await skipLink.press('Enter')
    await expect(page).toHaveURL(/#main$/)
  })
})
