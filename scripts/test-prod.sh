#!/bin/sh
set -eu

# Deux rôles. Sur la machine : construit l'image nginx et la lance dans trois configurations
# (Docker est le seul prérequis). Dans le conteneur de dev, appelé par la machine avec
# `checks <phase>` : vérifie l'image par HTTP, sur le réseau de la machine.

IMAGE=boilerplate-html:test
PORT=3140
NAME=boilerplate-html-prod-test
PAGES='/ /catalogue /blog /catalogue/plantes-interieur /catalogue/plantes-interieur/feuillages /taches /contact /mentions-legales /donnees-personnelles /accessibilite /plan-du-site /panier /route-inexistante'

if [ "${1:-}" = checks ]; then
  FAILED=0

    expect_status() {
      status=$(curl --silent --output /dev/null --write-out '%{http_code}' "http://localhost:$PORT$1")
      if [ "$status" = "$2" ]; then
        echo "ok   $2 $1"
      else
        echo "FAIL $1 : attendu $2, reçu $status"
        FAILED=1
      fi
    }

    expect_body() {
      body=$(curl --silent "http://localhost:$PORT$1")
      if printf '%s' "$body" | grep --quiet -- "$2" && ! printf '%s' "$body" | grep --quiet 'an error occurred'; then
        echo "ok   inclusions résolues sur $1"
      else
        echo "FAIL inclusions non résolues sur $1"
        FAILED=1
      fi
    }

    expect_no_ssi_error() {
      errors=0
      for route in $PAGES; do
        if curl --silent "http://localhost:$PORT$route" | grep --quiet 'an error occurred'; then
          echo "FAIL directive SSI en erreur sur $route"
          errors=1
          FAILED=1
        fi
      done
      if [ "$errors" = 0 ]; then echo "ok   aucune directive SSI en erreur ($1)"; fi
    }

    expect_header() {
      if curl --silent --head "http://localhost:$PORT$1" | grep --quiet --ignore-case "^$2"; then
        echo "ok   en-tête $2 sur $1"
      else
        echo "FAIL en-tête $2 absent sur $1"
        FAILED=1
      fi
    }

  case "$2" in
  normal)
    for route in / /catalogue /blog /catalogue/plantes-interieur /catalogue/plantes-interieur/feuillages \
      /taches /contact /mentions-legales /donnees-personnelles /accessibilite /plan-du-site \
      /sitemap.xml /robots.txt /vendor/embla-carousel.esm.js; do
      expect_status "$route" 200
    done
    expect_status /route-inexistante 404
    expect_status /catalogue/categorie-inconnue 404
    expect_status /charte-graphique 404
    expect_status /_erreur-test 404
    expect_status /404.html 404
    expect_status /partials/header.html 404
    expect_status /contact/demande/monstera-deliciosa.html 404
    # Une seule langue servie par l'API : aucun préfixe de langue, aucune alternative
    expect_status /en 404
    if curl --silent "http://localhost:$PORT/" | grep --quiet 'hreflang\|data-locales\|layout-languages'; then
      echo "FAIL langues écrites dans un site d'une seule langue"
      FAILED=1
    else
      echo "ok   site d'une seule langue, sans sélecteur ni hreflang"
    fi
    expect_status '/contact?produit=produit-inconnu' 200
    expect_body / 'data-site-header'
    expect_body /contact '<a href="/contact" aria-current="page">Contact</a>'
    expect_body /route-inexistante 'class="site-footer"'
    post_status=$(curl --silent --output /tmp/boilerplate-html-405.html --write-out '%{http_code}' --data 'name=Ada' "http://localhost:$PORT/contact")
    if [ "$post_status" = 405 ] && grep --quiet 'Envoi impossible sans JavaScript' /tmp/boilerplate-html-405.html; then
      echo "ok   405 POST /contact, page française"
    else
      echo "FAIL POST /contact : reçu $post_status sans la page française"
      FAILED=1
    fi
    expect_header / "content-security-policy: default-src 'self'; script-src 'self' 'sha256-"
    expect_header /route-inexistante "x-content-type-options: nosniff"
    expect_header / "content-security-policy: .*connect-src 'self' ${API_URL:-http://localhost:8090} *;"
    expect_body / "<link rel=\"preconnect\" href=\"${API_URL:-http://localhost:8090}\" crossorigin data-api-url"
    expect_no_ssi_error "sans traceur"
    catalog=$(curl --silent "http://localhost:$PORT/catalogue/plantes-interieur")
    if printf '%s' "$catalog" | grep --quiet 'data-product-id=' && printf '%s' "$catalog" | grep --quiet '"@type":"ItemList"'; then
      echo "ok   catalogue pré-rendu (produits et JSON-LD ItemList)"
    else
      echo "FAIL catalogue non pré-rendu : API injoignable à la construction ?"
      FAILED=1
    fi
    if printf '%s' "$catalog" | grep --quiet 'data-testid="catalog-filter-attribute-feuillage-persistant"' \
      && curl --silent "http://localhost:$PORT/produit/monstera-deliciosa" | grep --after-context=1 'data-testid="product-attributes"' | grep --quiet '><dt>'; then
      echo "ok   facette d'attribut et attributs de la fiche pré-rendus"
    elif curl --silent "${API_URL:-http://localhost:8090}/api/product-facets" | grep --quiet '"attributes"'; then
      echo "FAIL facette d'attribut ou attributs de la fiche non pré-rendus"
      FAILED=1
    else
      echo "ok   API sans attributs (section 23) : rien à pré-rendre"
    fi
    sections=$(curl --silent "http://localhost:$PORT/accessibilite" | grep --only-matching 'data-testid="legal-section"' | wc -l)
    if curl --silent "http://localhost:$PORT/" | grep --quiet 'aria-label="1 sur ' && [ "$sections" -gt 1 ]; then
      echo "ok   carrousel et pages légales pré-rendus"
    else
      echo "FAIL carrousel ou pages légales non pré-rendus : API injoignable à la construction ?"
      FAILED=1
    fi
    blog=$(curl --silent "http://localhost:$PORT/blog")
    if printf '%s' "$blog" | grep --quiet 'data-testid="blog-card"' \
      && printf '%s' "$blog" | grep --quiet 'href="/blog/le-mode-accessibilite-renforcee"' \
      && ! printf '%s' "$blog" | grep --quiet 'data-testid="blog-noscript"'; then
      echo "ok   liste des articles pré-rendue"
    else
      echo "FAIL liste des articles non pré-rendue : API injoignable à la construction ?"
      FAILED=1
    fi
    product=$(curl --silent "http://localhost:$PORT/produit/monstera-deliciosa")
    if printf '%s' "$product" | grep --quiet '"@type":"Product"' \
      && printf '%s' "$product" | grep --quiet 'data-testid="product-description"><p>' \
      && curl --silent "http://localhost:$PORT/" | grep --quiet 'href="/produit/' \
      && curl --silent "http://localhost:$PORT/sitemap.xml" | grep --quiet '/produit/monstera-deliciosa'; then
      echo "ok   fiches produit pré-rendues avec leur description, liées depuis le carrousel et listées dans le sitemap"
    else
      echo "FAIL fiches produit non pré-rendues : API injoignable à la construction ?"
      FAILED=1
    fi
    # Identité de l'API écrite à la construction (section 22 de la spec commune), ou celle de
    # site.config.json si l'API ne la sert pas ; bloc de couleurs autorisé par son empreinte
    node --input-type=module - "http://localhost:$PORT" "${API_URL:-http://localhost:8090}" <<'EOF' || FAILED=1
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const [site, api] = process.argv.slice(2)
const identity = await fetch(`${api}/api/site-identity`)
  .then((response) => (response.ok ? response.json() : null))
  .catch(() => null)
