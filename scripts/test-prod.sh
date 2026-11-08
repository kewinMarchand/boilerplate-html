#!/bin/sh
set -eu

# Deux rôles. Sur la machine : construit l'image nginx et la lance dans trois configurations
# (Docker est le seul prérequis). Dans le conteneur de dev, appelé par la machine avec
# `checks <phase>` : vérifie l'image par HTTP, sur le réseau de la machine.

IMAGE=boilerplate-html:test
PORT=3140
NAME=boilerplate-html-prod-test
PAGES='/ /catalogue /catalogue/plantes-interieur /catalogue/plantes-interieur/feuillages /taches /contact /mentions-legales /donnees-personnelles /accessibilite /plan-du-site /route-inexistante'

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
    for route in / /catalogue /catalogue/plantes-interieur /catalogue/plantes-interieur/feuillages \
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
    expect_header / "content-security-policy: .*connect-src 'self' http://localhost:8090 *;"
    expect_body / '<link rel="preconnect" href="http://localhost:8090" crossorigin data-api-url'
    expect_no_ssi_error "sans traceur"
    catalog=$(curl --silent "http://localhost:$PORT/catalogue/plantes-interieur")
    if printf '%s' "$catalog" | grep --quiet 'data-product-id=' && printf '%s' "$catalog" | grep --quiet '"@type":"ItemList"'; then
      echo "ok   catalogue pré-rendu (produits et JSON-LD ItemList)"
    else
      echo "FAIL catalogue non pré-rendu : API injoignable à la construction ?"
      FAILED=1
    fi
    sections=$(curl --silent "http://localhost:$PORT/accessibilite" | grep --only-matching 'data-testid="legal-section"' | wc -l)
    if curl --silent "http://localhost:$PORT/" | grep --quiet 'aria-label="1 sur ' && [ "$sections" -gt 1 ]; then
      echo "ok   carrousel et pages légales pré-rendus"
    else
      echo "FAIL carrousel ou pages légales non pré-rendus : API injoignable à la construction ?"
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
    expect_header / "content-security-policy: .*connect-src 'self' http://localhost:8090 https://glitchtip.example.com https://matomo.example.com"
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
  docker run --detach --name "$NAME" --publish "$PORT:80" --env "MAINTENANCE=$maintenance" "$@" "$IMAGE" > /dev/null
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

# Le catalogue est pré-rendu à la construction (ADR 0002) : l'API doit répondre sur API_URL
docker build --quiet --network host --build-arg "API_URL=${API_URL:-http://localhost:8090}" --tag "$IMAGE" . > /dev/null

start 0
check normal
start 0 --env 'GLITCHTIP_DSN=https://cle@glitchtip.example.com/1' \
  --env 'MATOMO_URL=https://matomo.example.com/' --env 'MATOMO_SITE_ID=1'
check traceurs
start 1
check maintenance

docker rm --force "$NAME" > /dev/null
exit "$FAILED"
