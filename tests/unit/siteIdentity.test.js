import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate'

import {
  toPageMetas,
  toSiteIdentity,
} from '/js/modules/identity/infrastructure/http/siteIdentityTranslation.js'

import { prerenderProduct, withCategoryHrefs } from '../../scripts/prerender-content.js'
import {
  identityManifest,
  identityStyle,
  prerenderIdentity,
  styleHash,
} from '../../scripts/prerender-identity.js'
import { apiImage } from './apiImage.js'
import { renderPage, SITE_DIR } from './renderedPages.js'

const CONFIG_NAME = JSON.parse(readFileSync(join(SITE_DIR, '..', 'site.config.json'), 'utf8')).name
const HOME = readFileSync(join(SITE_DIR, 'index.html'), 'utf8')
const CONTACT = readFileSync(join(SITE_DIR, 'contact/index.html'), 'utf8')
const HEADER = readFileSync(join(SITE_DIR, 'partials/header.html'), 'utf8')
const MANIFEST = readFileSync(join(SITE_DIR, 'manifest.webmanifest'), 'utf8')

const tokens = (primary) => ({
  primary,
  'primary-dark': '#000001',
  'on-primary': '#ffffff',
  'primary-surface-subtle': '#000002',
  'primary-surface': '#000003',
  'primary-surface-strong': '#000004',
  secondary: '#000005',
  'secondary-dark': '#000006',
  'on-secondary': '#111827',
  'secondary-surface-subtle': '#000007',
  'secondary-surface': '#000008',
  'secondary-surface-strong': '#000009',
})

const DTO = {
  name: 'Oraki & <Cie>',
  tagline: 'Plantes rares et tropicales, livrées chez vous.',
  logo: null,
  defaultColorScheme: 'auto',
  theme: null,
  shareImage: null,
  icon: null,
  salesEnabled: true,
}
const ICON = {
  png32: 'http://localhost:8090/media/i-32.png',
  png180: 'http://localhost:8090/media/i-180.png',
  png192: 'http://localhost:8090/media/i-192.png',
  png512: 'http://localhost:8090/media/i-512.png',
}
const SHARE_IMAGE = apiImage('share', [1200], { alt: 'Serre tropicale', ratio: 630 / 1200 })
const BLOG = readFileSync(join(SITE_DIR, 'blog/index.html'), 'utf8')
const THEME = { light: tokens('#c2410c'), dark: tokens('#fdba74') }
const LOGO = apiImage('logo', [200, 400], { alt: 'Oraki', ratio: 120 / 400 })

describe('traduction de l’identité du site', () => {
  it('lit l’identité sans logo ni couleurs', () => {
    assert.deepEqual(toSiteIdentity(DTO), DTO)
  })

  it('lit le logo et les douze jetons de chaque thème', () => {
    const identity = toSiteIdentity({ ...DTO, logo: LOGO, theme: THEME })
    assert.equal(identity.logo.src, LOGO.src)
    assert.deepEqual(identity.theme, THEME)
  })

  it('lit l’image de partage et l’icône, absentes d’une API qui ne les sert pas', () => {
    const identity = toSiteIdentity({ ...DTO, shareImage: SHARE_IMAGE, icon: ICON })
    assert.deepEqual(identity.shareImage, SHARE_IMAGE)
    assert.deepEqual(identity.icon, ICON)
    const { shareImage: _, icon: __, ...hono } = DTO
    assert.deepEqual(toSiteIdentity(hono), DTO)
    assert.throws(() => toSiteIdentity({ ...DTO, icon: { png32: 'a' } }), /png180/)
  })

  it('lit les métadonnées des pages fixes par clé', () => {
    assert.deepEqual(
      toPageMetas([
        { page: 'home', title: '', description: '' },
        { page: 'blog', title: 'Le blog', description: 'Conseils.' },
      ]),
      {
        home: { title: '', description: '' },
        blog: { title: 'Le blog', description: 'Conseils.' },
      },
    )
    assert.throws(() => toPageMetas({}), /page-metas/)
    assert.throws(() => toPageMetas([{ page: 'blog', title: null, description: '' }]), /title/)
  })

  it('refuse un écart de contrat', () => {
    assert.throws(
      () => toSiteIdentity({ ...DTO, defaultColorScheme: 'sepia' }),
      /defaultColorScheme/,
    )
    assert.throws(() => toSiteIdentity({ ...DTO, theme: undefined }), /theme/)
    assert.throws(
      () => toSiteIdentity({ ...DTO, theme: { ...THEME, dark: tokens('red') } }),
      /primary/,
    )
    const { secondary: _, ...missing } = tokens('#c2410c')
    assert.throws(
      () => toSiteIdentity({ ...DTO, theme: { ...THEME, light: missing } }),
      /secondary/,
    )
    assert.throws(() => toSiteIdentity({ ...DTO, name: undefined }), /name/)
    assert.throws(() => toSiteIdentity({ ...DTO, salesEnabled: undefined }), /salesEnabled/)
    assert.throws(() => toSiteIdentity({ ...DTO, salesEnabled: 'non' }), /salesEnabled/)
  })

  it('lit la vente en ligne coupée', () => {
    assert.equal(toSiteIdentity({ ...DTO, salesEnabled: false }).salesEnabled, false)
  })
})

