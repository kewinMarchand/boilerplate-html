import { fillPicture } from '/js/shared/picture.js'

import { articleHref, formatPublishedAt } from '../domain/article.js'

/** Carte d'article écrite depuis le `<template>` de la page, partagée par l'accueil et /blog. */
export const renderArticleCard = (template, article) => {
  const card = template.content.firstElementChild.cloneNode(true)
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
