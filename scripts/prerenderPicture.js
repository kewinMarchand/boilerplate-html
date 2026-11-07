/**
 * Pré-rendu de l'objet `image` de l'API dans le premier `<picture>` d'un gabarit, comme
 * `fillPicture` dans le navigateur. Image absente : le `<picture>` est retiré.
 */
const attribute = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const srcsetOf = (image, type) => image.sources.find((source) => source.type === type)?.srcset ?? ''

export const withPicture = (html, image) => {
  if (!image) return html.replace(/\s*<picture[\s\S]*?<\/picture>/, '')
  return html
    .replace(
      /<source(\s+)type="(image\/[a-z]+)"/g,
      (_, space, type) =>
        `<source${space}type="${type}" srcset="${attribute(srcsetOf(image, type))}"`,
    )
    .replace(/src="[^"]*"/, `src="${attribute(image.src)}"`)
    .replace(/alt="[^"]*"/, `alt="${attribute(image.alt)}"`)
    .replace(/width="\d+"/, `width="${image.width}"`)
    .replace(/height="\d+"/, `height="${image.height}"`)
}

/** Plus grande variante WebP, pour les données structurées. */
export const largestWebp = (image) =>
  srcsetOf(image, 'image/webp').split(', ').at(-1)?.split(' ')[0] || image.src
