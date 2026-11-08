const PRICE_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** Centimes affichés en euros (« 34,90 € »). */
export const formatPrice = (cents) => PRICE_FORMAT.format(cents / 100)
