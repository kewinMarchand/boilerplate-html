/** Centimes affichés en euros dans la langue de la page (« 34,90 € », « €34.90 »). */
export const formatPrice = (cents, locale) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
