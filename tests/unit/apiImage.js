/** Objet `image` du contrat de l'API (ADR 0002 de l'API Platform), comme le renvoie l'API. */
export const apiImage = (key, widths, { alt = '', ratio = 9 / 16 } = {}) => {
  const url = (width, format) => `http://localhost:8090/media/${key}-${width}.${format}`
  const srcset = (format) => widths.map((width) => `${url(width, format)} ${width}w`).join(', ')
  const largest = widths.at(-1)
  return {
    alt,
    width: largest,
    height: Math.round(largest * ratio),
    sources: [
      { type: 'image/avif', srcset: srcset('avif') },
      { type: 'image/webp', srcset: srcset('webp') },
    ],
    src: url(widths[0], 'webp'),
  }
}
