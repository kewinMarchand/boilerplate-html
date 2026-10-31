import { expect, test } from '@playwright/test'

const html = (page) => page.locator('html')

const choose = async (page, choice) => {
  await page.getByTestId('color-scheme-toggle').click()
  await page.getByTestId(`color-scheme-option-${choice}`).click()
  await expect(html(page)).toHaveAttribute('data-color-scheme', choice)
}

const backgroundOf = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test.describe('Thème', () => {
  test('suit le système par défaut, sans choix mémorisé', async ({ page }) => {
    await page.goto('/')

    await expect(html(page)).toHaveAttribute('data-color-scheme', 'auto')
    await expect(page.getByTestId('color-scheme-toggle')).toHaveAccessibleName('Thème : système')
    expect(await page.evaluate(() => localStorage.getItem('color-scheme'))).toBeNull()
  })

  test('chaque choix pose l’attribut, est mémorisé et persiste au rechargement', async ({
    page,
  }) => {
    await page.goto('/')

    for (const choice of ['dark', 'light']) {
      await choose(page, choice)
      expect(await page.evaluate(() => localStorage.getItem('color-scheme'))).toBe(choice)

      await page.reload()
      await expect(html(page)).toHaveAttribute('data-color-scheme', choice)
      await expect(page.getByTestId(`color-scheme-option-${choice}`)).toHaveAttribute(
        'aria-checked',
        'true',
      )
    }
  })

  test('le choix suit la navigation vers une autre page', async ({ page }) => {
    await page.goto('/')
    await choose(page, 'dark')

    await page.goto('/contact')
    await expect(html(page)).toHaveAttribute('data-color-scheme', 'dark')
    await expect(page.getByTestId('color-scheme-toggle')).toHaveAccessibleName('Thème : sombre')
  })

  test('« système » retire le choix mémorisé et remet auto', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('init')) {
        sessionStorage.setItem('init', '1')
        localStorage.setItem('color-scheme', 'dark')
      }
    })
    await page.goto('/')
    await expect(html(page)).toHaveAttribute('data-color-scheme', 'dark')

    await choose(page, 'auto')
    expect(await page.evaluate(() => localStorage.getItem('color-scheme'))).toBeNull()

    await page.reload()
    await expect(html(page)).toHaveAttribute('data-color-scheme', 'auto')
  })

  test('auto donne le sombre quand le système est sombre', async ({ page }) => {
    await page.goto('/')
    const light = await backgroundOf(page)

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => backgroundOf(page)).not.toBe(light)
  })

  test('sans flash : le choix mémorisé est posé avant le premier DOMContentLoaded', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('color-scheme', 'dark')
      document.addEventListener('DOMContentLoaded', () => {
        sessionStorage.setItem(
          'au-chargement',
          document.documentElement.getAttribute('data-color-scheme') ?? '',
        )
      })
    })
    await page.goto('/')

    expect(await page.evaluate(() => sessionStorage.getItem('au-chargement'))).toBe('dark')
  })

  test('le mode renforcé garde la page en clair et suspend le choix sombre', async ({ page }) => {
    await page.goto('/')
    const light = await backgroundOf(page)

    await page.addInitScript(() => {
      localStorage.setItem('color-scheme', 'dark')
      localStorage.setItem('a11y-mode', 'enhanced')
    })
    await page.reload()

    await expect(html(page)).toHaveAttribute('data-color-scheme', 'dark')
    await expect(html(page)).toHaveAttribute('data-a11y-mode', 'enhanced')
    await expect(page.getByTestId('color-scheme-toggle')).toHaveAccessibleName(
      "Thème : sombre, suspendu par l'accessibilité renforcée",
    )
    expect(await backgroundOf(page)).toBe(light)
  })

  test('activer le mode renforcé met à jour le nom de la bascule sans rechargement', async ({
    page,
  }) => {
    await page.goto('/')
    await choose(page, 'dark')

    await page.getByTestId('a11y-mode-toggle').click()
    await expect(page.getByTestId('color-scheme-toggle')).toHaveAccessibleName(
      "Thème : sombre, suspendu par l'accessibilité renforcée",
    )
  })
})

test.describe('Thème sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la bascule est absente, la page suit le système', async ({ page }) => {
    await page.goto('/')

    await expect(html(page)).toHaveAttribute('data-color-scheme', 'auto')
    await expect(page.getByTestId('color-scheme-toggle')).toBeHidden()
  })
})
