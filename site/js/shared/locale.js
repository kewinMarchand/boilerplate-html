/**
 * Langues du site (section 29 bis de la spec commune). La génération écrit les langues activées sur
 * `<html data-locales="fr en">`, la première par défaut, servie sans préfixe ; sans cet attribut, le site
 * n'a qu'une langue. `prefixPath` est le seul point qui préfixe un lien interne : le navigateur
 * (`localizePath`) et la génération de l'image s'en servent.
 */
export const prefixPath = (path, locale, locales) =>
  locales.indexOf(locale) > 0 ? `/${locale}${path === '/' ? '' : path}` : path

const root = () => document.documentElement

export const pageLocale = () => root().lang

export const localizePath = (path) =>
  prefixPath(path, pageLocale(), root().dataset.locales?.split(' ') ?? [pageLocale()])

/** Étiquette avec la région la plus probable : « fr-FR », « en-US » (`inLanguage`, formats de dates et de prix). */
export const languageTag = (locale) => {
  const { language, region } = new Intl.Locale(locale).maximize()
  return region ? `${language}-${region}` : language
}
