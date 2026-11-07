import { ApiError, apiGet } from '/js/shared/api.js'

import { toArticleDetail, toArticles } from './articleTranslation.js'

export const findLatestArticles = async () => toArticles(await apiGet('/api/articles'))

/** `null` si l'API ne connaît pas l'article (404). */
export const findArticle = async (slug) => {
  try {
    return toArticleDetail(await apiGet(`/api/articles/${encodeURIComponent(slug)}`))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
