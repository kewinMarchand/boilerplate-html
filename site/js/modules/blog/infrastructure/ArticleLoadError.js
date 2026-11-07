export class ArticleLoadError extends Error {
  constructor() {
    super('Impossible de charger cet article pour le moment.')
    this.name = 'ArticleLoadError'
  }
}
