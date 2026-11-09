# boilerplate-html

Point de départ pour un site en **HTML, CSS et JavaScript natifs**, sans framework et sans bundler. Les fichiers servis sont ceux du dépôt, assemblés par nginx avec les inclusions côté serveur (SSI) pour le header et le footer. Seule l'image de production a une étape de construction : elle pré-rend depuis l'API la première page du catalogue, le carrousel de l'accueil et le texte des pages légales. L'outillage (validation, format, tests, Lighthouse) ne sert qu'au développement.

| Page                | Ce qu'elle montre                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                 | Hero pleine largeur avec photo LCP, carrousel Embla au glisser lu dans l'API, grille de blog en requêtes de conteneur                  |
| `/catalogue`        | Catalogue à facettes : filtres dans l'URL, comptage disjonctif, tri, grille ou liste, pagination                                       |
| `/catalogue/...`    | 14 pages de catégorie statiques sur 3 niveaux, menu en cascade (desktop) ou par niveaux (mobile)                                       |
| `/taches`           | Chargement en JavaScript avec ses trois états : chargement, erreur avec relance, liste vide                                            |
| `/contact`          | Formulaire en amélioration progressive, erreurs liées aux champs, confirmation annoncée, modale native                                 |
| Pages légales       | Mentions légales, données personnelles, déclaration d'accessibilité lues dans l'API (texte administré dans son `/admin`), plan du site |
| `/charte-graphique` | Tokens, typographie, composants et états, en développement seulement                                                                   |
| 404, 405, 500, 503  | Pages d'erreur dans le layout du site, avec le vrai code HTTP                                                                          |

## Stack

| Brique                             | Rôle                                                                |
| ---------------------------------- | ------------------------------------------------------------------- |
| HTML statique                      | Une page par fichier, URL propres (`taches/index.html` → `/taches`) |
| CSS natif, un seul fichier         | `site/css/main.css`, rangé en couches `@layer`                      |
| Modules ES natifs                  | Un fichier par comportement, chargés en `type="module"`             |
| Embla Carousel 8                   | Seule dépendance d'exécution, servie depuis `site/vendor/`          |
| `scripts/serve.js`                 | Serveur statique de développement, sans dépendance                  |
| html-validate, stylelint, Prettier | Validation HTML, CSS et format                                      |
| ESLint + simple-import-sort        | Ordre des imports                                                   |
| dependency-cruiser                 | Règles de dépendance entre modules et couches                       |
| `node:test`                        | Tests unitaires, sans dépendance                                    |
| Playwright + axe-core              | Tests end-to-end et accessibilité, desktop et mobile, trois modes   |
| Lighthouse CI                      | Performance, accessibilité, SEO                                     |
| nginx (Docker)                     | Production : URL propres, pages d'erreur, CSP stricte, maintenance  |

## Prérequis

- Docker avec Compose, `make` et git. Rien d'autre : Node, Yarn et Chromium tournent dans le conteneur de développement (image Playwright), y compris pour la QA, les tests et Lighthouse.

## Démarrage

```sh
git clone https://github.com/kewinMarchand/boilerplate-html.git
cd boilerplate-html
make install   # image de dev, dépendances dans son volume, copie d'Embla dans site/vendor
make up        # http://localhost:4098
```

L'URL publique est `https://www.example.com` (domaine réservé aux exemples). Elle apparaît dans les balises canoniques, Open Graph, JSON-LD, `sitemap.xml` et `robots.txt`, et dans `site.config.json`. Remplacez-la partout avant une mise en ligne. L'image de production peut aussi la remplacer à la construction, dans toutes les pages : `PUBLIC_SITE_URL=https://… make docker-build` (ce que fait la préprod).

Ports : registre unique de la section 7 de la spec commune (`~/Applications/boilerplates-commun/SPEC-COMMUNE.md`). Bloc 4080-4099 : 4080 e2e principal (serveur de développement lancé par Playwright), 4082 site bilingue des tests (desktop et mobile), 4084 bilingue en maintenance (lancé par `bilingue.e2e.js`), 4086 observabilité, 4087 faux GlitchTip, 4096 image de production (`make test-prod`, `make docker-up`, `PORT`), 4098 développement (`make up`), 4099 Lighthouse CI. Les autres ports du bloc sont libres.

