import { formatLabel } from './labels.js'

const header = document.querySelector('[data-site-header]')
const toggle = header.querySelector('[data-category-menu-toggle]')
const panel = header.querySelector('[data-category-panel]')
const menuItem = header.querySelector('[data-category-menu]')
const mobileToggle = header.querySelector('[data-mobile-menu-toggle]')
const mobileMenu = header.querySelector('[data-mobile-menu]')

const linkOf = (item) => item.querySelector(':scope > a')

const setBranchOpen = (item, open) => {
  item.toggleAttribute('data-open', open)
  linkOf(item).setAttribute('aria-expanded', String(open))
  if (!open) item.querySelectorAll('li[data-open]').forEach((child) => setBranchOpen(child, false))
}

const fitPanel = () => {
  panel.style.removeProperty('translate')
  const overflow = panel.getBoundingClientRect().right - document.documentElement.clientWidth
  if (overflow > 0) panel.style.translate = `${-Math.ceil(overflow)}px 0`
}

const openBranch = (item) => {
  for (const sibling of item.parentElement.children) {
    if (sibling !== item && sibling.hasAttribute('data-open')) setBranchOpen(sibling, false)
  }
  if (item.hasAttribute('data-has-children') && !item.hasAttribute('data-open')) {
    setBranchOpen(item, true)
  }
  fitPanel()
}

const closePanel = ({ restoreFocus = false } = {}) => {
  if (panel.hidden) return
  panel.hidden = true
  toggle.setAttribute('aria-expanded', 'false')
  panel.querySelectorAll('li[data-open]').forEach((item) => setBranchOpen(item, false))
  if (restoreFocus) toggle.focus()
}

const openPanel = () => {
  panel.hidden = false
  toggle.setAttribute('aria-expanded', 'true')
  fitPanel()
}

const onPanelPointer = (event) => {
  const item = event.target.closest('[data-category-panel] li')
  if (item) openBranch(item)
}

const moveFocus = (event) => {
  const item = event.target.closest('[data-category-panel] li')
  if (!item) return
  const siblings = [...item.parentElement.children]
  const index = siblings.indexOf(item)
  const targets = {
    ArrowDown: () => siblings[index + 1] && linkOf(siblings[index + 1]),
    ArrowUp: () => siblings[index - 1] && linkOf(siblings[index - 1]),
    ArrowRight: () => {
      if (!item.hasAttribute('data-has-children')) return undefined
      setBranchOpen(item, true)
      fitPanel()
      return item.querySelector(':scope > ul > li > a')
    },
    ArrowLeft: () => item.parentElement.closest('li') && linkOf(item.parentElement.closest('li')),
  }
  const target = targets[event.key]?.()
  if (target) {
    event.preventDefault()
    target.focus()
  }
}

if (menuItem) {
  toggle.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()))
  panel.addEventListener('mouseover', onPanelPointer)
  panel.addEventListener('focusin', onPanelPointer)
  panel.addEventListener('keydown', moveFocus)
  menuItem.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel({ restoreFocus: true })
  })
  menuItem.addEventListener('focusout', (event) => {
    if (!menuItem.contains(event.relatedTarget)) closePanel()
  })
  document.addEventListener('click', (event) => {
    if (!menuItem.contains(event.target)) closePanel()
  })
}

const readTree = (list) =>
  [...list.children].map((item) => ({
    label: linkOf(item).textContent.trim(),
    href: linkOf(item).getAttribute('href'),
    children: item.querySelector(':scope > ul') ? readTree(item.querySelector(':scope > ul')) : [],
  }))

// Libellés du menu mobile, dans la langue de la page (`data-label-*` de la modale)
const labels = mobileMenu.dataset

const ROOT_LEVEL = {
  label: mobileMenu.getAttribute('aria-label'),
  children: [...header.querySelectorAll('.main-nav-list > li')].map((item) => ({
    label: linkOf(item).textContent.trim(),
    href: linkOf(item).getAttribute('href'),
    children: item === menuItem ? readTree(panel.querySelector('.category-columns > ul')) : [],
  })),
}

let levels = [ROOT_LEVEL]

const SVG_NS = 'http://www.w3.org/2000/svg'

const iconNode = (name) => {
  const svg = document.createElementNS(SVG_NS, 'svg')
  const use = document.createElementNS(SVG_NS, 'use')
  use.setAttribute('href', `/icons.svg#${name}`)
  svg.setAttribute('class', 'bui-icon bui-icon--md')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '20')
  svg.setAttribute('height', '20')
  svg.append(use)
  return svg
}

const element = (tag, properties = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), properties)
  node.append(...children)
  return node
}

const renderLevel = () => {
  const level = levels.at(-1)
  const parent = levels.at(-2)
  const title = element('h2', {
    className: 'mobile-menu-level-title',
    id: 'mobile-menu-title',
    tabIndex: -1,
    textContent: level.label,
  })
  const close = element('button', { type: 'button', className: 'bui-modal__close' }, [
    iconNode('x'),
  ])
  close.setAttribute('aria-label', labels.labelMenuClose)
  close.addEventListener('click', () => mobileMenu.close())

  const body = element('div', { className: 'bui-modal__body' })
  if (parent) {
    const back = element('button', { type: 'button', className: 'mobile-menu-back' }, [
      iconNode('chevron-left'),
      formatLabel(labels.labelMenuBack, { name: parent.label }),
    ])
    back.dataset.testid = 'layout-mobile-menu-back'
    back.addEventListener('click', () => {
      levels = levels.slice(0, -1)
      renderLevel()
    })
    body.append(back)
  }
  body.append(title)

  const list = element('ul', { className: 'mobile-menu-list' })
  if (level.href) {
    list.append(
      element('li', {}, [element('a', { href: level.href, textContent: labels.labelMenuAll })]),
    )
  }
  for (const child of level.children) {
    if (child.children.length) {
      const button = element('button', { type: 'button' }, [child.label, iconNode('chevron-right')])
      button.dataset.testid = `layout-mobile-menu-level-${child.href.split('/').at(-1)}`
      button.addEventListener('click', () => {
        levels = [...levels, child]
        renderLevel()
      })
      list.append(element('li', {}, [button]))
    } else {
      const link = element('a', { href: child.href, textContent: child.label })
      if (child.href === location.pathname) link.setAttribute('aria-current', 'page')
      list.append(element('li', {}, [link]))
    }
  }
  body.append(list)

  mobileMenu.setAttribute('aria-labelledby', 'mobile-menu-title')
  mobileMenu.replaceChildren(element('div', { className: 'bui-modal__header' }, [close]), body)
  title.focus()
}

mobileToggle.addEventListener('click', () => {
  levels = [ROOT_LEVEL]
  mobileMenu.showModal()
  mobileToggle.setAttribute('aria-expanded', 'true')
  renderLevel()
})
mobileMenu.addEventListener('close', () => {
  mobileToggle.setAttribute('aria-expanded', 'false')
  levels = [ROOT_LEVEL]
  mobileToggle.focus()
})
matchMedia('(width >= 1024px)').addEventListener('change', (event) => {
  if (event.matches && mobileMenu.open) mobileMenu.close()
  if (!event.matches && menuItem) closePanel()
})
