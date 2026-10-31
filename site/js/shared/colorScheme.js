export const COLOR_SCHEME_KEY = 'color-scheme'
export const COLOR_SCHEMES = ['auto', 'light', 'dark']

const LABELS = { auto: 'système', light: 'clair', dark: 'sombre' }

export const currentColorScheme = (root) =>
  COLOR_SCHEMES.includes(root.dataset.colorScheme) ? root.dataset.colorScheme : 'auto'

export const applyColorScheme = ({ root, storage }, scheme) => {
  root.dataset.colorScheme = scheme

  try {
    if (scheme === 'auto') {
      storage.removeItem(COLOR_SCHEME_KEY)
    } else {
      storage.setItem(COLOR_SCHEME_KEY, scheme)
    }
  } catch {
    // Stockage bloqué (navigation privée, données de site refusées) : le choix vaut pour la page.
  }
}

// Le mode renforcé impose le clair : un autre choix reste mémorisé mais suspendu.
export const colorSchemeLabel = (scheme, enhanced) =>
  `Thème : ${LABELS[scheme]}${enhanced && scheme !== 'light' ? ", suspendu par l'accessibilité renforcée" : ''}`
