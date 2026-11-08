import { ApiContractError, field, imageField } from '/js/shared/api.js'

const COLOR_SCHEMES = ['auto', 'light', 'dark']
const COLOR = /^#[0-9a-f]{6}$/

const THEME_TOKENS = [
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
]

const toTokens = (dto) =>
  Object.fromEntries(
    THEME_TOKENS.map((token) => {
      const value = field(dto, token, 'string')
      if (!COLOR.test(value)) throw new ApiContractError(token)
      return [token, value]
    }),
  )

const toTheme = (dto) => {
  if (dto?.theme === null) return null
  const theme = field(dto, 'theme', 'object')
  return {
    light: toTokens(field(theme, 'light', 'object')),
    dark: toTokens(field(theme, 'dark', 'object')),
  }
}

const ICON_SIZES = ['png32', 'png180', 'png192', 'png512']

// Champs de la section 22 (icône) et 26 (image de partage) de la spec commune : absents d'une API qui ne
// les sert pas encore (Hono), ils valent `null`
const toIcon = (dto) => {
  if (dto?.icon == null) return null
  const icon = field(dto, 'icon', 'object')
  return Object.fromEntries(ICON_SIZES.map((size) => [size, field(icon, size, 'string')]))
}

const toShareImage = (dto) => (dto?.shareImage === undefined ? null : imageField(dto, 'shareImage'))

/** Identité du site (`GET /api/site-identity`), lue au pré-rendu de l'image. */
export const toSiteIdentity = (dto) => {
  const defaultColorScheme = field(dto, 'defaultColorScheme', 'string')
  if (!COLOR_SCHEMES.includes(defaultColorScheme)) {
    throw new ApiContractError('defaultColorScheme')
  }
  return {
    name: field(dto, 'name', 'string'),
    tagline: field(dto, 'tagline', 'string'),
    logo: imageField(dto, 'logo'),
    defaultColorScheme,
    theme: toTheme(dto),
    shareImage: toShareImage(dto),
    icon: toIcon(dto),
    salesEnabled: field(dto, 'salesEnabled', 'boolean'),
  }
}

/** Titres et descriptions des pages fixes (`GET /api/page-metas`), par clé ; chaîne vide : valeur du front. */
export const toPageMetas = (dto) => {
  if (!Array.isArray(dto)) throw new ApiContractError('page-metas')
  return Object.fromEntries(
    dto.map((meta) => [
      field(meta, 'page', 'string'),
      { title: field(meta, 'title', 'string'), description: field(meta, 'description', 'string') },
    ]),
  )
}
