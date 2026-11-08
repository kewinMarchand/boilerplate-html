import { ApiError, apiGet } from '/js/shared/api.js'

import { toArticleDetail, toArticles, toArticleSections } from './articleTranslation.js'

/** `section` : slug de la rubrique, `null` ou absent pour tous les articles. */
export const findLatestArticles = async (section) =>
  toArticles(await apiGet('/api/articles', { section }))

/** Une API qui ne sert pas les rubriques (404, Hono) en vaut une sans rubrique. */
export const findArticleSections = async () => {
  try {
    return toArticleSections(await apiGet('/api/article-sections'))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return []
    throw error
  }
}

/** `null` si l'API ne connaît pas l'article (404). */
export const findArticle = async (slug) => {
  try {
    return toArticleDetail(await apiGet(`/api/articles/${encodeURIComponent(slug)}`))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
