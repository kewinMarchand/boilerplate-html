import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { toSiteIdentity } from '/js/modules/identity/infrastructure/http/siteIdentityTranslation.js'

import {
  identityManifest,
  identityStyle,
  prerenderIdentity,
  styleHash,
} from '../../scripts/prerender-identity.js'
import { apiImage } from './apiImage.js'
import { SITE_DIR } from './renderedPages.js'

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
}
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