const name = identity?.name ?? JSON.parse(readFileSync('site.config.json', 'utf8')).name
const response = await fetch(`${site}/contact`)
const html = await response.text()
const csp = response.headers.get('content-security-policy')
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1]
const hash = css && `'sha256-${createHash('sha256').update(css).digest('base64')}'`
const manifest = await (await fetch(`${site}/manifest.webmanifest`)).json()
const checks = [
  [`titre et header au nom « ${name} »`, html.includes(` · ${name}</title>`) &&
    html.includes(identity?.logo ? `alt="${name}"` : `<span>${name}</span>`)],
  [`manifeste au nom « ${name} »`, manifest.name === name],
  [identity?.theme ? 'bloc de couleurs autorisé par son empreinte' : 'aucun bloc de couleurs',
    identity?.theme ? Boolean(hash) && csp.includes(`style-src 'self' ${hash}`)
      : css === undefined && !csp.includes("style-src 'self' 'sha256-")],
]
for (const [label, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
EOF
    # Galerie, rubriques, audio, métadonnées, image de partage et icônes (sections 22, 24, 25 et 26 de la
    # spec commune), pré-rendus quand l'API les sert ; une API qui ne les sert pas (Hono) laisse les pages telles quelles
    node --input-type=module - "http://localhost:$PORT" "${API_URL:-http://localhost:8090}" <<'EOF' || FAILED=1
const [site, api] = process.argv.slice(2)
const json = (path) =>
  fetch(`${api}${path}`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
const page = async (path) => {
  const response = await fetch(`${site}${path}`)
  return { html: await response.text(), csp: response.headers.get('content-security-policy') }
}
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
const product = await json('/api/products/monstera-deliciosa')
const sections = await json('/api/article-sections')
const articles = (await json('/api/articles')) ?? []
const withAudio = articles.find((article) => article.audio)
const metas = await json('/api/page-metas')
const identity = await json('/api/site-identity')
const checks = []
if (product?.gallery?.length) {
  const { html } = await page('/produit/monstera-deliciosa')
  const thumbs = html.match(/<a href="[^"]*"( aria-current="true")? class="product-gallery-thumb"/g) ?? []
  checks.push([
    `galerie pré-rendue, ${product.gallery.length + 1} vignettes en liens`,
    html.includes('data-testid="product-gallery"') && thumbs.length === product.gallery.length + 1,
  ])
} else checks.push(['API sans galerie (section 24) : rien à pré-rendre', true])
if (sections?.length) {
  const { html } = await page('/blog')
  const nav = html.match(/<nav\s+class="blog-sections"[\s\S]*?<\/nav>/)?.[0] ?? ''
  checks.push([
    'filtre par rubrique et sur-titres de /blog pré-rendus',
    !/\shidden\s*>/.test(nav) &&
      sections.every((section) => nav.includes(`>${escape(section.name)}</a>`)) &&
      html.includes('data-testid="article-section">'),
  ])
} else checks.push(['API sans rubriques (section 25) : rien à pré-rendre', true])
if (withAudio) {
  const { html, csp } = await page(`/blog/${withAudio.slug}`)
  checks.push([
    'lecteur audio pré-rendu, origine de l’API en media-src',
    html.includes(`<audio src="${withAudio.audio.src}"`) &&
      csp.includes(`media-src 'self' ${new URL(api).origin}`),
  ])
}
const blogMeta = metas?.find((meta) => meta.page === 'blog')
if (blogMeta?.description) {
  const { html } = await page('/blog')
  checks.push(['description saisie pour /blog servie', html.includes(`content="${escape(blogMeta.description)}"`)])
}
const { html: contact } = await page('/contact')
checks.push([
  identity?.icon ? 'favicons de l’API' : 'favicons du site, sans icône dans l’API',
  contact.includes(identity?.icon ? `href="${identity.icon.png32}"` : 'href="/favicon.svg"'),
])
checks.push([
  identity?.shareImage ? 'image de partage de l’API' : 'og-image.jpg, sans image de partage dans l’API',
  identity?.shareImage ? !contact.includes('og-image.jpg') : contact.includes('/images/og-image.jpg'),
])
const { html: home } = await page('/')
const organization = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])[
  '@graph'
].find((node) => node['@type'] === 'Organization')
checks.push([
  identity?.icon ? 'JSON-LD Organization avec l’icône 512 de l’API' : 'JSON-LD Organization avec le logo du site',
  identity?.icon ? organization.logo === identity.icon.png512 : organization.logo.endsWith('/icons/icon-512.png'),
])
for (const [label, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
EOF
    # Vente en ligne (section 27 de la spec commune) : panier ou demande de renseignement selon l'API,
    # et page contact d'une demande pré-rendue, servie seulement pour un produit connu
    node --input-type=module - "http://localhost:$PORT" "${API_URL:-http://localhost:8090}" <<'EOF' || FAILED=1
const [site, api] = process.argv.slice(2)
const identity = await fetch(`${api}/api/site-identity`)
  .then((response) => (response.ok ? response.json() : null))
  .catch(() => null)
const salesEnabled = identity?.salesEnabled ?? true
const page = async (path) => {
  const response = await fetch(`${site}${path}`)
  return { status: response.status, html: await response.text() }
}
const cart = await page('/panier')
const { html: product } = await page('/produit/monstera-deliciosa')
const { html: contact } = await page('/contact?produit=monstera-deliciosa')
const { html: unknown } = await page('/contact?produit=produit-inconnu')
const { html: invalid } = await page('/contact?produit=..%2Fpanier%2Findex')
const checks = [
  salesEnabled
    ? ['vente active : /panier, lien du panier et ajout au panier', cart.status === 200 &&
        product.includes('data-testid="cart-link"') && product.includes('addToCart.js') &&
        product.includes('data-testid="product-price"') && !product.includes('data-sales-disabled')]
    : ['vente coupée : /panier en 404, demande de renseignement sans prix ni panier', cart.status === 404 &&
        !product.includes('data-testid="cart-link"') && !product.includes('data-testid="product-price"') &&
        product.includes('href="/contact?produit=monstera-deliciosa"') && !product.includes('"offers"')],
  ['/contact?produit=… pré-rendue, avec la ligne et le champ caché', contact.includes('data-testid="contact-product"') &&
    contact.includes('<input type="hidden" name="product" value="monstera-deliciosa" />') &&
    contact.includes('<link rel="canonical" href="https://www.example.com/contact" />')],
  ['/contact?produit= inconnu ou invalide : formulaire simple', [unknown, invalid].every((html) =>
    html.includes('data-testid="contact-form"') && !html.includes('data-testid="contact-product"'))],
]
for (const [label, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
EOF
    if curl --silent "http://localhost:$PORT/" | grep --quiet 'data-glitchtip-dsn\|data-matomo-url'; then
      echo "FAIL un traceur est injecté sans configuration"
      FAILED=1
    else
      echo "ok   aucun traceur sans configuration"
    fi
    ;;
  traceurs)
    expect_no_ssi_error "avec traceurs"
    expect_body / 'data-glitchtip-dsn="https://cle@glitchtip.example.com/1"'
    expect_body / 'data-matomo-url="https://matomo.example.com/"'
    expect_body /donnees-personnelles 'data-testid="legal-audience-measurement"'
    if curl --silent "http://localhost:$PORT/route-inexistante" | grep --quiet 'data-glitchtip-dsn'; then
      echo "FAIL GlitchTip injecté sur une 404"
      FAILED=1
    else
      echo "ok   GlitchTip absent d'une 404"
    fi
    expect_header / "content-security-policy: .*connect-src 'self' ${API_URL:-http://localhost:8090} https://glitchtip.example.com https://matomo.example.com"
    ;;
  bilingue)
    # Scénario bilingue de l'API (section 29 bis de la spec commune) : français à la racine, anglais sous /en
    for route in / /en /en/catalogue /en/contact /en/blog /en/mentions-legales /sitemap.xml; do
      expect_status "$route" 200
    done
    expect_status /de 404
    expect_status /de/catalogue 404
    expect_status /en/partials/header.html 404
    expect_status /en/route-inexistante 404
    expect_no_ssi_error "bilingue"
    node --input-type=module - "http://localhost:$PORT" "${API_URL:-http://localhost:8090}" <<'EOF' || FAILED=1
const [site, api] = process.argv.slice(2)
const source = await fetch(`${api}/api/products/monstera-deliciosa?locale=fr`, {
  headers: { 'x-scenario': 'bilingual' },
}).then((response) => response.json())
const slug = source.alternates.find((alternate) => alternate.locale === 'en').slug
const page = async (path) => {
  const response = await fetch(`${site}${path}`)
  return { status: response.status, html: await response.text() }
}
const home = await page('/en')
const product = await page(`/en/produit/${slug}`)
const french = await page('/produit/monstera-deliciosa')
const sitemap = await page('/sitemap.xml')
const checks = [
  ['accueil anglais : <html lang="en">, sélecteur, scénario passé au navigateur',
    home.html.includes('<html lang="en" data-locales="fr en"') && home.html.includes('data-testid="layout-languages"') &&
      home.html.includes('data-api-scenario="bilingual"')],
  [`fiche anglaise /en/produit/${slug} pré-rendue, avec ses équivalents`, product.status === 200 &&
    product.html.includes(`<link rel="canonical" href="https://www.example.com/en/produit/${slug}" />`) &&
    product.html.includes('hreflang="fr" href="https://www.example.com/produit/monstera-deliciosa"') &&
    product.html.includes('hreflang="x-default"') && product.html.includes('"@type":"Product"')],
  ['fiche française : sélecteur vers l’équivalent anglais', french.html.includes(`href="/en/produit/${slug}" lang="en"`)],
  ['sitemap : adresses anglaises et xhtml:link', sitemap.html.includes('xmlns:xhtml=') &&
    sitemap.html.includes(`<loc>https://www.example.com/en/produit/${slug}</loc>`)],
]
for (const [label, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
EOF
    ;;
  maintenance)
    expect_status / 503
    expect_body / 'data-site-header'
    expect_status /catalogue 503
    expect_status /css/main.css 200
    expect_header / "retry-after: 3600"
    expect_header / "content-security-policy"
    ;;
  esac
  exit "$FAILED"
fi

start() {
  maintenance=$1
  shift
  docker rm --force "$NAME" > /dev/null 2>&1 || true
  # Même API à l'exécution qu'à la construction : la CSP doit autoriser l'origine des médias pré-rendus
  docker run --detach --name "$NAME" --publish "$PORT:80" --env "MAINTENANCE=$maintenance" \
    --env "API_URL=${API_URL:-http://localhost:8090}" "$@" "$IMAGE" > /dev/null
  tries=0
  until docker exec "$NAME" nc -z 127.0.0.1 80; do
    tries=$((tries + 1))
    [ "$tries" -lt 50 ] || { echo "FAIL l'image ne répond pas après 10 s"; docker logs "$NAME" | tail -5; return 1; }
    sleep 0.2
  done
}

FAILED=0
check() {
  docker compose run --rm -T node sh scripts/test-prod.sh checks "$1" || FAILED=1
}

# Le catalogue est pré-rendu à la construction (ADR 0002) : l'API doit répondre sur API_URL. Sans cache : BuildKit
# resservait la copie du site d'une construction précédente, pré-rendue contre d'autres données de l'API.
docker build --quiet --no-cache --network host --build-arg "API_URL=${API_URL:-http://localhost:8090}" --tag "$IMAGE" . > /dev/null

start 0
check normal
start 0 --env 'GLITCHTIP_DSN=https://cle@glitchtip.example.com/1' \
  --env 'MATOMO_URL=https://matomo.example.com/' --env 'MATOMO_SITE_ID=1'
check traceurs
start 1
check maintenance

# Site bilingue : même construction, depuis le scénario bilingue de l'API (en-tête X-Scenario de chaque appel)
docker build --quiet --no-cache --network host --build-arg "API_URL=${API_URL:-http://localhost:8090}" \
  --build-arg API_SCENARIO=bilingual --tag "$IMAGE" . > /dev/null
start 0
check bilingue

docker rm --force "$NAME" > /dev/null
exit "$FAILED"
