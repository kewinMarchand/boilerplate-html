# 0005 — Pages d'erreur dans la langue de l'adresse, choisies par nginx

- **Statut** : Acceptée
- **Introduite par** : le commit qui ajoute `$error_prefix` à `docker/default.conf.template`
- **Décideurs** : Kewin Marchand
- **Remplace** : la conséquence « les pages d'erreur de nginx (404, 405, 50x, 503) restent en français » de l'ADR 0004, dont le suivi prévoyait de rouvrir la décision si elles devaient suivre la langue.

## Contexte

Depuis l'ADR 0004, un site à plusieurs langues sert ses pages sous `/<langue>/`, mais une adresse anglaise introuvable, un envoi de formulaire refusé ou la maintenance affichaient une page française. Les autres fronts de la spec commune (section 29 bis) rendent ces pages dans la langue de l'adresse. Ici, aucun serveur applicatif ne tourne au moment de servir : seul nginx répond, et l'API peut être injoignable (c'est le cas de la maintenance).

## Décision

- La génération traduit les quatre pages d'erreur comme les autres pages et les écrit à la même place dans chaque langue (`/en/404.html`), sans équivalent (le sélecteur mène à l'accueil de chaque langue).
- nginx lit le préfixe de deux lettres de l'adresse (`map $uri $error_prefix`) et pointe `error_page` sur `$error_prefix/404.html`. Une règle interne sert ce fichier s'il existe, sinon celui de la racine (`try_files $uri /404.html`) : une langue non générée, ou un dossier de deux lettres comme `/js/`, reçoit la page de la langue par défaut du site. Le code HTTP et `Retry-After` de la maintenance ne changent pas.
- `scripts/serve.js` applique la même règle.

## Alternatives envisagées

- **Liste des langues écrite par la génération dans une configuration nginx** (comme l'empreinte du style de l'identité) : une règle exacte par langue, mais un fichier de plus à copier dans l'image pour un résultat identique au repli sur la racine. Rejetée.
- **Page d'erreur unique qui choisit sa langue en JavaScript** : texte français affiché d'abord, et rien sans JavaScript. Rejetée.
- **Langue du navigateur (`Accept-Language`)** : contraire à la spec, la langue suit l'adresse. Rejetée.

## Conséquences

- **Positives** : chaque langue a ses pages d'erreur et de maintenance, servies sans appel à l'API ; un site d'une seule langue n'a aucun fichier de plus et garde les mêmes réponses.
- **Négatives / coûts** : les textes des pages d'erreur passent par `i18n/*.json` comme les autres ; nginx a deux règles internes de plus.
- **Suivi** : rouvrir si une langue doit avoir une page d'erreur différente de la traduction de la page française.
