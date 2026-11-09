export const COLOR_SCHEME_KEY = 'color-scheme'
export const COLOR_SCHEMES = ['auto', 'light', 'dark']

export const currentColorScheme = (root) =>
  COLOR_SCHEMES.includes(root.dataset.colorScheme) ? root.dataset.colorScheme : 'auto'

export const applyColorScheme = ({ root, storage }, scheme) => {
  root.dataset.colorScheme = scheme

  try {
    storage.setItem(COLOR_SCHEME_KEY, scheme)
  } catch {
    // Stockage bloqué (navigation privée, données de site refusées) : le choix vaut pour la page.
  }
}

const SCHEME_LABELS = {
  auto: 'labelSchemeAuto',
  light: 'labelSchemeLight',
  dark: 'labelSchemeDark',
}

/**
 * Nom du bouton dans la langue de la page (`labels` : `data-label-*` de la bascule). Le mode renforcé
 * impose le clair : un autre choix reste mémorisé mais suspendu.
 */
export const colorSchemeLabel = (scheme, enhanced, labels) =>
  (enhanced && scheme !== 'light' ? labels.labelThemeSuspended : labels.labelTheme).replace(
    '{scheme}',
    labels[SCHEME_LABELS[scheme]],
  )
