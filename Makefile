.DEFAULT_GOAL := help

export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)
export PLAYWRIGHT_VERSION := $(shell sed -n 's/.*"@playwright\/test": "\([0-9.]*\)".*/\1/p' package.json)
RUN := docker compose run --rm node

include Makefile.qa.mk

PORT ?= 4096

help: ## Affiche cette aide
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Construit l'image de dev (Node, Chromium) et installe les dépendances dans son volume
	docker compose build node
	$(RUN) yarn install --frozen-lockfile

up: ## Lance le serveur statique de développement en conteneur (http://localhost:4098)
	$(RUN) yarn dev

icons: ## Génère site/icons.svg et la liste des noms depuis icons.json (noms Lucide)
	$(RUN) node scripts/icons.js

docker-build: ## Construit l'image nginx de production
	docker compose build

docker-up: ## Lance l'image de production (port PORT, 4096 par défaut)
	docker compose up

docker-down: ## Arrête les conteneurs
	docker compose --profile dev down --remove-orphans

.PHONY: help install up icons docker-build docker-up docker-down
