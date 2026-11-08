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
  }
}
