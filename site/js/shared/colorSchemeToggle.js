import { isEnhanced } from './a11yMode.js'
import { applyColorScheme, colorSchemeLabel, currentColorScheme } from './colorScheme.js'

import './menus.js'

const ICONS = { auto: 'monitor', light: 'sun', dark: 'moon' }

const getStorage = () => {
  try {
    return localStorage
  } catch {
    return undefined
  }
}

const root = document.documentElement
const menu = document.querySelector('[data-color-scheme-toggle]')
const trigger = menu.querySelector('.bui-menu__trigger')
const icon = trigger.querySelector('use')
const storage = getStorage()

const render = () => {
  const scheme = currentColorScheme(root)
  trigger.setAttribute('aria-label', colorSchemeLabel(scheme, isEnhanced(root), menu.dataset))
  icon.setAttribute('href', `/icons.svg#${ICONS[scheme]}`)
  for (const item of menu.querySelectorAll('[data-bui-menu-item]')) {
    item.setAttribute('aria-checked', String(item.dataset.buiMenuItem === scheme))
  }
}

menu.addEventListener('bui-menu-select', (event) =>
  applyColorScheme({ root, storage }, event.detail),
)
new MutationObserver(render).observe(root, {
  attributeFilter: ['data-a11y-mode', 'data-color-scheme'],
})
render()
