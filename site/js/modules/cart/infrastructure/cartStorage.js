import { MAX_QUANTITY } from '../domain/cart.js'

const STORAGE_KEY = 'panier'
const CHANGE_EVENT = 'panier:change'

const isLine = (line) =>
  typeof line?.slug === 'string' &&
  line.slug !== '' &&
  typeof line.name === 'string' &&
  line.name !== '' &&
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
    return lines.map(({ slug, name, price, quantity }) => ({ slug, name, price, quantity }))
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
