import { defineConfig, devices } from '@playwright/test'

const PORT = 4080
const BASE_URL = `http://localhost:${PORT}`

// Second serveur avec des valeurs factices pour tests/e2e/observability.e2e.js : aucun traceur réel.
export const OBSERVABILITY_PORT = 4086
const OBSERVABILITY_ENV = {
  GLITCHTIP_DSN: 'http://cle@localhost:4087/1',
  GLITCHTIP_ENVIRONMENT: 'test',
  MATOMO_URL: 'http://matomo.test/',
  MATOMO_SITE_ID: '1',
}

// Site bilingue des tests (section 29 bis de la spec commune) : généré depuis le scénario bilingue de l'API
// (X-Scenario: bilingual à chaque appel, génération comprise) par le script de l'image, puis servi pour
// tests/e2e/bilingue.e2e.js et tests/a11y/bilingue.a11y.js. Le navigateur appelle l'API : le port doit
// figurer dans les origines autorisées (CORS) de l'API Platform et de Hono : ports du bloc du dépôt, section 7 de la spec commune.
export const BILINGUAL_PORT = 4082
export const BILINGUAL_ROOT = '.cache/bilingue'
export const API_URL = process.env.API_URL || 'http://localhost:8090'
// Génération du site bilingue (API_SCENARIO=bilingual). `make e2e-vite` la lance lui-même, seulement si ses
// sources ont changé depuis la précédente (scripts/e2e-vite.sh), et la passe ici (E2E_SANS_GENERATION=1).
export const BILINGUAL_GENERATION = `rm -rf ${BILINGUAL_ROOT} && mkdir -p ${BILINGUAL_ROOT} && cp -R site ${BILINGUAL_ROOT}/site && sh scripts/generate.sh ${BILINGUAL_ROOT}/site ${API_URL} ${BILINGUAL_ROOT}/identity-style.conf > ${BILINGUAL_ROOT}/generation.log 2>&1`
const GENERATION = process.env.E2E_SANS_GENERATION === '1' ? '' : `${BILINGUAL_GENERATION} && `

export default defineConfig({
  testMatch: /.*\.(e2e|a11y)\.js/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `node scripts/serve.js ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node scripts/serve.js ${OBSERVABILITY_PORT}`,
      url: `http://localhost:${OBSERVABILITY_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: OBSERVABILITY_ENV,
    },
    {
      command: `${GENERATION}node scripts/serve.js ${BILINGUAL_PORT}`,
      url: `http://localhost:${BILINGUAL_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: { API_SCENARIO: 'bilingual', SITE_ROOT: `${BILINGUAL_ROOT}/site` },
    },
  ],
})
