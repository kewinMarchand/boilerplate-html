import { MAX_QUANTITY } from '../domain/cart.js'

const STORAGE_KEY = 'panier'
const CHANGE_EVENT = 'panier:change'

const isText = (value) => typeof value === 'string' && value !== ''

const isTranslation = (translation) =>
  isText(translation?.locale) && isText(translation.slug) && isText(translation.name)

const isLine = (line) =>
  (line?.id === undefined || isText(line.id)) &&
  isText(line?.slug) &&
  isText(line.name) &&
  (line.translations === undefined ||
    (Array.isArray(line.translations) && line.translations.every(isTranslation))) &&
  Number.isSafeInteger(line.price) &&
  line.price >= 0 &&
  Number.isInteger(line.quantity) &&
  line.quantity >= 1 &&
  line.quantity <= MAX_QUANTITY

/** Panier enregistré ; vide si l'entrée est absente, illisible ou invalide. */
export const parseCart = (raw) => {
  if (raw === null) return []
  try {
    const lines = JSON.parse(raw)
    if (!Array.isArray(lines) || !lines.every(isLine)) return []
    // Panier enregistré avant les langues : sans identifiant ni traductions, le slug identifie la ligne
    return lines.map(({ id, slug, name, price, quantity, translations = [] }) => ({
      id: id ?? slug,
      slug,
      name,
      price,
      quantity,
      translations: translations.map((translation) => ({
        locale: translation.locale,
        slug: translation.slug,
        name: translation.name,
      })),
    }))
  } catch {
    return []
  }
}

// Valeur gardée seulement quand le stockage refuse l'écriture (navigation privée, quota) : le panier vaut alors pour la page.
let memory = null

const readRaw = () => {
  if (memory !== null) return memory
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export const readCart = () => parseCart(readRaw())

export const saveCart = (lines) => {
  const raw = JSON.stringify(lines)
  try {
    localStorage.setItem(STORAGE_KEY, raw)
    memory = null
  } catch {
    memory = raw
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Prévient des changements de cet onglet et des autres (événement `storage`). */
export const subscribeToCart = (onChange) => {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange()
  })
}
