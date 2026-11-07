export class ProductLoadError extends Error {
  constructor() {
    super('Impossible de charger ce produit pour le moment.')
    this.name = 'ProductLoadError'
  }
}