## Démarrer un projet à partir de ce dépôt

### Créer le dépôt

Le dépôt est un modèle (« template ») sur GitHub. C'est la voie recommandée : le nouveau projet part d'un historique propre, sans lien avec celui-ci.

- Sur GitHub, bouton « Use this template ».
- Ou en ligne de commande :

  ```sh
  gh repo create mon-projet --template kewinMarchand/boilerplate-html --private --clone
  cd mon-projet
  make install
  ```

Pour suivre le boilerplate de près, en gardant son historique, on peut aussi le forker : `gh repo fork kewinMarchand/boilerplate-html --clone`.

### Récupérer les mises à jour du boilerplate

- **Depuis un fork**, l'historique est commun : on fusionne.

  ```sh
  git remote add upstream https://github.com/kewinMarchand/boilerplate-html.git
  git fetch upstream
  git merge upstream/main
  ```

- **Depuis un template**, l'historique n'est pas commun : un `merge` rejouerait tout le dépôt. On reprend les commits utiles un par un.

  ```sh
  git remote add boilerplate https://github.com/kewinMarchand/boilerplate-html.git
  git fetch boilerplate
  git log --oneline boilerplate/main
  git cherry-pick <commit>
  ```

Dans les deux cas, `make qa` puis `make test-e2e` après la mise à jour.

### Personnaliser

| Quoi                                                | Fichiers                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nom du projet                                       | `package.json` (`name`, `description`), titre de ce README, `LICENSE`                                                                                                                                                                                                                                                                       |
| Nom du site, URL, navigation, éditeur, état d'audit | `site.config.json`, puis les textes qui le reprennent : `site/partials/header.html` et `footer.html` (nom du site, liens), `<head>` de chaque page (titre, canonique, Open Graph, JSON-LD), `site/sitemap.xml`, `site/robots.txt`. Les tests unitaires signalent toute page qui diverge de la configuration                                 |
| URL publique                                        | `https://www.example.com`, à remplacer partout (`site.config.json`, `<head>` des pages, `sitemap.xml`, `robots.txt`)                                                                                                                                                                                                                        |
| Ports                                               | développement : 4098 (`package.json`, script `dev`, défaut de `scripts/serve.js`). Tests et outils, dans le bloc 4080-4099 (section 7 de la spec commune) : `playwright.config.js` et constantes de `tests/e2e/*.e2e.js`, `.lighthouserc.json`, `scripts/test-prod.sh`, `compose.yaml` (`PORT`)                                             |
| Logo et favicons                                    | `site/logo-mark.svg`, `site/favicon.svg`, `site/favicon.ico`, `site/apple-touch-icon.png`, `site/icons/icon-192.png`, `site/icons/icon-512.png`, `site/manifest.webmanifest`, image de partage `site/images/og-image.jpg`                                                                                                                   |
| Pages légales                                       | `site/mentions-legales/`, `site/donnees-personnelles/`, `site/accessibilite/` : titre et texte lus dans l'API (`GET /api/legal_pages/{slug}`), modifiés dans l'admin de l'API Platform (`/admin`, Pages légales). L'état de conformité du lien du footer reste calculé depuis `accessibility` dans `site.config.json`. `site/plan-du-site/` |
| URL mesurées par Lighthouse                         | `.lighthouserc.json`                                                                                                                                                                                                                                                                                                                        |
| Intégration continue                                | `.github/workflows/ci.yml`                                                                                                                                                                                                                                                                                                                  |
| Script inline du `<head>` modifié                   | nouveau hash dans `docker/security-headers.conf` (donné par `make test-unit`)                                                                                                                                                                                                                                                               |

### Retirer les modules d'exemple

`catalog` (catalogue) et `task` (démo des tâches) sont des exemples. La procédure ci-dessous les retire tous les deux et laisse `make qa` vert, auto-test d'architecture compris : `make arch-selftest` crée ses propres modules factices et ne dépend d'aucun module d'exemple. Pour n'en retirer qu'un, ne suivre que ses lignes.

