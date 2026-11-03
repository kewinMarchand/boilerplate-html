export class SlidesLoadError extends Error {
  constructor() {
    super('Impossible de charger le carrousel pour le moment.')
    this.name = 'SlidesLoadError'
  }
}
