import { localizePath, pageLocale } from '/js/shared/locale.js'
import { fillPicture } from '/js/shared/picture.js'

import { articleHref, formatPublishedAt } from '../domain/article.js'

/** Carte d'article écrite depuis le `<template>` de la page, partagée par l'accueil et /blog. */
export const renderArticleCard = (template, article) => {
  const card = template.content.firstElementChild.cloneNode(true)
  fillPicture(card.querySelector('picture'), article.image)
  const section = card.querySelector('[data-blog-section]')
  if (article.section) section.textContent = article.section.name
  else section.remove()
  const link = card.querySelector('[data-blog-title]')
  link.textContent = article.title
  link.href = localizePath(articleHref(article.slug))
  card.querySelector('[data-blog-excerpt]').textContent = article.excerpt
  const date = card.querySelector('[data-blog-date]')
  date.dateTime = article.publishedAt
  date.textContent = formatPublishedAt(article.publishedAt, pageLocale())
  return card
}
