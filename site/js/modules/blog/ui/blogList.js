import { blogHref, sectionFromSearch } from '../domain/article.js'
import { ArticlesLoadError } from '../infrastructure/ArticlesLoadError.js'
import {
  findArticleSections,
  findLatestArticles,
} from '../infrastructure/http/articleRepository.js'

import { renderArticleCard } from './articleCard.js'

const state = document.querySelector('[data-blog-state]')
const list = document.querySelector('[data-blog-list]')
const sectionsNav = document.querySelector('[data-blog-sections]')
const cardTemplate = document.getElementById('blog-card-template')
const activeSection = sectionFromSearch(window.location.search)

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const sectionItem = (name, slug) => {
  const link = document.createElement('a')
  link.className = 'bui-link'
  link.href = blogHref(slug)
  link.textContent = name
  if (slug === activeSection) link.setAttribute('aria-current', 'page')
  const item = document.createElement('li')
  item.append(link)
  return item
}

const renderSections = (sections) => {
  if (!sections.length) {
    sectionsNav.remove()
    return
  }
  sectionsNav
    .querySelector('[data-blog-sections-list]')
    .replaceChildren(
      sectionItem('Toutes', null),
      ...sections.map((section) => sectionItem(section.name, section.slug)),
    )
  sectionsNav.hidden = false
}

const loadArticles = async () => {
  // Liste pré-rendue (sans filtre) dans l'image de production : actualisée sans squelette, gardée si l'API échoue
  const prerendered = list.childElementCount > 0 && !activeSection
  if (!prerendered) {
    state.replaceChildren(fromTemplate('blog-loading-template'))
    list.replaceChildren()
  }
  let articles
  let sections
  try {
    ;[articles, sections] = await Promise.all([
      findLatestArticles(activeSection),
      findArticleSections(),
    ])
  } catch {
    if (prerendered) return
    state.replaceChildren(fromTemplate('blog-error-template'))
    state.querySelector('[data-blog-error-message]').textContent = new ArticlesLoadError().message
    state.querySelector('[data-blog-retry]').addEventListener('click', loadArticles)
    return
  }
  if (sectionsNav.isConnected) renderSections(sections)
  state.replaceChildren(...(articles.length ? [] : [fromTemplate('blog-empty-template')]))
  list.replaceChildren(...articles.map((article) => renderArticleCard(cardTemplate, article)))
}

loadArticles()
