/**
 * Prix en centimes d'euro, entier positif ou nul, comme dans l'API. Les euros n'existent que dans
 * l'URL (prix_min, prix_max) et à l'affichage : seuls fromCents et eurosToCents produisent un prix.
 */
export class InvalidPriceError extends Error {
  constructor(cents) {
    super(`Un prix ne peut pas être négatif ni fractionnaire : ${cents} centimes.`)
    this.name = 'InvalidPriceError'
  }
}

export const Price = {
  fromCents: (cents) => {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new InvalidPriceError(cents)
    return cents
  },
}

export const eurosToCents = (euros) => Price.fromCents(Math.round(euros * 100))

/** Prix affiché dans la langue de la page (« 34,90 € », « €34.90 »). */
export const formatPrice = (price, locale) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(price / 100)
