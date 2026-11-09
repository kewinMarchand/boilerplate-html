#!/bin/sh
set -eu

# Génération du site à partir de l'API, dans l'ordre : langues (copie traduite de chaque page sous
# /<langue>/ quand l'API en sert plusieurs), catalogue, contenu, identité, puis sitemap avec les
# équivalents de chaque adresse. Utilisée par l'image de production (Dockerfile) et par le site bilingue
# des tests e2e (API_SCENARIO=bilingual). Chaque étape lit la langue des pages écrites par la première.
#
# Usage : sh scripts/generate.sh <site> <API_URL> <fichier nginx de l'empreinte du style>

SITE=$1
API=$2
STYLE=$3
RESOLVER=./tests/unit/siteResolver.js

node --import "$RESOLVER" scripts/prerender-locales.js pages "$SITE" "$API"
node --import "$RESOLVER" scripts/prerender-catalog.js "$SITE" "$API"
node --import "$RESOLVER" scripts/prerender-content.js "$SITE" "$API"
node --import "$RESOLVER" scripts/prerender-identity.js "$SITE" "$API" "$STYLE"
node scripts/prerender-locales.js sitemap "$SITE"
