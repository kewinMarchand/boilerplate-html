#!/bin/sh
# make e2e-vite : Playwright, projet desktop seul, sur les fichiers e2e ciblés. Lancé dans le conteneur `node`, à la
# racine du dépôt. Le site principal est servi sans build ; seule la génération du site bilingue des tests est
# réutilisée tant que ses sources et ses variables n'ont pas changé, sinon refaite une fois.
#   FICHIERS="tests/e2e/a.e2e.js …" : ces fichiers ; GREP="motif" : les tests dont le titre correspond ;
#   sans l'un ni l'autre : fichiers modifiés par rapport à origin/main (--only-changed).
set -eu

ROOT=.cache/bilingue
EMPREINTE=$ROOT/empreinte-e2e

# Empreinte de ce qui entre dans la génération : fichiers suivis ou non ignorés hors tests, docs et configuration de
# la CI, le résolveur des tests unitaires qu'elle utilise, la feuille et les scripts copiés depuis node_modules
# (yarn.lock), et l'API lue (API_URL ; le scénario est toujours `bilingual`). Les données de l'API n'y sont pas :
# après un changement de fixtures, `rm -rf .cache/bilingue`.
empreinte() {
  {
    printf 'API_URL=%s\n' "${API_URL:-}"
    git ls-files -z -co --exclude-standard -- . ':!:tests' ':!:*.md' ':!:playwright.config.js' ':!:.github' \
      | xargs -0 sha256sum 2>/dev/null || true
    sha256sum tests/unit/siteResolver.js
  } | sha256sum | cut -d ' ' -f 1
}

SOURCES=$(empreinte)
if [ -f "$EMPREINTE" ] && [ "$(cat "$EMPREINTE")" = "$SOURCES" ]; then
  echo "e2e-vite : site bilingue à jour, réutilisé"
else
  echo "e2e-vite : sources modifiées depuis la dernière génération du site bilingue, nouvelle génération"
  GENERATION=$(node --input-type=module -e "console.log((await import('./playwright.config.js')).BILINGUAL_GENERATION)")
  API_SCENARIO=bilingual sh -c "$GENERATION"
  echo "$SOURCES" > "$EMPREINTE"
fi

set -- --project=desktop --pass-with-no-tests
if [ -n "${FICHIERS:-}" ]; then
  # shellcheck disable=SC2086 # une liste de fichiers séparés par des espaces
  set -- "$@" $FICHIERS
elif [ -n "${GREP:-}" ]; then
  set -- "$@" tests/e2e
else
  set -- "$@" tests/e2e --only-changed=origin/main
fi
if [ -n "${GREP:-}" ]; then set -- "$@" --grep "$GREP"; fi

E2E_SANS_GENERATION=1 exec yarn -s playwright test "$@"
