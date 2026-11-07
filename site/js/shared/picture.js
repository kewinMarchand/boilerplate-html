/**
 * Pose l'objet `image` du contrat de l'API (ADR 0002 de l'API Platform) dans le `<picture>` d'un
 * gabarit : une `<source>` par type, puis l'`<img>`. Image absente : le `<picture>` est retiré.
 */
export const fillPicture = (picture, image) => {
  if (!image) {
    picture.remove()
    return
  }
  for (const source of picture.querySelectorAll('source')) {
    source.srcset = image.sources.find(({ type }) => type === source.type)?.srcset ?? ''
  }
  Object.assign(picture.querySelector('img'), {
    src: image.src,
    alt: image.alt,
    width: image.width,
    height: image.height,
  })
}
