# 0004 — Une génération par langue, traduite depuis les sources françaises

- **Statut** : Acceptée ; conséquence « pages d'erreur en français » remplacée par l'ADR 0005
- **Introduite par** : le commit qui ajoute `scripts/prerender-locales.js`
- **Décideurs** : Kewin Marchand
- **Complète** : ADR 0001 (inclusions SSI), 0002 et 0003 (pré-rendu à la construction). La section 29 bis de la spec commune demande aux fronts statiques « une génération par langue activée, sous son préfixe ».

## Contexte

L'API peut servir plusieurs langues (`locales` de `GET /api/site-identity`, la première par défaut). Ce dépôt n'a pas de build : `site/` est servi tel quel par nginx et par le serveur de développement, les pages sont écrites à la main en français, et le JavaScript lit son texte dans le navigateur. Un site d'une seule langue, le cas par défaut, ne doit changer en rien (mêmes routes, même HTML).

Il faut donc produire, quand l'API sert plusieurs langues, une copie de chaque page dans chaque autre langue, sous `/<langue>/`, sans réécrire les pages autour d'un moteur de gabarits et sans livrer de dictionnaire entier au navigateur.

## Décision

- Les sources restent en français, langue par défaut. `i18n/fr.json` et `i18n/en.json` (hors de `site/`, jamais servis) donnent chaque libellé par clé ; un test garantit les mêmes clés, l'absence d'ambiguïté, et que chaque texte et chaque attribut lisible des sources a sa valeur dans `fr.json`.
- La génération (`scripts/prerender-locales.js pages`, première étape de `scripts/generate.sh`, avant les pré-rendus des ADR 0002 et 0003) lit les langues dans l'API. À une seule langue, elle n'écrit rien. À plusieurs, elle écrit pour chaque autre langue une copie des pages et des partials sous `site/<langue>/` : textes et attributs remplacés par correspondance avec leur valeur française, liens internes et inclusions préfixés (`prefixPath`, seul point qui préfixe, partagé avec le navigateur), chemins, slugs et noms des catégories lus dans `GET /api/categories` (champ `alternates`). Toutes les pages reçoivent `<html lang data-locales>`, canonique, `og:locale`, `hreflang` et `x-default`, et le header le sélecteur de langue, dont les liens viennent de variables SSI posées par la page.
- Les libellés des scripts sont des attributs `data-label-*` de l'élément qu'ils servent, traduits par la même correspondance : chaque page ne porte que les siens.
- Les pré-rendus suivants lisent la langue de chaque page, appellent l'API avec `locale` et écrivent les équivalents des fiches (`alternates`) ; le sitemap reçoit ensuite une entrée par adresse et par langue, avec ses `xhtml:link`.
- nginx accepte un préfixe de deux lettres sur les fiches, le contact et les partials ; une langue non générée n'a aucun fichier, donc répond 404.

## Alternatives envisagées

- **Clés dans les sources (`data-i18n="clé"`) remplies à la construction** : sources neutres, mais le développement sans build afficherait des clés, ou un second rendu dans le serveur de développement. Rejetée.
- **Gabarits (Eleventy, Astro) pour tout le site** : le suivi de l'ADR 0003 l'envisageait pour une troisième famille de pages. La traduction touche toutes les pages, mais un remplacement par correspondance suffit et garde le site servi sans build. À reconsidérer si une langue demande des phrases construites autrement (ordre des mots dans un texte coupé par un lien).
- **Dictionnaire chargé par le navigateur** : contraire à la spec (aucun dictionnaire entier dans les scripts) et un aller-retour de plus. Rejetée.

## Conséquences

- **Positives** :
  - un site d'une seule langue garde ses pages et ses appels à l'API (`locale` n'est passé qu'à plusieurs langues) ;
  - chaque langue est servie en HTML statique, pré-rendu comme le français ;
  - le JavaScript ne reçoit que les libellés de sa page.
- **Négatives / coûts** :
  - un texte des sources se traduit par sa valeur exacte : changer un texte français impose de changer `fr.json` (le test le signale), et un même texte ne peut avoir qu'une traduction ;
  - un texte coupé par une balise se traduit morceau par morceau ;
  - les pages d'erreur de nginx (404, 405, 50x, 503) restent en français ;
  - le développement (`make up`) sert le français seul ; le site bilingue des tests est généré par le même script.
- **Suivi** : rouvrir la décision si une langue demande une syntaxe que la traduction morceau par morceau ne permet pas, ou si les pages d'erreur doivent suivre la langue.
