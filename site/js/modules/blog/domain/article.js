const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })

export const articleHref = (slug) => `/blog/${slug}`

/** Slug de la fiche ouverte, lu dans l'adresse : /blog/<slug>. */
export const slugFromPath = (pathname) => /^\/blog\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null

export const formatPublishedAt = (isoDate) => DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`))
