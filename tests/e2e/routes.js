import { readFileSync } from 'node:fs'

import {
  identityStyle,
  PAGE_META_KEYS,
  prerenderIdentity,
  SALES_PAGES,
  styleHash,
} from '../../scripts/prerender-identity.js'

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

const pageFile = (url) =>
  `${new URL(url).pathname.replace(/^\/|\/$/g, '')}/index.html`.replace(/^\//, '')

// Le serveur de développement ne pré-rend pas l'identité : chaque document est réécrit ici comme dans
// l'image, avec les métadonnées des pages fixes (`pageMetas`, par clé), et l'empreinte du bloc de
// couleurs ajoutée à la CSP comme le fait nginx. Sans vente en ligne, les pages de `SALES_PAGES`,
// retirées de l'image, répondent la 404 du serveur. Un document servi par `route.fulfill` n'a pas
// d'adresse : Chromium le tient pour public et lui refuse l'API locale (Local Network Access) sans
// la permission accordée ici.
export const withIdentity = async (page, identity, pageMetas = {}) => {
  await page.context().grantPermissions(['local-network-access'])
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback()
    const removed = !identity.salesEnabled && SALES_PAGES.includes(pageFile(route.request().url()))
    const response = await route.fetch(
      removed ? { url: new URL('/page-retiree-sans-vente', route.request().url()).href } : {},
    )
    const { 'content-encoding': _, 'content-length': __, ...headers } = response.headers()
    if (identity.theme) {
      headers['content-security-policy'] = headers['content-security-policy'].replace(
        "style-src 'self'",
        `style-src 'self' ${styleHash(identityStyle(identity.theme))}`,
      )
    }
    const pageMeta = pageMetas[PAGE_META_KEYS[pageFile(route.request().url())]] ?? null
    const body = prerenderIdentity(await response.text(), identity, SITE.name, pageMeta)
    return route.fulfill({ status: response.status(), headers, body })
  })
}

const tokens = (colors) =>
  Object.fromEntries(
    [
      'primary',
      'primary-dark',
      'on-primary',
      'primary-surface-subtle',
      'primary-surface',
      'primary-surface-strong',
      'secondary',
      'secondary-dark',
      'on-secondary',
      'secondary-surface-subtle',
      'secondary-surface',
      'secondary-surface-strong',
    ].map((token, index) => [token, colors[index]]),
  )

// Identité saisie dans l'admin, calculée par l'API depuis #c2410c et #0f766e (section 22 de la spec
// commune). Le logo pointe sur une image du site : l'API locale n'en a pas.
export const BRANDED_IDENTITY = {
  name: 'Oraki',
  tagline: 'Plantes rares et tropicales, livrées chez vous.',
  logo: {
    alt: 'Oraki',
    width: 640,
    height: 360,
    sources: [{ type: 'image/webp', srcset: '/images/hero-640.webp 640w' }],
    src: '/images/hero-640.webp',
  },
  defaultColorScheme: 'auto',
  salesEnabled: true,
  theme: {
    light: tokens([
      '#c2410c',
      '#923109',
      '#ffffff',
      '#faf0ec',
      '#f4ddd3',
      '#ebc2b1',
      '#0f766e',
      '#0b5852',
      '#ffffff',
      '#ecf4f3',
      '#d4e6e5',
      '#b2d3d1',
    ]),
    dark: tokens([
      '#fdba74',
      '#fed7aa',
      '#0f141d',
      '#222124',
      '#2c2827',
      '#3c342e',
      '#5eead4',
      '#99f6e4',
      '#0f141d',
      '#15252c',
      '#182e33',
      '#1e3d40',
    ]),
  },
}
