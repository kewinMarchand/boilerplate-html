/**
 * Client HTTP de l'API commune, sans dépendance. Seule la couche `infrastructure/http/` des
 * modules l'importe (règle `client-api-hors-infrastructure`). L'adresse de l'API vient du
 * `<link rel="preconnect" data-api-url>` injecté par le footer partagé (variable API_URL).
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

const baseUrl = () => {
  const link = document.querySelector('link[data-api-url]')
  if (!link) throw new ApiError(0, null)
  return link.href
}

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
  const response = await fetch(new URL(path, baseUrl()), {
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, body)
  return body
}

export const apiGet = (path, params = {}) => {
  const search = toSearchParams(params).toString()
  return request(search ? `${path}?${search}` : path)
}

export const apiPost = (path, data) =>
  request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
