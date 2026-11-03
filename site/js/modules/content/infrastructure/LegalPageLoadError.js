export class LegalPageLoadError extends Error {
  constructor() {
    super('Impossible de charger cette page pour le moment. Réessayez dans quelques minutes.')
    this.name = 'LegalPageLoadError'
  }
}
