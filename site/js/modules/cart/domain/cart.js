/** Ligne du panier : `{ slug, name, price, quantity }`, prix en centimes relevé à l'ajout. */
export const MAX_QUANTITY = 99

const clampQuantity = (quantity) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity)))

/** Ajoute une unité ; un produit déjà présent voit sa quantité augmenter, plafonnée. */
export const addItem = (lines, item) =>
  lines.some((line) => line.slug === item.slug)
    ? lines.map((line) =>
        line.slug === item.slug ? { ...line, quantity: clampQuantity(line.quantity + 1) } : line,
      )
    : [...lines, { ...item, quantity: 1 }]

export const setQuantity = (lines, slug, quantity) =>
  lines.map((line) => (line.slug === slug ? { ...line, quantity: clampQuantity(quantity) } : line))

export const removeItem = (lines, slug) => lines.filter((line) => line.slug !== slug)

export const countItems = (lines) => lines.reduce((count, line) => count + line.quantity, 0)

export const totalPrice = (lines) =>
  lines.reduce((total, line) => total + line.price * line.quantity, 0)
