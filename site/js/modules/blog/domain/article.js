const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })

export const articleHref = (slug) => `/blog/${slug}`

/** Slug de la fiche ouverte, lu dans l'adresse : /blog/<slug>. */
export const slugFromPath = (pathname) => /^\/blog\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null

export const formatPublishedAt = (isoDate) => DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`))

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

/** Légende du lecteur audio : durée, puis intervenant s'il est saisi. */
export const audioCaption = (audio, speaker) =>
  [`Écouter l'article (${formatDuration(audio.durationSeconds)})`, speaker]
    .filter(Boolean)
    .join(' · ')
