FROM node:24-alpine AS vendor
WORKDIR /app
# git : boilerplates-ui est une dépendance git, installée par étiquette
RUN apk add --no-cache git
COPY package.json yarn.lock ./
COPY scripts/vendor.js scripts/vendor.js
COPY vendor vendor
RUN yarn install --frozen-lockfile --production --ignore-scripts \
  && mkdir -p site/vendor \
  && node scripts/vendor.js

FROM node:24-alpine AS catalog
WORKDIR /app
ARG API_URL=http://localhost:8090
COPY package.json ./
COPY scripts/prerender-catalog.js scripts/prerender-content.js scripts/ssi.js scripts/
COPY tests/unit/siteResolver.js tests/unit/
COPY site site
RUN node --import ./tests/unit/siteResolver.js scripts/prerender-catalog.js site "$API_URL" \
  && node --import ./tests/unit/siteResolver.js scripts/prerender-content.js site "$API_URL"

FROM nginx:1.29-alpine
ENV MAINTENANCE=0 GLITCHTIP_DSN="" GLITCHTIP_ENVIRONMENT=production MATOMO_URL="" MATOMO_SITE_ID="" API_URL=http://localhost:8090
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=catalog /app/site /usr/share/nginx/html
COPY --from=vendor /app/site/vendor /usr/share/nginx/html/vendor
