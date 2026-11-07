import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { withPicture } from './prerenderPicture.js'

/**
 * Pré-rendu du contenu administré dans l'API, à la construction de l'image, sur le modèle du
 * catalogue (ADR 0002) : diapositives de l'accueil et texte des pages légales, écrits à partir des
 * `<template>` des pages, les mêmes que ceux du navigateur, qui relit l'API au chargement. Sans API
 * joignable, la page reste telle quelle et se remplit dans le navigateur.
 *
 * Usage : node --import ./tests/unit/siteResolver.js scripts/prerender-content.js <site> <API_URL>
 */

const API_TIMEOUT_MS = 10_000
const LEGAL_PAGES = ['mentions-legales', 'donnees-personnelles', 'accessibilite']

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const templateOf = (html, id) =>
  html.match(new RegExp(`<template id="${id}">\\s*([\\s\\S]*?)\\s*</template>`))[1]

const withoutLoading = (html, state) =>
  html.replace(
    new RegExp(`(<div ${state}>)\\s*<div class="skeleton-list"[\\s\\S]*?</div>`),
    (_, open) => open,
  )

const withoutNoscript = (html, testId) =>
  html.replace(
    new RegExp(`\\s*<noscript>\\s*<div[^>]*data-testid="${testId}"[\\s\\S]*?</noscript>`),
    '',
  )

const slideItem = (template, slide, index, count) => {
  return withPicture(template, slide.image)
    .replace(
      'data-testid="carousel-slide"',
      `aria-label="${index + 1} sur ${count}" data-testid="carousel-slide"`,
    )
    .replace(/(data-slide-title>)[^<]*/, (_, open) => `${open}${escapeHtml(slide.title)}`)
    .replace(/(data-slide-text>)/, (_, open) => `${open}${escapeHtml(slide.text)}`)
}

/** HTML de l'accueil, diapositives écrites. Liste vide : page inchangée. */
export const prerenderCarousel = (html, slides) => {
  if (!slides.length) return html
  const template = templateOf(html, 'carousel-slide-template')
  const items = slides
    .map((slide, index) => slideItem(template, slide, index, slides.length))
    .join('')
  const page = html.replace(
    /(<div class="carousel-container" data-carousel-slides>)(<\/div>)/,
    (_, open, close) => `${open}${items}${close}`,
  )
  return withoutNoscript(withoutLoading(page, 'data-carousel-state'), 'home-carousel-noscript')
}

const legalSection = (template, section) =>
  template
    .replace(/(data-legal-section-title>)[^<]*/, (_, open) => `${open}${escapeHtml(section.title)}`)
    .replace(/<\/section>$/, () => `${section.html}</section>`)

/** HTML d'une page légale, titre et sections écrits. Le HTML de l'API est injecté tel quel. */
export const prerenderLegalPage = (html, legalPage) => {
  const template = templateOf(html, 'legal-section-template')
  const content =
    legalPage.introduction +
    legalPage.sections.map((section) => legalSection(template, section)).join('')
  const page = html
    .replace(/(<h1 data-legal-title>)[^<]*/, (_, open) => `${open}${escapeHtml(legalPage.title)}`)
    .replace(/(<div data-legal-content>)(<\/div>)/, (_, open, close) => `${open}${content}${close}`)
  return withoutNoscript(withoutLoading(page, 'data-legal-state'), 'legal-noscript')
}

const fetchJson = async (apiUrl, path) => {
  const response = await fetch(new URL(path, apiUrl), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`réponse ${response.status}`)
  return response.json()
}

const prerender = async (file, route, load, render) => {
  let data
  try {
    data = await load()
  } catch (error) {
    console.warn(`[contenu] ${route} rendue dans le navigateur, API injoignable (${error.message})`)
    return
  }
  writeFileSync(file, render(readFileSync(file, 'utf8'), data))
  console.info(`[contenu] ${route} pré-rendue`)
}

const main = async ([siteDir, apiUrl]) => {
  // Imports dynamiques : les traductions importent le socle par son chemin servi, que seul le
  // crochet siteResolver.js résout, et tests/e2e/accueil.e2e.js importe ce fichier sans lui.
  const { toSlides } = await import('/js/modules/content/infrastructure/http/slideTranslation.js')
  const { toLegalPage } =
    await import('/js/modules/content/infrastructure/http/legalPageTranslation.js')
  await prerender(
    join(siteDir, 'index.html'),
    '/',
    async () => toSlides(await fetchJson(apiUrl, '/api/slides')),
    prerenderCarousel,
  )
  for (const slug of LEGAL_PAGES) {
    await prerender(
      join(siteDir, slug, 'index.html'),
      `/${slug}`,
      async () => toLegalPage(await fetchJson(apiUrl, `/api/legal_pages/${slug}`)),
      prerenderLegalPage,
    )
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
