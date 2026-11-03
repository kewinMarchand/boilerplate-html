# 0003 — Carrousel et pages légales pré-rendus à la construction de l'image

- **Statut** : Acceptée
- **Introduite par** : commit qui branche le carrousel et les pages légales sur l'API (lot 6 de l'administration)
- **Décideurs** : Kewin Marchand
- **Complète** : ADR 0002, dont le suivi prévoyait de rouvrir la décision « si d'autres pages demandent un pré-rendu ». Le catalogue ne change pas.

## Contexte

Avec l'administration de l'API Platform (son ADR 0001), le carrousel de l'accueil et le texte des pages légales (mentions légales, données personnelles, déclaration d'accessibilité) ne sont plus écrits dans le HTML : ils viennent de `GET /api/slides` et `GET /api/legal_pages/{slug}`. Ce dépôt lit ses données dans le navigateur. Sans autre mesure, le HTML servi ne contiendrait plus ni diapositives ni texte légal : un robot ou un visiteur sans JavaScript verrait un squelette, et la piste du carrousel ne défilerait plus nativement (exigence de la spec commune, testée en e2e).

Le pré-rendu à la construction de l'image existe déjà pour le catalogue (ADR 0002), avec son étape Node dans le `Dockerfile` et son contrôle dans `make test-prod`.

## Décision

On étend le pré-rendu de l'image au carrousel et aux trois pages légales, sur le modèle du catalogue.

- `scripts/prerender-content.js` est lancé dans la même étape du `Dockerfile` que `scripts/prerender-catalog.js`, avec le même `API_URL`.
- Il écrit les diapositives et les sections légales à partir des `<template>` des pages, les mêmes que ceux du navigateur, avec les traductions du module `content` : aucune règle écrite deux fois. Il retire le squelette et le `<noscript>`.
- Les diapositives sont échappées ; le HTML des sections légales est écrit tel quel, l'API ayant échappé le HTML saisi dans l'admin et retiré les liens dangereux.
- API injoignable à la construction : la page reste telle quelle et se remplit dans le navigateur.
- Dans le navigateur, le contenu est relu au chargement : une page pré-rendue est actualisée sans squelette, et garde son contenu si l'actualisation échoue.
- `make test-prod` vérifie le pré-rendu dans l'image.

## Alternatives envisagées

- **Rendu dans le navigateur seul** : zéro outillage de plus, mais le texte légal n'existe qu'avec JavaScript, contrairement aux cinq autres fronts, et le carrousel perd son défilement sans JavaScript. Rejetée.
- **Garder les textes en dur dans le HTML** : contredit l'ADR 0001 de l'API Platform (le client modifie ses textes sans développeur). Rejetée.
- **Générateur statique (Eleventy, Astro)** : le suivi de l'ADR 0002 l'envisageait si d'autres pages demandaient un pré-rendu. Avec quatre pages de plus, le coût reste celui d'un script par type de contenu, bien inférieur à faire passer tout le site par un outil. À reconsidérer si une troisième famille de pages s'ajoute.

## Conséquences

- **Positives** :
  - le texte légal et les diapositives sont dans le HTML servi, lisibles sans JavaScript et par les robots ;
  - le carrousel garde son défilement natif sans JavaScript ;
  - pas de squelette ni de décalage au premier affichage de l'image.
- **Négatives / coûts** :
  - un texte modifié dans l'admin n'apparaît dans le HTML servi qu'à la reconstruction de l'image ; le navigateur l'actualise au chargement, mais un robot voit l'état de la construction ;
  - la construction dépend un peu plus de l'API ;
  - le développement ne montre pas le pré-rendu, seul `make test-prod` le vérifie ;
  - le script remplace des fragments de HTML par expressions régulières, ancrés sur les attributs `data-` et les identifiants de `<template>` : les renommer impose de mettre le script à jour (`tests/unit/prerenderContent.test.js` échoue sinon).
- **Suivi** : rouvrir la décision si le texte doit être frais pour les robots (régénération planifiée de l'image, ou serveur applicatif), ou si une nouvelle famille de pages demande un pré-rendu.
