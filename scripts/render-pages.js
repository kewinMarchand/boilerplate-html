import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runtimeVariables } from './runtimeVariables.js'
import { renderSsi, sitePages } from './ssi.js'

const ROOT = fileURLToPath(new URL('../site/', import.meta.url))
const OUTPUT = process.argv[2]

/**
 * Rendu des pages tel que nginx les sert, sans traceur et avec des valeurs factices, pour que la
 * validation HTML couvre les deux branches des inclusions conditionnelles.
 */
const VARIANTS = {
  'sans-traceur': runtimeVariables({}),
  'avec-traceurs': runtimeVariables({
    GLITCHTIP_DSN: 'https://cle@glitchtip.example.com/1',
    GLITCHTIP_ENVIRONMENT: 'production',
    MATOMO_URL: 'https://matomo.example.com/',
    MATOMO_SITE_ID: '1',
    API_SCENARIO: 'bilingual',
  }),
}

rmSync(OUTPUT, { recursive: true, force: true })
for (const [variant, variables] of Object.entries(VARIANTS)) {
  for (const file of sitePages(ROOT)) {
    const html = renderSsi(readFileSync(file, 'utf8'), {
      readInclude: (path) => readFileSync(join(ROOT, path), 'utf8'),
      variables: { ...variables },
    })
    const target = join(OUTPUT, variant, relative(ROOT, file))
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, html)
  }
}
