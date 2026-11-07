import { fillPicture } from '/js/shared/picture.js'

import { articleHref, formatPublishedAt, slugFromPath } from '../domain/article.js'
import { ArticleLoadError } from '../infrastructure/ArticleLoadError.js'
import { findArticle } from '../infrastructure/http/articleRepository.js'

const page = document.querySelector('[data-article-page]')
const title = page.querySelector('[data-article-title]')
const crumb = page.querySelector('[data-article-crumb]')
const state = page.querySelector('[data-article-state]')
const content = page.querySelector('[data-article-content]')
// Absent d'une fiche pré-rendue dans l'image de production, qui sert déjà son texte
const loading = state.firstElementChild?.cloneNode(true)

/** HTML produit par l'API, qui échappe le HTML saisi dans l'admin : injecté tel quel. */
const fromHtml = (html) => {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true)

const setMeta = (selector, value) =>
  document.head.querySelector(selector)?.setAttribute('content', value)

/** Données structurées de la fiche, comme celles écrites au pré-rendu (absentes d'une fiche déjà pré-rendue). */
const addJsonLd = (article, url, home) => {
  if (document.head.querySelector('script[type="application/ld+json"]')) return
  const image = article.image?.sources
    .find(({ type }) => type === 'image/webp')
    ?.srcset.split(', ')
    .at(-1)
    ?.split(' ')[0]
  for (const data of [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: article.title,
      description: article.excerpt,
      datePublished: article.publishedAt,
      url,
      ...(image && { image }),
      inLanguage: 'fr-FR',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: home },
        { '@type': 'ListItem', position: 2, name: article.title, item: url },
      ],
    },
  ]) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(data)
    document.head.append(script)
  }
}

const renderArticle = (article) => {
  title.textContent = article.title
  crumb.textContent = article.title
  const date = content.querySelector('[data-article-date]')
  date.dateTime = article.publishedAt
  date.textContent = formatPublishedAt(article.publishedAt)
  const picture = content.querySelector('picture')
  if (picture) fillPicture(picture, article.image)
  const excerpt = content.querySelector('[data-article-excerpt]')
  excerpt.textContent = article.excerpt
  excerpt.hidden = !article.excerpt
  content.querySelector('[data-article-body]').replaceChildren(fromHtml(article.html))
  content.hidden = false
  state.replaceChildren()
  document.title = `${article.title} · ${document.title.split(' · ').at(-1)}`
  setMeta('meta[name="description"]', article.excerpt || article.title)
  setMeta('meta[name="robots"]', 'index, follow')
  const canonical = document.head.querySelector('link[rel="canonical"]')
  const url = new URL(articleHref(article.slug), canonical.href).href
  canonical.href = url
  setMeta('meta[property="og:url"]', url)
  setMeta('meta[property="og:title"]', document.title)
  setMeta('meta[property="og:description"]', article.excerpt || article.title)
  addJsonLd(article, url, new URL('/', url).href)
}

/** Article inconnu de l'API : message, et la page reste hors de l'index (pas de vraie 404 sans serveur). */
const renderNotFound = () => {
  title.textContent = 'Article introuvable'
  crumb.textContent = 'Article introuvable'
  state.replaceChildren(fromTemplate('article-not-found-template'))
}

const renderError = () => {
  state.replaceChildren(fromTemplate('article-error-template'))
  state.querySelector('[data-article-error-message]').textContent = new ArticleLoadError().message
  state.querySelector('[data-article-retry]').addEventListener('click', loadArticle)
}

const loadArticle = async () => {
  const prerendered = !content.hidden
  const slug = slugFromPath(window.location.pathname)
  if (!slug) {
    renderNotFound()
    return
  }
  if (!prerendered) state.replaceChildren(loading.cloneNode(true))
  let article
  try {
    article = await findArticle(slug)
  } catch {
    if (!prerendered) renderError()
    return
  }
  if (article === null) renderNotFound()
  else renderArticle(article)
}

loadArticle()