1. Supprimer le code et les pages :

   ```sh
   rm -r site/js/modules/catalog site/catalogue site/js/modules/task site/taches
   ```

2. Retirer leurs entrées de navigation :
   - `site/partials/header.html` : l'élément `<li class="category-menu" data-category-menu>` en entier (le menu de catégories), et le bloc `if` du lien « Tâches ». `site/js/shared/categoryMenu.js` reste nécessaire pour le menu mobile et fonctionne sans menu de catégories.
   - `site.config.json` : les entrées `/catalogue` et `/taches` de `navigation`.
3. Retirer leurs URL : lignes `/catalogue` et `/taches` de `site/sitemap.xml`, liens et section « Catégories du catalogue » de `site/plan-du-site/index.html`, lien « Parcourir le catalogue » de `site/404.html`, URL correspondantes de `.lighthouserc.json`.
4. Repointer le premier appel à l'action de l'accueil (`data-testid="home-tasks-link"` dans `site/index.html`), qui mène à `/taches`.
5. `lib/breadcrumb.js` : garder seulement l'accueil et la page courante.

   ```js
   export const breadcrumbTrail = (path, label) =>
     path === '/' ? [] : [HOME, { label, href: path }]
   ```

   en retirant les imports du catalogue et la constante `CATALOG`.

6. Retirer le pré-rendu du catalogue : dans l'étape `catalog` du `Dockerfile`, la copie et la commande de `scripts/prerender-catalog.js` (l'étape reste pour `scripts/prerender-content.js`), puis `scripts/prerender-catalog.js`, `tests/unit/prerenderCatalog.test.js` et le contrôle « catalogue pré-rendu » de `scripts/test-prod.sh`.
7. Supprimer leurs tests :

   ```sh
   rm tests/unit/catalog.test.js tests/unit/catalogPages.test.js tests/unit/categoryPath.test.js \
     tests/unit/loadCatalogPage.test.js tests/unit/price.test.js tests/unit/tasks.test.js \
     tests/e2e/catalogue.e2e.js tests/e2e/menu.e2e.js tests/e2e/taches.e2e.js
   ```

8. `yarn format`, puis `make qa` : vert à ce stade.
9. Avant `make test-e2e`, `make test-a11y` et `make test-prod`, adapter les tests qui visitent encore ces pages : `CATEGORY_ROUTES` dans `tests/e2e/routes.js`, la route catalogue filtrée et le test « menu ouvert » de `tests/a11y/pages.a11y.js`, le fil d'Ariane et la capture du catalogue dans `tests/e2e/layout.e2e.js`, le lien de l'accueil dans `tests/e2e/accueil.e2e.js`, les routes `/catalogue` et `/taches` de `scripts/test-prod.sh`.

Les styles du catalogue et des tâches restent dans `site/css/main.css` (sections « Catalogue » et « Tâches ») jusqu'à ce qu'on les retire, sans effet sur la QA.

### Variables d'environnement de l'image

| Variable                | Rôle                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `MAINTENANCE`           | `1` : toutes les pages répondent 503                                                 |
| `GLITCHTIP_DSN`         | suivi des erreurs du navigateur (DSN au format Sentry). Vide : rien n'est chargé     |
| `GLITCHTIP_ENVIRONMENT` | environnement transmis à GlitchTip, `production` par défaut                          |
| `MATOMO_URL`            | adresse de l'instance Matomo, mesure d'audience sans cookie                          |
| `MATOMO_SITE_ID`        | identifiant du site dans Matomo. Sans les deux, rien n'est chargé                    |
| `API_SCENARIO`          | en-tête `X-Scenario` des appels du navigateur (par défaut, celui de la construction) |

Le serveur de développement lit les mêmes variables, par exemple `GLITCHTIP_DSN=… make up`.

## Commandes

`make help` liste toutes les commandes. Les principales :

