import { readFileSync } from 'node:fs'

const SITE = JSON.parse(readFileSync(new URL('../../site.config.json', import.meta.url), 'utf8'))

export const CATEGORY_ROUTES = [
  '/catalogue/plantes-interieur',
  '/catalogue/plantes-interieur/feuillages',
]

export const ROUTES = [
  ...SITE.navigation.map((item) => item.href),
  ...CATEGORY_ROUTES,
  ...SITE.legalNavigation.map((item) => item.href),
  '/blog/le-mode-accessibilite-renforcee',
  '/produit/monstera-deliciosa',
]

export const enableEnhancedMode = (page) =>
  page.addInitScript(() => localStorage.setItem('a11y-mode', 'enhanced'))

export const enableDarkMode = (page) =>
  page.addInitScript(() => localStorage.setItem('color-scheme', 'dark'))

// Les données viennent de l'API, appelée par le navigateur : l'état d'erreur ou de liste vide
// est provoqué par l'en-tête X-Scenario, ajouté par Playwright à chaque requête vers l'API.
export const withScenario = (page, scenario) =>
  page.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-scenario': scenario } }),
  )
