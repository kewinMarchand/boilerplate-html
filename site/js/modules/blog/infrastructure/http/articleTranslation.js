import { ApiContractError, field, imageField } from '/js/shared/api.js'

// Champs des sections 25 et 26 de la spec commune : une API qui ne les sert pas (Hono) en vaut une où ils sont vides
const optionalString = (dto, name) => (dto?.[name] === undefined ? '' : field(dto, name, 'string'))

const optionalObject = (dto, name, read) =>
  dto?.[name] == null ? null : read(field(dto, name, 'object'))

const toTaxon = (dto) => ({
  slug: field(dto, 'slug', 'string'),
  name: field(dto, 'name', 'string'),
})

const toAudio = (dto) => ({
  src: field(dto, 'src', 'string'),
  type: field(dto, 'type', 'string'),
  durationSeconds: field(dto, 'durationSeconds', 'number'),
})

export const toArticle = (dto) => ({
  id: String(field(dto, 'id', 'number')),
  slug: field(dto, 'slug', 'string'),
  title: field(dto, 'title', 'string'),
  excerpt: field(dto, 'excerpt', 'string'),
  publishedAt: field(dto, 'publishedAt', 'string'),
  image: imageField(dto, 'image'),
  section: optionalObject(dto, 'section', toTaxon),
  format: optionalObject(dto, 'format', toTaxon),
  audio: optionalObject(dto, 'audio', toAudio),
  speaker: optionalString(dto, 'speaker'),
})

export const toArticleDetail = (dto) => ({
  ...toArticle(dto),
  html: field(dto, 'html', 'string'),
  metaTitle: optionalString(dto, 'metaTitle'),
  metaDescription: optionalString(dto, 'metaDescription'),
  alternates: (dto?.alternates === undefined ? [] : field(dto, 'alternates', 'array')).map(
    (alternate) => ({
      locale: field(alternate, 'locale', 'string'),
      slug: field(alternate, 'slug', 'string'),
    }),
  ),
})

export const toArticles = (dto) => {
  if (!Array.isArray(dto)) throw new ApiContractError('articles')
  return dto.map(toArticle)
}

export const toArticleSections = (dto) => {
  if (!Array.isArray(dto)) throw new ApiContractError('article-sections')
  return dto.map(toTaxon)
}
