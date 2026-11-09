export const articleHref = (slug) => `/blog/${slug}`

/** Slug de la fiche ouverte, lu dans l'adresse : /blog/<slug>, ou /<langue>/blog/<slug>. */
export const slugFromPath = (pathname) =>
  /^(?:\/[a-z]{2})?\/blog\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null

/** Date de publication dans la langue de la page (« 1 janvier 2026 », « January 1, 2026 »). */
export const formatPublishedAt = (isoDate, locale) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  )

/** Filtre de /blog : slug de la rubrique lu dans `?rubrique=<slug>`, `null` sans filtre ou s'il est mal formé. */
export const sectionFromSearch = (search) => {
  const slug = new URLSearchParams(search).get('rubrique')
  return slug && /^[a-z0-9][a-z0-9-]{0,59}$/.test(slug) ? slug : null
}

export const blogHref = (section) => (section ? `/blog?rubrique=${section}` : '/blog')

/** Durée lisible d'un audio : « 4 s », « 26 min », « 1 h 5 min ». */
export const formatDuration = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`
}

/** Légende du lecteur audio : `label` (« Écouter l'article ({duration}) ») avec la durée, puis intervenant s'il est saisi. */
export const audioCaption = (audio, speaker, label) =>
  [label.replace('{duration}', formatDuration(audio.durationSeconds)), speaker]
    .filter(Boolean)
    .join(' · ')
