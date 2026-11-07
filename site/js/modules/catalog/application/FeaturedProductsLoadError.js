export class FeaturedProductsLoadError extends Error {
  constructor() {
    super('Impossible de charger le carrousel pour le moment.')
    this.name = 'FeaturedProductsLoadError'
  }
}
