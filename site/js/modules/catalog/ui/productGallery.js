import { formatLabel } from '/js/shared/labels.js'
import { fillPicture } from '/js/shared/picture.js'

const STEPS = { ArrowLeft: -1, ArrowRight: 1 }

const thumbItem = (template, label, image, index, count) => {
  const item = template.content.firstElementChild.cloneNode(true)
  item.querySelector('[data-product-gallery-thumb-image]').src = image.src
  item.querySelector('[data-product-gallery-thumb-label]').textContent = formatLabel(label, {
    number: index + 1,
    count,
  })
  return item
}

/**
 * Galerie de la fiche (section 24 de la spec commune) : image principale, puis une vignette par image
 * (principale comprise) qui la remplace au clic, flèches gauche et droite entre les vignettes. Les liens
 * du pré-rendu, qui servent sans JavaScript, deviennent des boutons. Sans galerie, la rangée est retirée.
 */
export const renderProductGallery = (gallery, product) => {
  const list = gallery.querySelector('[data-product-gallery-thumbs]')
  const picture = gallery.querySelector('picture')
  if (!list) return
  if (!product.gallery.length || !picture) {
    list.remove()
    gallery.removeAttribute('data-testid')
    return
  }
  const images = [product.image, ...product.gallery].filter(Boolean)
  const template = document.getElementById('product-gallery-thumb-template')
  list.replaceChildren(
    ...images.map((image, index) =>
      thumbItem(
        template,
        gallery.closest('[data-product-page]').dataset.labelThumb,
        image,
        index,
        images.length,
      ),
    ),
  )
  const thumbs = [...list.querySelectorAll('button')]
  const mark = (index) =>
    thumbs.forEach((thumb, position) =>
      thumb.setAttribute('aria-current', String(position === index)),
    )
  const show = (index) => {
    fillPicture(picture, images[index])
    mark(index)
  }
  thumbs.forEach((thumb, index) => thumb.addEventListener('click', () => show(index)))
  list.addEventListener('keydown', (event) => {
    const current = thumbs.indexOf(document.activeElement)
    if (current === -1 || !(event.key in STEPS)) return
    event.preventDefault()
    const next = (current + STEPS[event.key] + thumbs.length) % thumbs.length
    thumbs[next].focus()
    show(next)
  })
  mark(0)
  gallery.dataset.testid = 'product-gallery'
}