| Commande                               | Effet                                                                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make up`                              | Serveur de développement sur le port 4098                                                                                                                                               |
| `make qa`                              | QA rapide : html-validate, stylelint, ESLint, règles d'architecture et leur auto-test, Prettier, tests unitaires                                                                        |
| `make icons`                           | Génère `site/icons.svg` et la liste des noms depuis `icons.json`                                                                                                                        |
| `make icons-check`                     | Échoue si le sprite est périmé ou si le site cite une icône absente de `icons.json`                                                                                                     |
| `make arch-selftest`                   | Écrit une violation de chaque règle d'architecture, exige sa détection, puis la retire                                                                                                  |
| `make qa-full`                         | QA complète : QA rapide, e2e, accessibilité, Lighthouse, image de production                                                                                                            |
| `make test-e2e`                        | Playwright, desktop et mobile                                                                                                                                                           |
| `make e2e-vite`                        | Playwright desktop sur les e2e modifiés depuis `origin/main`, ou `FICHIERS="tests/e2e/panier.e2e.js …"`, ou `GREP="motif"` ; site bilingue régénéré seulement si ses sources ont changé |
| `make test-a11y`                       | axe-core, WCAG 2.1 AA, chaque page en standard, sombre et renforcé                                                                                                                      |
| `make metrics`                         | Lighthouse CI sur le port 4099, en clair puis en sombre : échoue sous 90 en performance, sous 100 en accessibilité et SEO                                                               |
| `make test-prod`                       | Construit l'image nginx et vérifie codes HTTP, en-têtes, contenus pré-rendus, mode maintenance et image bilingue (API sur `API_URL`)                                                    |
| `make docker-build` / `make docker-up` | Image de production, sur le port `PORT` (4096 par défaut)                                                                                                                               |

En local, on ne lance que ce que le changement touche (section 30 de la spec commune) : `make qa` puis `make e2e-vite` avant un push. La suite complète (`make test-e2e`, `make test-a11y`, `make metrics`, `make test-prod`) tourne en CI à chaque push. `make e2e-vite` (`scripts/e2e-vite.sh`) garde dans `.cache/bilingue/empreinte-e2e` l'empreinte des sources de la génération du site bilingue (fichiers versionnés hors tests, docs et CI, `API_URL`) et ne la refait que si elle change ; mesuré sur `panier.e2e.js` et `bilingue.e2e.js` : 5,3 s à froid, 3,6 s à chaud. Après un changement des fixtures de l'API, `rm -rf .cache/bilingue`.

## Architecture

```
site/                        racine servie par nginx, avec inclusions côté serveur
  index.html, */index.html   une page par route, qui inclut le header et le footer
  partials/                  header (avec le lien d'évitement) et footer, en un seul exemplaire
  404.html, 50x.html, 503.html
  css/main.css               feuille unique : reset, tokens, base, layout, components, utilities
  js/
    modules/<module>/        catalog, contact, task : un sous-domaine métier chacun
      domain/                fonctions pures et value objects (CatalogQuery, CategoryPath, Price)
      application/           catalogue seulement : cas d'utilisation loadCatalogPage
      infrastructure/http/   lecture de l'API et traduction validée vers le domaine
      ui/                    point d'entrée chargé par la page, libellés, branchement au DOM
    views/styleguide/        charte graphique (développement seulement)
    shared/                  socle : mode renforcé, thème, menu de catégories, modales et menus (boilerplates-ui), latestOnly
      carousel/              seul fichier qui importe Embla
  vendor/                    Embla, copié par `yarn install` (non versionné)
  icons.svg                  sprite d'icônes Lucide, généré par `make icons`
  images/, icons/            médias AVIF et WebP, icônes de l'application
lib/                         fonctions d'outillage testées (fil d'Ariane, conformité RGAA)
scripts/                     serveur de développement, copie d'Embla, contrôle de l'image de prod,
                             auto-test des règles d'architecture
