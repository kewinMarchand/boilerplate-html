import { findLatestArticles } from '../infrastructure/http/articleRepository.js'

import { renderArticleCard } from './articleCard.js'

const LATEST = 3
const FEATURED_SIZES = '(width >= 1024px) 66vw, 100vw'

const state = document.querySelector('[data-blog-state]')
const grid = document.querySelector('[data-blog-grid]')
const cardTemplate = document.getElementById('blog-card-template')
const loading = state.firstElementChild.cloneNode(true)

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const renderCard = (article, index) => {
  const card = renderArticleCard(cardTemplate, article)
  if (index === 0) {
    for (const source of card.querySelectorAll('source')) source.sizes = FEATURED_SIZES
  }
  return card
}

const loadArticles = async () => {
  state.replaceChildren(loading.cloneNode(true))
  grid.replaceChildren()
  let articles
  try {
    articles = await findLatestArticles()
  } catch {
    state.replaceChildren(fromTemplate('blog-error-template'))
    state.querySelector('[data-blog-retry]').addEventListener('click', loadArticles)
    return
  }
  state.replaceChildren(...(articles.length ? [] : [fromTemplate('blog-empty-template')]))
  grid.replaceChildren(...articles.slice(0, LATEST).map(renderCard))
}

loadArticles()
