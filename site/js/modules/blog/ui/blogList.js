import { ArticlesLoadError } from '../infrastructure/ArticlesLoadError.js'
import { findLatestArticles } from '../infrastructure/http/articleRepository.js'

import { renderArticleCard } from './articleCard.js'

const state = document.querySelector('[data-blog-state]')
const list = document.querySelector('[data-blog-list]')
const cardTemplate = document.getElementById('blog-card-template')

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const loadArticles = async () => {
  // Liste pré-rendue dans l'image de production : actualisée sans squelette, gardée si l'API échoue
  const prerendered = list.childElementCount > 0
  if (!prerendered) state.replaceChildren(fromTemplate('blog-loading-template'))
  let articles
  try {
    articles = await findLatestArticles()
  } catch {
    if (prerendered) return
    state.replaceChildren(fromTemplate('blog-error-template'))
    state.querySelector('[data-blog-error-message]').textContent = new ArticlesLoadError().message
    state.querySelector('[data-blog-retry]').addEventListener('click', loadArticles)
    return
  }
  state.replaceChildren(...(articles.length ? [] : [fromTemplate('blog-empty-template')]))
  list.replaceChildren(...articles.map((article) => renderArticleCard(cardTemplate, article)))
}

loadArticles()
