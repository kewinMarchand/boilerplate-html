import { readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import { DEFAULT_QUERY, EXPOSURES, SIZES } from '/js/modules/catalog/domain/catalogQuery.js'
import { formatPrice } from '/js/modules/catalog/domain/price.js'
import {
  toProductsQuery,
  toSearchResult,
} from '/js/modules/catalog/infrastructure/http/catalogTranslation.js'
import { EXPOSURE_LABELS, formatResultsCount } from '/js/modules/catalog/ui/labels.js'

import { largestWebp, withPicture } from './prerenderPicture.js'
import { sitePages } from './ssi.js'

/**
 * Pré-rendu du catalogue à la construction de l'image (ADR 0002) : chaque page de catégorie reçoit
 * la première page de produits lue dans l'API, ses compteurs et une liste JSON-LD. Les produits
 * sont écrits à partir du `<template>` de la page, le même que celui du navigateur, qui relit
 * l'API au chargement et garde filtres, tri et pagination. Sans API joignable, la page reste telle
 * quelle et se remplit dans le navigateur.
 *
 * Usage : node --import ./tests/unit/siteResolver.js scripts/prerender-catalog.js <site> <API_URL>
 */

const EAGER_IMAGES = 4
const API_TIMEOUT_MS = 10_000

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const productItem = (template, product, index) => {
  const priority =
    index === 0 ? ' fetchpriority="high"' : index >= EAGER_IMAGES ? ' loading="lazy"' : ''
  return withPicture(template, product.image)
    .replace('class="product-item"', `class="product-item" data-product-id="${product.id}"`)
    .replace('data-product-card', `data-product-card id="produit-${escapeHtml(product.slug)}"`)
    .replace('data-product-image', `data-product-image${priority}`)
    .replace(/(data-product-name[^>]*>)[^<]*/, `$1${escapeHtml(product.name)}`)
    .replace(/(data-product-price[^>]*>)/, `$1${escapeHtml(formatPrice(product.price))}`)
    .replace(/(data-product-exposure[^>]*>)/, `$1${EXPOSURE_LABELS[product.exposure]}`)
    .replace(/(data-product-size[^>]*>)/, `$1${product.size}`)
    .replace(
      'data-product-out-of-stock',
      `data-product-out-of-stock${product.inStock ? ' hidden' : ''}`,
    )
}

const itemListJsonLd = (result, origin) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: result.total,
    itemListElement: result.items.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        ...(product.image && { image: largestWebp(product.image) }),
        offers: {
          '@type': 'Offer',
          price: (product.price / 100).toFixed(2),
          priceCurrency: 'EUR',
          availability: `https://schema.org/${product.inStock ? 'InStock' : 'OutOfStock'}`,
        },
      },
    })),
  }).replaceAll('<', '\\u003c')

/** HTML d'une page de catégorie, première page de produits écrite. Liste vide : page inchangée. */
export const prerenderCatalogPage = (html, result) => {
  if (result.total === 0) return html
  const template = html.match(
    /<template id="catalog-product-template">\s*([\s\S]*?)\s*<\/template>/,
  )[1]
  const canonical = new URL(html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)[1])
  const items = result.items.map((product, index) => productItem(template, product, index)).join('')
  const next = result.pageCount > 1 ? `<link rel="next" href="${canonical.pathname}?page=2" />` : ''
  const jsonLd = `<script type="application/ld+json">${itemListJsonLd(result, canonical.origin)}</script>`

  let page = html
    .replace(/(<ul[^>]*data-catalog-list[^>]*>)(<\/ul>)/, `$1${items}$2`)
    .replace(
      /(<div class="catalog-state" data-catalog-state>)\s*<div class="product-skeletons"[\s\S]*?<\/div>/,
      '$1',
    )
    .replace(
      /(data-catalog-count[^>]*>)\s*Chargement des produits…\s*/,
      `$1${formatResultsCount(result.total)}`,
    )
    .replace(
      /(data-testid="catalog-noscript">[\s\S]*?<div class="bui-alert__body"><p>)[\s\S]*?(<\/p>)/,
      "$1Sans JavaScript, seule la première page s'affiche, sans filtre ni tri.$2",
    )
    .replace('</head>', `${next}${jsonLd}</head>`)
  for (const [facet, values, counts] of [
    ['exposures', EXPOSURES, result.exposureCounts],
    ['sizes', SIZES, result.sizeCounts],
  ]) {
    for (const value of values) {
      page = page.replace(
        `data-count="${facet}-${value}">`,
        `data-count="${facet}-${value}">(${counts[value]})`,
      )
    }
  }
  for (const { category, count } of result.categoryCounts) {
    page = page.replace(
      new RegExp(`(data-count="category-${category.slug}"\\s*>)(\\(\\d+\\))?`),
      `$1(${count})`,
    )
  }
  return page
}

const productsUrl = (apiUrl, categorySlug) => {
  const url = new URL('/api/products', apiUrl)
  for (const [name, value] of Object.entries(toProductsQuery(categorySlug, DEFAULT_QUERY))) {
    for (const item of [value].flat()) url.searchParams.append(name, String(item))
  }
  return url
}

const fetchFirstPage = async (apiUrl, categorySlug) => {
  const response = await fetch(productsUrl(apiUrl, categorySlug), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`réponse ${response.status}`)
  return toSearchResult(await response.json())
}

const main = async ([siteDir, apiUrl]) => {
  for (const file of sitePages(siteDir)) {
    const html = readFileSync(file, 'utf8')
    const category = html.match(/data-catalog data-category="([^"]*)"/)
    if (!category) continue
    const page = `/${relative(siteDir, file)}`
    let result
    try {
      result = await fetchFirstPage(apiUrl, category[1] || null)
    } catch (error) {
      console.warn(
        `[catalogue] ${page} rendue dans le navigateur, API injoignable (${error.message})`,
      )
      continue
    }
    writeFileSync(file, prerenderCatalogPage(html, result))
    console.info(
      `[catalogue] ${page} : ${formatResultsCount(result.total)}, ${result.items.length} écrits`,
    )
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
