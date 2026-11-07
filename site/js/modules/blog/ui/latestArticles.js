import { fillPicture } from '/js/shared/picture.js'

import { articleHref, formatPublishedAt } from '../domain/article.js'
import { ArticlesLoadError } from '../infrastructure/ArticlesLoadError.js'
import { findLatestArticles } from '../infrastructure/http/articleRepository.js'

const LATEST = 3

const state = document.querySelector('[data-blog-state]')
const grid = document.querySelector('[data-blog-grid]')
const cardTemplate = document.getElementById('blog-card-template')
const loading = state.firstElementChild.cloneNode(true)

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const renderCard = (article) => {
  const card = cardTemplate.content.firstElementChild.cloneNode(true)
  fillPicture(card.querySelector('picture'), article.image)
  const link = card.querySelector('[data-blog-title]')
  link.textContent = article.title
  link.href = articleHref(article.slug)
  card.querySelector('[data-blog-excerpt]').textContent = article.excerpt
  const date = card.querySelector('[data-blog-date]')
  date.dateTime = article.publishedAt
  date.textContent = formatPublishedAt(article.publishedAt)
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
    state.querySelector('[data-blog-error-message]').textContent = new ArticlesLoadError().message
    state.querySelector('[data-blog-retry]').addEventListener('click', loadArticles)
    return
  }
  state.replaceChildren(...(articles.length ? [] : [fromTemplate('blog-empty-template')]))
  grid.replaceChildren(...articles.slice(0, LATEST).map(renderCard))
}

loadArticles()