docker/                      configuration nginx et en-têtes de sécurité
tests/unit, tests/e2e, tests/a11y
site.config.json             nom, URL, navigation, éditeur, hébergeur, état d'audit
```

L'architecture suit le document commun `ARCHITECTURE-DDD.md` (forme vanilla). Chaque page HTML est sa propre couche de routage : elle charge par `<script type="module">` le point d'entrée `ui/` d'un module, une vue ou le socle. Un module n'importe jamais un autre module ni une vue, le socle n'importe ni module ni vue, et dans un module le domaine n'importe que lui-même. `make lint` vérifie ces règles avec dependency-cruiser, et `make arch-selftest` prouve qu'elles mordent en écrivant une violation de chacune. Le carrousel du socle ne connaît aucune donnée métier : le module `content` écrit dans le HTML les diapositives lues dans l'API, puis l'initialise (`initCarousel`).

### Sans build : ce qui est assumé

- **Header et footer sont inclus par nginx** (`<!--# include virtual="/partials/header.html" -->`), sans générateur ni build. Chaque page nomme d'abord sa place (`<!--# set var="page" value="contact" -->`), ce qui choisit le lien marqué `aria-current`. Le serveur de développement résout les mêmes directives. Un hébergement purement statique, sans SSI, afficherait les pages sans header ni footer (décision et alternatives : `doc/adr/0001-inclusions-serveur-nginx-ssi.md`). Le `<head>` SEO et le fil d'Ariane restent écrits dans chaque page. Pour qu'ils ne dérivent pas, `tests/unit/pages.test.js` vérifie sur le rendu de toutes les pages : navigation et liens légaux identiques à `site.config.json`, fil d'Ariane et JSON-LD conformes au calcul de `lib/breadcrumb.js`, titre et description dans les bonnes longueurs, canonique, hash du script inline présent dans la CSP, sitemap et plan du site complets.
- **Les données sont lues dans l'API par le navigateur** : produits, facettes, tâches, articles, diapositives du carrousel et texte des pages légales (administrés dans l'admin de l'API Platform ; le HTML des sections, produit par l'API depuis le Markdown, y échappe le HTML saisi et en retire les liens dangereux, il est injecté tel quel). Les pages de catégories restent statiques (une par chemin), seule leur liste vient de l'API. Sans JavaScript, chaque zone de données affiche un message, et le formulaire `GET` du catalogue place les filtres dans l'URL sans les appliquer : limite assumée d'un site sans serveur applicatif.
- **Le catalogue est pré-rendu dans l'image de production** (`scripts/prerender-catalog.js`, `doc/adr/0002-catalogue-pre-rendu-a-la-construction.md`) : chaque page de catégorie sert sa première page de produits et leur JSON-LD, lisibles sans JavaScript, puis le navigateur les actualise. Le carrousel de l'accueil et les pages légales le sont de la même façon (`scripts/prerender-content.js`) : sans JavaScript, la piste du carrousel défile au scroll-snap et le texte légal se lit. La construction lit l'API sur `API_URL` (`API_URL=http://localhost:8091 make docker-build`) ; sans API, les pages restent rendues dans le navigateur. Les données écrites sont celles du moment de la construction, et le serveur de développement ne pré-rend rien.
- **Une génération par langue** (`scripts/prerender-locales.js`, `doc/adr/0004-une-generation-par-langue.md`) : quand l'API sert plusieurs langues (`locales` de l'identité du site), l'image écrit une copie de chaque page sous `/<langue>/` (la langue par défaut reste à la racine), traduite depuis les sources françaises par `i18n/fr.json` et `i18n/<langue>.json`, avec liens préfixés, slugs des catégories et des fiches de l'API, `hreflang`, `og:locale`, sitemap avec `xhtml:link` et sélecteur de langue dans le header. À une seule langue, rien ne change. Un préfixe de langue non activée répond 404, et aucune redirection ne suit la langue du navigateur. Les pages d'erreur et de maintenance suivent le préfixe de l'adresse, sinon la langue par défaut du site. `make up` sert le français seul.
- **Le formulaire de contact ne s'envoie qu'avec JavaScript.** Il n'y a pas de serveur pour traiter un envoi. Sans JavaScript, un message au-dessus du formulaire l'annonce et donne l'adresse e-mail, et le `POST` natif reçoit une page française en 405 (`site/405.html`, servie par nginx et par `scripts/serve.js`).
- **Les balises `robots` et canonique des pages filtrées** sont mises à jour par le script. Un robot sans JavaScript voit la page de catégorie indexable, dont la canonique est déjà la version sans filtre.

## Recettes

### Ajouter une page

