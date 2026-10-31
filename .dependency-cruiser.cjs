const { existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const MODULES = 'site/js/modules'

const modulesWithApplication = readdirSync(MODULES).filter((name) =>
  existsSync(join(MODULES, name, 'application')),
)

module.exports = {
  forbidden: [
    {
      name: 'module-vers-autre-module',
      comment: 'Un module n’importe jamais un autre module : la composition se fait dans la page.',
      severity: 'error',
      from: { path: '^site/js/modules/([^/]+)/' },
      to: { path: '^site/js/modules/', pathNot: '^site/js/modules/$1/' },
    },
    {
      name: 'module-vers-vue',
      comment: 'Un module ne connaît pas les vues qui le composent.',
      severity: 'error',
      from: { path: '^site/js/modules/' },
      to: { path: '^site/js/views/' },
    },
    {
      name: 'vue-vers-module',
      comment:
        'Sans index public en vanilla, une vue ne charge un module que par sa page HTML, jamais par import.',
      severity: 'error',
      from: { path: '^site/js/views/' },
      to: { path: '^site/js/modules/' },
    },
    {
      name: 'socle-vers-module-ou-vue',
      comment: 'Le socle n’importe ni module ni vue : il reçoit les données métier par le HTML.',
      severity: 'error',
      from: { path: '^site/js/shared/' },
      to: { path: '^site/js/(modules|views)/' },
    },
    {
      name: 'domaine-hors-domaine',
      comment: 'Le domaine n’importe que le domaine de son module.',
      severity: 'error',
      from: { path: '^site/js/modules/([^/]+)/domain/' },
      to: { pathNot: '^site/js/modules/$1/domain/' },
    },
    {
      name: 'application-hors-domaine-infrastructure',
      comment: 'La couche application n’importe que le domaine et l’infrastructure de son module.',
      severity: 'error',
      from: { path: '^site/js/modules/([^/]+)/application/' },
      to: { pathNot: '^site/js/modules/$1/(domain|application|infrastructure)/' },
    },
    {
      name: 'infrastructure-hors-domaine',
      comment: 'L’infrastructure n’importe que le domaine de son module et le client de l’API.',
      severity: 'error',
      from: { path: '^site/js/modules/([^/]+)/infrastructure/' },
      to: { pathNot: '^site/js/(modules/$1/(domain|infrastructure)/|shared/api\\.js$)' },
    },
    ...(modulesWithApplication.length > 0
      ? [
          {
            name: 'interface-vers-infrastructure',
            comment:
              'Dans un module qui a une couche application, l’interface passe par elle, jamais directement par l’infrastructure.',
            severity: 'error',
            from: { path: `^site/js/modules/(${modulesWithApplication.join('|')})/ui/` },
            to: { path: '^site/js/modules/$1/infrastructure/' },
          },
        ]
      : []),
    {
      name: 'client-api-hors-infrastructure',
      comment:
        'Le client de l’API n’est importé que par la couche infrastructure/http/ des modules (couche anti-corruption).',
      severity: 'error',
      from: { pathNot: '^site/js/modules/[^/]+/infrastructure/http/' },
      to: { path: '^site/js/shared/api\\.js$' },
    },
    {
      name: 'embla-hors-carrousel',
      comment: 'Embla n’est importé que par son adaptateur, shared/carousel/.',
      severity: 'error',
      from: { pathNot: '^site/js/shared/carousel/' },
      to: { path: '^site/vendor/embla-carousel' },
    },
    {
      name: 'boilerplates-ui-hors-wrapper',
      comment:
        'Les comportements de boilerplates-ui ne sont importés que par leurs wrappers, shared/modals.js et shared/menus.js.',
      severity: 'error',
      from: { pathNot: '^site/js/shared/(modals|menus)\\.js$' },
      to: { path: '^site/vendor/boilerplates-ui/' },
    },
    {
      name: 'outillage-vers-interface',
      comment:
        'L’outillage de test lit le domaine et les données des modules, jamais leur interface.',
      severity: 'error',
      from: { path: '^lib/' },
      to: { path: '^site/js/(modules/[^/]+/ui|views)/' },
    },
    {
      name: 'import-introuvable',
      comment: 'Un import qui ne se résout pas casserait la page dans le navigateur.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    webpackConfig: { fileName: 'scripts/depcruise-resolve.cjs' },
  },
}
