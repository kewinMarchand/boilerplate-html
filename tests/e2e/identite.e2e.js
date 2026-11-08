import { expect, test } from '@playwright/test'

import { BRANDED_IDENTITY, enableDarkMode, enableEnhancedMode, withIdentity } from './routes.js'

const API_URL = process.env.API_URL || 'http://localhost:8090'

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const primaryColor = (page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bui-color-primary').trim(),
  )

test.describe('identité lue dans l’API, sans logo ni couleurs', () => {
  let identity

  test.beforeEach(async ({ page, request }) => {
    identity = await (await request.get(`${API_URL}/api/site-identity`)).json()
    test.skip(identity.logo !== null || identity.theme !== null, 'identité locale personnalisée')
    await withIdentity(page, identity)
  })

  test('le header et le titre portent le nom de l’API, avec le pictogramme', async ({ page }) => {
    await page.goto('/contact')
    const logo = page.getByTestId('layout-logo')

    await expect(page).toHaveTitle(new RegExp(` · ${escapeRegExp(identity.name)}$`))
    await expect(logo).toHaveAccessibleName(identity.name)
    await expect(logo).toHaveText(identity.name)
    await expect(logo.locator('img[src="/logo-mark.svg"]')).toHaveCount(1)
    await expect(page.locator('.site-footer-brand')).toHaveText(identity.name)
  })

  test('le hero porte le nom et l’accroche', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(identity.name)
    await expect(page.locator('.hero-lead')).toHaveText(identity.tagline)
  })

  test('aucun bloc de style : les jetons restent ceux de la bibliothèque', async ({ page }) => {
    const reference = await page.context().newPage()
    await reference.goto('/')
    await page.goto('/')

    await expect(page.locator('head style')).toHaveCount(0)
    expect(await primaryColor(page)).toBe(await primaryColor(reference))
  })
})

test.describe('identité avec logo et couleurs', () => {
  const { light, dark } = BRANDED_IDENTITY.theme

  test.beforeEach(async ({ page }) => {
    await withIdentity(page, BRANDED_IDENTITY)
  })

  test('le logo remplace le pictogramme et le nom dans le header', async ({ page }) => {
    await page.goto('/')
    const logo = page.getByTestId('layout-logo')
    const image = logo.getByRole('img', { name: 'Oraki' })

    await expect(logo).toHaveAccessibleName('Oraki')
    await expect(image).toHaveAttribute('fetchpriority', 'high')
    await expect(image).toHaveJSProperty('complete', true)
    expect((await image.boundingBox()).height).toBe(40)
    await expect(logo.locator('img[src="/logo-mark.svg"]')).toHaveCount(0)
    await expect(logo).toHaveText('')
    await expect(page).toHaveTitle(/Oraki/)
  })

  test('--bui-color-primary vaut la couleur claire de l’API', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('head style')).toHaveCount(1)
    expect(await primaryColor(page)).toBe(light.primary)
  })

  test('--bui-color-primary vaut la couleur sombre de l’API en sombre forcé', async ({ page }) => {
    await enableDarkMode(page)
    await page.goto('/')

    expect(await primaryColor(page)).toBe(dark.primary)
  })

  test('--bui-color-primary suit le sombre du système en thème automatique', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'auto')
    expect(await primaryColor(page)).toBe(dark.primary)
  })

  test('le mode renforcé garde la couleur de la bibliothèque', async ({ page }) => {
    const reference = await page.context().newPage()
    await enableEnhancedMode(page)
    await enableEnhancedMode(reference)
    await reference.goto('/')
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('data-a11y-mode', 'enhanced')
    expect(await primaryColor(page)).toBe(await primaryColor(reference))
    expect(await primaryColor(page)).not.toBe(light.primary)
  })

  test('le bloc de couleurs passe la CSP sans erreur console', async ({ page }) => {
    const errors = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto('/contact')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(errors).toEqual([])
  })
})

test('le thème par défaut de l’API est servi, le choix mémorisé l’emporte', async ({ page }) => {
  await withIdentity(page, { ...BRANDED_IDENTITY, defaultColorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark')

  await page.evaluate(() => localStorage.setItem('color-scheme', 'light'))
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light')
})
