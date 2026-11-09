qa: lint arch-selftest icons-check format-check test-unit ## QA rapide : HTML, CSS, architecture, auto-test des règles, sprite d'icônes, format, tests unitaires

qa-full: qa test-e2e test-a11y metrics test-prod ## QA complète : QA rapide + e2e + a11y + Lighthouse + image de prod

lint: ## html-validate, stylelint, ESLint (tri des imports) et règles d'architecture (dependency-cruiser)
	$(RUN) yarn lint

arch-selftest: ## Écrit des violations volontaires des règles d'architecture, exige leur détection, puis les retire
	$(RUN) node scripts/arch-selftest.js

icons-check: ## Échoue si site/icons.svg ou la liste des noms ne correspondent plus à icons.json
	$(RUN) node scripts/icons.js --check

lint-fix: ## stylelint et ESLint (tri des imports) avec correction automatique
	$(RUN) yarn lint:fix

format: ## Prettier (écriture)
	$(RUN) yarn format

format-check: ## Prettier (vérification)
	$(RUN) yarn format:check

test: test-unit test-e2e test-a11y ## Tous les tests

test-unit: ## Tests unitaires (node:test)
	$(RUN) yarn test:unit

test-e2e: ## Tests end-to-end desktop et mobile (Playwright)
	$(RUN) yarn test:e2e

e2e-vite: ## e2e desktop des fichiers modifiés depuis origin/main (FICHIERS="…" ou GREP="…"), site bilingue régénéré seulement si ses sources ont changé
	$(RUN) env FICHIERS='$(FICHIERS)' GREP='$(GREP)' sh scripts/e2e-vite.sh

test-a11y: ## Tests d'accessibilité WCAG 2.1 AA, trois modes : standard, sombre, renforcé (axe-core + Playwright)
	$(RUN) yarn test:a11y

metrics: ## Métriques Lighthouse CI en clair puis en sombre (perf ≥ 90, a11y et SEO = 100)
	$(RUN) sh -c 'export CHROME_PATH=$$(node -e "import(\"@playwright/test\").then(({ chromium }) => console.log(chromium.executablePath()))") && yarn lhci && yarn lhci:sombre'

test-prod: ## Construit et lance l'image nginx sur la machine, la vérifie depuis le conteneur de dev (codes HTTP, en-têtes, SSI, maintenance)
	sh scripts/test-prod.sh

.PHONY: qa qa-full lint arch-selftest icons-check lint-fix format format-check test test-unit test-e2e e2e-vite test-a11y metrics test-prod
