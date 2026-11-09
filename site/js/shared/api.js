/**
 * Client HTTP de l'API commune, sans dépendance. Seule la couche `infrastructure/http/` des
 * modules l'importe (règle `client-api-hors-infrastructure`). L'adresse de l'API vient du
 * `<link rel="preconnect" data-api-url>` injecté par le footer partagé (variable API_URL), avec le
 * scénario de l'API (`data-api-scenario`, variable API_SCENARIO) quand il est fixé. Sur un site à
 * plusieurs langues (`<html data-locales>`), chaque lecture passe la langue de la page (`locale`) ; un
 * site d'une seule langue garde ses adresses (des tests e2e les interceptent telles quelles). L'envoi
 * d'un formulaire donne la langue en `Accept-Language`.
 */
export class ApiError extends Error {
  constructor(status, body) {
    super(`Réponse ${status} de l'API`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export class ApiContractError extends Error {
  constructor(field) {
    super(`Réponse de l'API inattendue : ${field}`)
    this.name = 'ApiContractError'
  }
}

const apiLink = () => {
  const link = document.querySelector('link[data-api-url]')
  if (!link) throw new ApiError(0, null)
  return link
}

const pageLocale = () => document.documentElement.lang

const localeParams = () =>
  document.documentElement.dataset.locales ? { locale: pageLocale() } : {}

const toSearchParams = (params) => {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    for (const item of [value].flat()) {
      if (item !== undefined && item !== null) search.append(name, String(item))
    }
  }
  return search
}

const request = async (path, init) => {
  const link = apiLink()
  const scenario = link.dataset.apiScenario
  const response = await fetch(new URL(path, link.href), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(scenario && { 'x-scenario': scenario }),
      ...init?.headers,
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, body)
  return body
}

export const apiGet = (path, params = {}) => {
  const search = toSearchParams({ ...params, ...localeParams() }).toString()
  return request(search ? `${path}?${search}` : path)
}

export const apiPost = (path, data) =>
  request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': pageLocale() },
    body: JSON.stringify(data),
  })

const TYPES = { string: 'string', number: 'number', boolean: 'boolean' }

/** Lit l'objet `image` du contrat (ADR 0002 de l'API Platform), ou `null` quand l'API n'en a pas. */
export const imageField = (dto, name) => {
  if (dto?.[name] === null) return null
  const image = field(dto, name, 'object')
  return {
    alt: field(image, 'alt', 'string'),
    width: field(image, 'width', 'number'),
    height: field(image, 'height', 'number'),
    sources: field(image, 'sources', 'array').map((source) => ({
      type: field(source, 'type', 'string'),
      srcset: field(source, 'srcset', 'string'),
    })),
    src: field(image, 'src', 'string'),
  }
}

/** Lit un champ d'une réponse en vérifiant son type, pour qu'un écart de contrat échoue tôt. */
export const field = (dto, name, type) => {
  const value = dto?.[name]
  const valid =
    type === 'array'
      ? Array.isArray(value)
      : type === 'object'
        ? value !== null && typeof value === 'object'
        : typeof value === TYPES[type]
  if (!valid) throw new ApiContractError(name)
  return value
}
