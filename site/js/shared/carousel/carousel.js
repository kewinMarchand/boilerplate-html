import EmblaCarousel from '/vendor/embla-carousel.esm.js'

const WHEEL_THRESHOLD = 30
const root = document.documentElement
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

const options = () => ({
  align: 'start',
  duration: reducedMotion.matches || root.dataset.a11yMode === 'enhanced' ? 1 : 25,
})

export const initCarousel = (carousel) => {
  const viewport = carousel.querySelector('[data-carousel-viewport]')
  const prev = carousel.querySelector('[data-carousel-prev]')
  const next = carousel.querySelector('[data-carousel-next]')
  const dots = carousel.querySelector('[data-carousel-dots]')
  const embla = EmblaCarousel(viewport, options())

  const renderDots = () => {
    dots.replaceChildren(
      ...embla.scrollSnapList().map((_, index) => {
        const dot = document.createElement('button')
        dot.type = 'button'
        dot.setAttribute('aria-label', `Aller à la diapositive ${index + 1}`)
        dot.setAttribute('aria-controls', viewport.id)
        dot.dataset.testid = 'carousel-dot'
        dot.addEventListener('click', () => embla.scrollTo(index))
        return dot
      }),
    )
  }

  const update = () => {
    const focused = document.activeElement
    prev.disabled = !embla.canScrollPrev()
    next.disabled = !embla.canScrollNext()
    if (focused === prev && prev.disabled) next.focus()
    if (focused === next && next.disabled) prev.focus()

    const selected = embla.selectedScrollSnap()
    dots.querySelectorAll('button').forEach((dot, index) => {
      dot.setAttribute('aria-current', String(index === selected))
    })
  }

  prev.addEventListener('click', () => embla.scrollPrev())
  next.addEventListener('click', () => embla.scrollNext())
  let isWheelScrolling = false
  viewport.addEventListener(
    'wheel',
    (event) => {
      if (Math.abs(event.deltaX) < Math.max(WHEEL_THRESHOLD, Math.abs(event.deltaY))) return
      event.preventDefault()
      if (isWheelScrolling) return
      const forward = event.deltaX > 0
      if (forward ? !embla.canScrollNext() : !embla.canScrollPrev()) return
      isWheelScrolling = true
      if (forward) embla.scrollNext()
      else embla.scrollPrev()
    },
    { passive: false },
  )
  embla.on('settle', () => {
    isWheelScrolling = false
  })
  embla.on('select', update).on('reInit', renderDots).on('reInit', update)

  const reInit = () => embla.reInit(options())
  reducedMotion.addEventListener('change', reInit)
  new MutationObserver(reInit).observe(root, { attributeFilter: ['data-a11y-mode'] })

  viewport.removeAttribute('tabindex')
  renderDots()
  update()
}