1. Copier une page existante proche, par exemple `site/contact/index.html`, vers `site/<route>/index.html`.
2. Adapter `<title>`, description, canonique, Open Graph, JSON-LD `BreadcrumbList`, fil d'Ariane et `<h1>`.
3. Garder en tête de `<body>` les trois directives : `set var="page"`, puis l'inclusion du header, et celle du footer en bas. Si la page entre dans la navigation, l'ajouter à `site.config.json` et à `site/partials/header.html` (ou `footer.html`), avec sa branche `aria-current`.
4. L'ajouter à `sitemap.xml` et au plan du site, à `.lighthouserc.json` si elle doit être mesurée.
5. Écrire son test dans `tests/e2e/`.

### Ajouter une icône

1. Ajouter son nom Lucide (lucide.dev) à `icons.json`.
2. `make icons` régénère `site/icons.svg` et `site/js/shared/iconNames.js`.
3. L'utiliser : `<svg class="icon" aria-hidden="true" focusable="false" width="20" height="20"><use href="/icons.svg#nom"></use></svg>`. Une icône porteuse de sens prend `role="img"` et un nom accessible au lieu d'`aria-hidden`.

### Ajouter ou changer un texte

Les pages sont écrites en français. Tout texte, attribut lisible (`aria-label`, `alt`, `title`, `placeholder`, métadonnées) ou libellé de script (`data-label-*` sur l'élément que le script sert, lu par `dataset`) a sa clé dans `i18n/fr.json` et sa traduction sous la même clé dans `i18n/en.json`. `make test-unit` liste les textes sans clé (`tests/unit/locales.test.js`). Un script ne contient aucun libellé : il lit `element.dataset.labelXxx`, remplace `{nom}` par `formatLabel` et accorde un nombre par `countLabel` (`site/js/shared/labels.js`), et préfixe ses liens internes par `localizePath` (`site/js/shared/locale.js`).

### Changer le script inline du `<head>`

Il pose `data-js`, le mode renforcé et le thème mémorisé avant le premier rendu. La CSP l'autorise par son hash : après toute modification, `make test-unit` affiche le nouveau hash attendu, à reporter dans `docker/security-headers.conf`.

### L'API

Le site est branché : `API_URL` désigne l'API (8090, API Platform, par défaut, ou 8091, Hono), par exemple `API_URL=http://localhost:8091 make up`. L'API doit autoriser l'origine du site (CORS). En e2e, les états d'erreur et de liste vide sont provoqués par l'en-tête `X-Scenario`, que Playwright ajoute aux requêtes du navigateur vers l'API (`withScenario` dans `tests/e2e/routes.js`).

`API_SCENARIO` fixe `X-Scenario` pour tous les appels, à la génération comme dans le navigateur. Le site bilingue des tests en dépend : Playwright le génère depuis le scénario `bilingual` de l'API (`scripts/generate.sh` dans `.cache/bilingue/`) et le sert sur 4082 pour `tests/e2e/bilingue.e2e.js` et `tests/a11y/bilingue.a11y.js` ; `make test-prod` construit aussi l'image bilingue (`--build-arg API_SCENARIO=bilingual`). Pour la voir : `API_URL=http://localhost:8091 API_SCENARIO=bilingual make docker-build docker-up`.

## CSS natif utilisé

| Fonctionnalité                   | Où                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `@layer`                         | Ordre global en tête de `main.css`                                                        |
| Imbrication native               | Partout (`&:hover`, `@media` imbriqués)                                                   |
| `@container`                     | Carte de blog, diapositive du carrousel, carte produit (grille ou liste)                  |
| `:has()`                         | Blog vide, champ en erreur, largeur du menu en cascade, défilement bloqué sous une modale |
| `:focus-visible`                 | Focus global, épaissi en mode renforcé                                                    |
| `oklch()`, `color-mix()`         | Tous les tokens de couleur, survols, surlignage                                           |
| `light-dark()` et `color-scheme` | Tokens clair et sombre, forcés en clair dans le mode renforcé                             |
| `clamp()`                        | Taille du `<h1>`                                                                          |
| Propriétés logiques              | Marges, bordures, positionnement (`inset-inline-start`, `margin-block`)                   |
| `text-wrap: balance` et `pretty` | Titres et paragraphes                                                                     |
| `prefers-reduced-motion`         | Transitions de page, squelettes, modale, défilement                                       |
| `scroll-snap`                    | Carrousel sans JavaScript                                                                 |
| `subgrid`                        | Colonnes alignées de la liste de tâches                                                   |
| `@view-transition`               | Transition entre pages, coupée en mode renforcé et sous mouvement réduit                  |

## Thème clair ou sombre

Le site suit le thème du système. Le bouton « Thème » de l'en-tête ouvre un menu (système, clair, sombre) : le choix pose `data-color-scheme` sur `<html>`, mémorisé en `localStorage` (clé `color-scheme`) et appliqué par le script inline avant le premier rendu. Les couleurs viennent des tokens de boilerplates-ui. Le mode renforcé garde toujours la page en clair.

## Mode accessibilité renforcée

Le bouton de l'en-tête pose `data-a11y-mode="enhanced"` sur `<html>`, mémorisé en `localStorage` (clé `a11y-mode`). Tout est en CSS par surcharge de tokens : texte de base à 20 px, contraste `#000` sur `#fff` et primaire AAA, liens soulignés, focus de 4 px, animations coupées. Les espacements de texte WCAG 1.4.12 ne s'appliquent qu'au contenu de `<main>`, jamais au header, à la navigation, aux boutons ni au footer.

## Production

L'image `nginx:1.31-alpine` sert `site/`, sans la charte graphique ni son script (`.dockerignore`) :

- URL propres par `try_files $uri $uri/index.html`, 404 personnalisée, 500/502/504 sur `50x.html`. Sous `/<langue>/`, la page d'erreur de cette langue si elle a été générée, sinon celle de la racine.
- Inclusions côté serveur (`ssi on;`) pour le header et le footer, `/partials/` et `/<langue>/partials/` internes (404 en accès direct).
- Préfixe de langue de deux lettres accepté par les règles des fiches et du contact ; une langue non générée n'a aucun fichier (404).
- En-têtes de sécurité partagés avec le serveur de développement (`docker/security-headers.conf`), dont une CSP sans `unsafe-inline`.
- Maintenance : `MAINTENANCE=1 make docker-up` répond 503 avec `Retry-After` sur toutes les pages, les fichiers statiques restant servis.
- La route `/_erreur-test`, qui déclenche la 500, n'existe que dans le serveur de développement.

## Tests

- **Unitaires** : `tests/unit/`, fonctions pures (catalogue, tâches, formulaire, mode renforcé, thème, contraste, fil d'Ariane, conformité) et cohérence des pages statiques.
- **End-to-end** : un fichier par page ou par brique, ciblage par `data-testid`, rendus conditionnels testés présents et absents, scénarios sans JavaScript pour le carrousel et le catalogue, absence de débordement à 375, 768 et 1280 px dans les deux modes.
- **Langues** : `tests/unit/locales.test.js` (mêmes clés en français et en anglais, aucun texte des pages sans clé, traduction, préfixes, `hreflang`, sitemap), `tests/e2e/bilingue.e2e.js` sur le site bilingue des tests (routes préfixées, libellés et contenu en anglais, sélecteur vers l'équivalent et repli vers l'accueil, en-tête, sitemap, 404 d'un préfixe non activé, site monolingue sans sélecteur, ligne du panier dans la langue de la page ; aucun libellé français, en mots entiers, sur les pages anglaises : textes de `i18n/fr.json` des sections communes, du layout, des erreurs, du catalogue, de la fiche, du panier, du contact et des tâches, et libellés par défaut de boilerplates-ui, y compris filtres actifs, pagination, catalogue vide, champs obligatoires, envoi et chargement retenus, erreur, 404 et maintenance d'une adresse anglaise).
- **Accessibilité** : axe-core sur chaque route, les pages d'erreur, la charte, le catalogue filtré et le menu ouvert, en standard, sombre et renforcé, et sur les pages anglaises du site bilingue. Axe ne couvre qu'une partie du RGAA : le lien du footer reste « non conforme » tant qu'aucun audit n'est renseigné dans `site.config.json`, et la déclaration se modifie dans l'admin de l'API.

## Licence

MIT
