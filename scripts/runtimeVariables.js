const DSN = /^(https?):\/\/[^@/]+@([^/]+)\//
const URL_ORIGIN = /^(https?:\/\/[^/]+)/

/**
 * Configuration lue dans l'environnement (API et son scénario, GlitchTip, Matomo), telle que nginx la donne aux inclusions
 * côté serveur (`set` dans `docker/default.conf.template`) et à la CSP (`map`). Le serveur de
 * développement et les tests la calculent ici de la même façon. Sans valeur, tout reste vide.
 */
export const glitchtipOrigin = (dsn) => {
  const match = dsn.match(DSN)
  return match ? `${match[1]}://${match[2]}` : ''
}

export const matomoOrigin = (url, siteId) => (siteId ? (url.match(URL_ORIGIN)?.[1] ?? '') : '')

export const observabilityVariables = (env) => {
  const dsn = env.GLITCHTIP_DSN ?? ''
  const matomoUrl = env.MATOMO_URL ?? ''
  const matomoSiteId = env.MATOMO_SITE_ID ?? ''
  return {
    glitchtip_dsn: dsn,
    glitchtip_environment: env.GLITCHTIP_ENVIRONMENT || 'development',
    glitchtip_origin: glitchtipOrigin(dsn),
    matomo_url: matomoUrl,
    matomo_site_id: matomoSiteId,
    matomo_origin: matomoOrigin(matomoUrl, matomoSiteId),
  }
}

export const DEFAULT_API_URL = 'http://localhost:8090'

export const apiOrigin = (url) => url.match(URL_ORIGIN)?.[1] ?? ''

export const runtimeVariables = (env) => {
  const apiUrl = env.API_URL || DEFAULT_API_URL
  return {
    ...observabilityVariables(env),
    api_url: apiUrl,
    api_origin: apiOrigin(apiUrl),
    // Scénario de l'API passé par le navigateur en X-Scenario (`bilingual` : site bilingue des tests)
    api_scenario: env.API_SCENARIO ?? '',
  }
}

export const resolveVariables = (value, variables) =>
  value.replace(/\$(\w+)/g, (_, name) => variables[name] ?? '')
