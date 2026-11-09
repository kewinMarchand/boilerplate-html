import { readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import { prefixPath } from '/js/shared/locale.js'

import { DEFAULT_QUERY, EXPOSURES, SIZES } from '/js/modules/catalog/domain/catalogQuery.js'
import { formatPrice } from '/js/modules/catalog/domain/price.js'
import {
  toFacetsQuery,
  toProductsQuery,
  toSearchResult,
} from '/js/modules/catalog/infrastructure/http/catalogTranslation.js'
import { attributeFacetsHtml } from '/js/modules/catalog/ui/attributeFacets.js'
import { exposureLabel, formatResultsCount } from '/js/modules/catalog/ui/labels.js'

import { fetchJson } from './apiFetch.js'
import { labelsOf, pageLocales } from './prerender-locales.js'
import { largestWebp, withPicture } from './prerenderPicture.js'
import { sitePages } from './ssi.js'

/**
 * Pré-rendu du catalogue à la construction de l'image (ADR 0002) : chaque page de catégorie reçoit
 * la première page de produits lue dans l'API, ses compteurs et une liste JSON-LD. Les produits
 * sont écrits à partir du `<template>` de la page, le même que celui du navigateur, qui relit
 * l'API au chargement et garde filtres, tri et pagination. Sans API joignable, la page reste telle
 * quelle et se remplit dans le navigateur.
 *
 * Chaque page est lue dans l'API dans sa langue (`<html lang>`), avec ses libellés (`data-label-*`).
 *
 * Usage : node --import ./tests/unit/siteResolver.js scripts/prerender-catalog.js <site> <API_URL>
 */

const EAGER_IMAGES = 4

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const productItem = (template, product, index, { labels, locale, locales }) => {
  const priority =
    index === 0 ? ' fetchpriority="high"' : index >= EAGER_IMAGES ? ' loading="lazy"' : ''
  return withPicture(template, product.image)
    .replace('class="product-item"', `class="product-item" data-product-id="${product.id}"`)
    .replace('data-product-card', `data-product-card id="produit-${escapeHtml(product.slug)}"`)
    .replace('data-product-image', `data-product-image${priority}`)
    .replace(/(data-product-name[^>]*>)[^<]*/, `$1${escapeHtml(product.name)}`)
    .replace(
      /href="\/catalogue"(\s+data-product-link)/,
      (_, rest) =>
        `href="${prefixPath(`/produit/${escapeHtml(product.slug)}`, locale, locales)}"${rest}`,
    )
    .replace(/(data-product-price[^>]*>)/, `$1${escapeHtml(formatPrice(product.price, locale))}`)
    .replace(
      /(data-product-exposure[^>]*>)/,
      `$1${escapeHtml(exposureLabel(labels, product.exposure))}`,
    )
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
  const context = { ...pageLocales(html), labels: labelsOf(html, 'data-catalog') }
  const items = result.items
    .map((product, index) => productItem(template, product, index, context))
    .join('')
  const next = result.pageCount > 1 ? `<link rel="next" href="${canonical.pathname}?page=2" />` : ''
  const jsonLd = `<script type="application/ld+json">${itemListJsonLd(result, canonical.origin)}</script>`

  let page = html
    .replace(/(<ul[^>]*data-catalog-list[^>]*>)(<\/ul>)/, `$1${items}$2`)
    .replace(
      /(<div class="catalog-state" data-catalog-state>)\s*<div class="product-skeletons"[\s\S]*?<\/div>/,
      '$1',
    )
    .replace(
      /(data-catalog-count[^>]*>)\s*[^<]*?\s*(?=<)/,
      (_, open) => `${open}${formatResultsCount(result.total, context.labels, context.locale)}`,
    )
    .replace(
      /(data-testid="catalog-noscript">[\s\S]*?<div class="bui-alert__body">\s*<p>)[\s\S]*?(<\/p>)/,
      (_, open, close) => `${open}${escapeHtml(context.labels.labelPrerendered)}${close}`,
    )
    .replace('</head>', `${next}${jsonLd}</head>`)
    .replace(
      /(<div class="attribute-facets" data-catalog-attribute-facets>)(<\/div>)/,
      (_, open, close) =>
        `${open}${attributeFacetsHtml(result.attributeFacets, DEFAULT_QUERY)}${close}`,
    )
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

const fetchFirstPage = async (apiUrl, categorySlug, locale) => {
  const [products, facets] = await Promise.all([
    fetchJson(apiUrl, '/api/products', { ...toProductsQuery(categorySlug, DEFAULT_QUERY), locale }),
    fetchJson(apiUrl, '/api/product-facets', {
      ...toFacetsQuery(categorySlug, DEFAULT_QUERY),
      locale,
    }),
  ])
  return toSearchResult(products, facets, DEFAULT_QUERY.page)
}

const main = async ([siteDir, apiUrl]) => {
  for (const file of sitePages(siteDir)) {
    const html = readFileSync(file, 'utf8')
    const category = html.match(/data-catalog\s+data-category="([^"]*)"/)
    if (!category) continue
    const page = `/${relative(siteDir, file)}`
    let result
    try {
      const { locale, locales } = pageLocales(html)
      result = await fetchFirstPage(apiUrl, category[1] || null, locales.length > 1 ? locale : null)
    } catch (error) {
      console.warn(
        `[catalogue] ${page} rendue dans le navigateur, API injoignable (${error.message})`,
      )
      continue
    }
    writeFileSync(file, prerenderCatalogPage(html, result))
    console.info(`[catalogue] ${page} : ${result.total} produits, ${result.items.length} écrits`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