describe('pré-rendu de l’identité', () => {
  const identity = toSiteIdentity(DTO)

  it('remplace le nom de la configuration partout, échappé', () => {
    const page = prerenderIdentity(CONTACT, identity, CONFIG_NAME)
    assert.ok(!page.includes(CONFIG_NAME))
    assert.match(page, /<title>[^<]* · Oraki &amp; &lt;Cie&gt;<\/title>/)
    assert.ok(page.includes('<meta property="og:site_name" content="Oraki &amp; &lt;Cie&gt;" />'))
  })

  it('écrit le nom dans le JSON-LD WebSite et Organization, et l’accroche dans le hero', () => {
    const page = prerenderIdentity(HOME, identity, CONFIG_NAME)
    const graph = JSON.parse(
      page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    )['@graph']
    assert.deepEqual(
      graph.map((node) => node.name),
      ['Oraki & <Cie>', 'Oraki & <Cie>'],
    )
    assert.ok(
      !page.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/)[0].includes('<Cie>'),
    )
    assert.ok(page.includes(`<p class="hero-lead">${DTO.tagline}</p>`))
    assert.ok(page.includes('<h1 id="hero-title">Oraki &amp; &lt;Cie&gt;</h1>'))
  })

  it('prend l’icône 512 de l’API en logo du JSON-LD Organization, sinon garde le logo du site', () => {
    const organization = (page) =>
      JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])[
        '@graph'
      ].find((node) => node['@type'] === 'Organization')
    assert.equal(
      organization(prerenderIdentity(HOME, { ...identity, icon: ICON }, CONFIG_NAME)).logo,
      ICON.png512,
    )
    assert.equal(
      organization(prerenderIdentity(HOME, identity, CONFIG_NAME)).logo,
      organization(HOME).logo,
    )
  })

  it('retire l’accroche du hero quand elle est vide', () => {
    assert.ok(
      !prerenderIdentity(HOME, { ...identity, tagline: '' }, CONFIG_NAME).includes('hero-lead'),
    )
  })

  it('sert le thème par défaut de l’API', () => {
    const page = prerenderIdentity(HOME, { ...identity, defaultColorScheme: 'dark' }, CONFIG_NAME)
    assert.ok(page.includes('<html lang="fr" data-color-scheme="dark">'))
  })

  it('garde le pictogramme et le nom sans logo, les remplace par l’image du logo sinon', () => {
    assert.equal(
      (prerenderIdentity(HEADER, identity, CONFIG_NAME).match(/logo-mark\.svg/g) ?? []).length,
      2,
    )
    const header = prerenderIdentity(HEADER, { ...identity, logo: LOGO }, CONFIG_NAME)
    assert.ok(!header.includes('logo-mark.svg'))
    const images = header.match(/<img class="logo-image"[^>]*>/g)
    assert.equal(images.length, 2)
    assert.match(
      images[0],
      /alt="Oraki &amp; &lt;Cie&gt;" width="133" height="40" fetchpriority="high"/,
    )
    assert.ok(images[0].includes(`src="${LOGO.src}"`))
  })

  it('sans couleurs, n’écrit aucun bloc de style', () => {
    assert.ok(!prerenderIdentity(HOME, identity, CONFIG_NAME).includes('<style>'))
  })

  it('avec couleurs, écrit le bloc des jetons, hors mode renforcé, autorisé par son empreinte', () => {
    const page = prerenderIdentity(HOME, { ...identity, theme: THEME }, CONFIG_NAME)
    const css = page.match(/<style>([\s\S]*?)<\/style>\s*<\/head>/)[1]
    assert.equal(css, identityStyle(THEME))
    assert.ok(css.startsWith(':root:not([data-a11y-mode="enhanced"]){--bui-color-primary:#c2410c;'))
    assert.ok(
      css.includes(
        '[data-color-scheme="dark"]:not([data-a11y-mode="enhanced"]){--bui-color-primary:#fdba74;',
      ),
    )
    assert.ok(
      css.includes(
        '@media (prefers-color-scheme: dark){[data-color-scheme="auto"]:not([data-a11y-mode="enhanced"]){--bui-color-primary:#fdba74;',
      ),
    )
    assert.equal(css.match(/--bui-color-/g).length, 36)
    assert.equal(styleHash(css), `'sha256-${createHash('sha256').update(css).digest('base64')}'`)
  })

  it('écrit le titre et la description saisis pour la page fixe, et garde ceux de la page sinon', () => {
    const meta = { title: 'Le blog des plantes rares', description: 'Conseils & actualités.' }
    const page = prerenderIdentity(BLOG, identity, CONFIG_NAME, meta)
    assert.ok(page.includes('<title>Le blog des plantes rares</title>'))
    assert.ok(page.includes('<meta property="og:title" content="Le blog des plantes rares" />'))
    assert.ok(page.includes('<meta name="twitter:title" content="Le blog des plantes rares" />'))
    for (const name of [
      'name="description"',
      'property="og:description"',
      'name="twitter:description"',
    ]) {
      assert.match(page, new RegExp(`${name}\\s+content="Conseils &amp; actualités\\."`))
    }
    const untouched = prerenderIdentity(BLOG, identity, CONFIG_NAME, { title: '', description: '' })
    assert.equal(untouched, prerenderIdentity(BLOG, identity, CONFIG_NAME))
    assert.match(untouched, /<title>Blog, tous les articles · Oraki &amp; &lt;Cie&gt;<\/title>/)
  })

  it('sert l’image de partage du site à la place de og-image.jpg, seulement sans image propre', () => {
    const page = prerenderIdentity(CONTACT, { ...identity, shareImage: SHARE_IMAGE }, CONFIG_NAME)
    assert.ok(!page.includes('og-image.jpg'))
    assert.ok(
      page.includes(
        '<meta property="og:image" content="http://localhost:8090/media/share-1200.webp" />',
      ),
    )
    assert.ok(
      page.includes(
        '<meta name="twitter:image" content="http://localhost:8090/media/share-1200.webp" />',
      ),
    )
    assert.ok(page.includes('<meta property="og:image:alt" content="Serre tropicale" />'))
    assert.ok(prerenderIdentity(CONTACT, identity, CONFIG_NAME).includes('/images/og-image.jpg'))
    const own = CONTACT.replace('/images/og-image.jpg', '/media/produit.webp')
    assert.ok(
      !prerenderIdentity(own, { ...identity, shareImage: SHARE_IMAGE }, CONFIG_NAME).includes(
        'share-1200',
      ),
    )
  })

  it('pointe les favicons sur les icônes de l’API, et garde ceux du site sans icône', () => {
    const page = prerenderIdentity(CONTACT, { ...identity, icon: ICON }, CONFIG_NAME)
    assert.ok(
      page.includes(`<link rel="icon" href="${ICON.png32}" type="image/png" sizes="32x32" />`),
    )
    assert.ok(page.includes(`<link rel="apple-touch-icon" href="${ICON.png180}" />`))
    assert.ok(!page.includes('favicon.'))
    const without = prerenderIdentity(CONTACT, identity, CONFIG_NAME)
    assert.ok(without.includes('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />'))
    assert.ok(without.includes('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />'))
    const manifest = JSON.parse(identityManifest(MANIFEST, { ...identity, icon: ICON }))
    assert.deepEqual(
      manifest.icons.map(({ src, sizes }) => [src, sizes]),
      [
        [ICON.png192, '192x192'],
        [ICON.png512, '512x512'],
      ],
    )
    assert.deepEqual(
      JSON.parse(identityManifest(MANIFEST, identity)).icons,
      JSON.parse(MANIFEST).icons,
    )
  })

  it('écrit le nom et la couleur principale dans le manifeste', () => {
    const manifest = JSON.parse(identityManifest(MANIFEST, { ...identity, theme: THEME }))
    assert.equal(manifest.name, 'Oraki & <Cie>')
    assert.equal(manifest.short_name, 'Oraki & <Cie>')
    assert.equal(manifest.theme_color, '#c2410c')
    assert.equal(
      JSON.parse(identityManifest(MANIFEST, identity)).theme_color,
      JSON.parse(MANIFEST).theme_color,
    )
  })
})

