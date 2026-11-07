import { ApiContractError, field, imageField } from '/js/shared/api.js'

export const toArticle = (dto) => ({
  id: String(field(dto, 'id', 'number')),
  slug: field(dto, 'slug', 'string'),
  title: field(dto, 'title', 'string'),
  excerpt: field(dto, 'excerpt', 'string'),
  publishedAt: field(dto, 'publishedAt', 'string'),
  image: imageField(dto, 'image'),
})

export const toArticleDetail = (dto) => ({
  ...toArticle(dto),
  html: field(dto, 'html', 'string'),
})

export const toArticles = (dto) => {
  if (!Array.isArray(dto)) throw new ApiContractError('articles')
  return dto.map(toArticle)
}
