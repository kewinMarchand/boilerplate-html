/**
 * Ligne du panier : `{ id, slug, name, price, quantity, translations }`, identifiée par le produit, prix en
 * centimes relevé à l'ajout. `slug` et `name` dans la langue de l'ajout, `translations` (`{ locale, slug,
 * name }`) dans chaque langue du site (vide sur un site d'une seule langue).
 */
export const MAX_QUANTITY = 99

const clampQuantity = (quantity) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity)))

/** Ajoute une unité ; un produit déjà présent voit sa quantité augmenter, plafonnée. */
export const addItem = (lines, item) =>
  lines.some((line) => line.id === item.id)
    ? lines.map((line) =>
        line.id === item.id ? { ...line, quantity: clampQuantity(line.quantity + 1) } : line,
      )
    : [...lines, { ...item, quantity: 1 }]

export const setQuantity = (lines, id, quantity) =>
  lines.map((line) => (line.id === id ? { ...line, quantity: clampQuantity(quantity) } : line))

export const removeItem = (lines, id) => lines.filter((line) => line.id !== id)

/** Slug et nom de la ligne dans la langue de la page, ceux de la langue de l'ajout à défaut. */
export const lineIn = (line, locale) =>
  line.translations.find((translation) => translation.locale === locale) ?? line

export const countItems = (lines) => lines.reduce((count, line) => count + line.quantity, 0)

export const totalPrice = (lines) =>
  lines.reduce((total, line) => total + line.price * line.quantity, 0)