describe('pré-rendu sans vente en ligne', () => {
  const withSales = toSiteIdentity(DTO)
  const withoutSales = toSiteIdentity({ ...DTO, salesEnabled: false })
  const CATALOG = readFileSync(join(SITE_DIR, 'catalogue/index.html'), 'utf8')
  const product = withCategoryHrefs({
    id: 1,
    slug: 'monstera-deliciosa',
    name: 'Monstera <deliciosa>',
    categorySlug: 'monstera',
    price: 3490,
    exposure: 'mi-ombre',
    size: 'M',
    inStock: false,
    image: null,
    categoryPath: [{ slug: 'monstera', name: 'Monstera' }],
    description: 'Grandes feuilles.',
  })
  const FICHE = prerenderProduct(
    readFileSync(join(SITE_DIR, 'produit/fiche.html'), 'utf8'),
    product,
    'https://www.example.com/',
  )
  const fiche = prerenderIdentity(FICHE, withoutSales, CONFIG_NAME)
  const jsonLd = (page) =>
    [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      ([, json]) => JSON.parse(json),
    )

  it('laisse la page inchangée quand la vente est active', () => {
    const page = prerenderIdentity(FICHE, withSales, CONFIG_NAME)
    assert.ok(page.includes('data-testid="product-price"'))
    assert.ok(page.includes('data-add-to-cart'))
    assert.ok(page.includes('<template id="product-inquiry-template">'))
    assert.ok(jsonLd(page).some((data) => data.offers))
  })

  it('remplace l’ajout au panier par la demande de renseignement, même en rupture de stock', () => {
    assert.ok(!fiche.includes('data-testid="product-price"'))
    assert.ok(!fiche.includes('data-add-to-cart'))
    assert.ok(!fiche.includes('addToCart.js'))
    assert.ok(!fiche.includes('product-inquiry-template'))
    assert.match(
      fiche,
      /<a\s+class="bui-button"\s+href="\/contact\?produit=monstera-deliciosa"\s+data-product-inquiry\s+data-testid="product-inquiry"\s*>Demande de renseignement<span\s+class="bui-visually-hidden"\s+data-product-inquiry-name\s*> sur Monstera &lt;deliciosa&gt;<\/span/,
    )
  })

  it('retire les offres des données structurées et le prix de la description', () => {
    const [data] = jsonLd(fiche)
    assert.equal(data['@type'], 'Product')
    assert.equal(data.offers, undefined)
    assert.ok(!/content="[^"]*€/.test(fiche))
    assert.match(
      fiche,
      /name="description"\s+content="Monstera &lt;deliciosa&gt; : exposition mi-ombre, taille M\. En rupture/,
    )
  })

  it('marque la page pour les scripts', () => {
    assert.ok(fiche.includes('data-color-scheme="auto" data-sales-disabled>'))
    assert.ok(!prerenderIdentity(FICHE, withSales, CONFIG_NAME).includes('data-sales-disabled'))
  })

  it('retire prix, filtre et tris par prix du catalogue', () => {
    const page = prerenderIdentity(CATALOG, withoutSales, CONFIG_NAME)
    for (const removed of [
      'catalog-product-price',
      'catalog-filter-price-min',
      'catalog-filter-price-max',
      'value="prix-asc"',
      'value="prix-desc"',
      'cartLink.js',
    ]) {
      assert.ok(!page.includes(removed), removed)
    }
    assert.ok(page.includes('value="nom"'))
    assert.ok(page.includes('data-testid="catalog-filter-in-stock"'))
  })

  it('retire le lien du panier du header et le prix des diapositives', () => {
    assert.ok(!prerenderIdentity(HEADER, withoutSales, CONFIG_NAME).includes('cart-link'))
    assert.ok(!prerenderIdentity(HOME, withoutSales, CONFIG_NAME).includes('data-slide-text'))
  })

  it('produit un HTML valide', async () => {
    const report = await new HtmlValidate(new FileSystemConfigLoader()).validateString(
      renderPage(fiche),
      join(SITE_DIR, 'produit/fiche.html'),
    )
    assert.deepEqual(
      report.results.flatMap((result) => result.messages.map((message) => message.message)),
      [],
    )
  })
})
