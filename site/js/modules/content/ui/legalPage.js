import { findLegalPage } from '../infrastructure/http/legalPageRepository.js'
import { LegalPageLoadError } from '../infrastructure/LegalPageLoadError.js'

const page = document.querySelector('[data-legal-page]')
const title = page.querySelector('[data-legal-title]')
const state = page.querySelector('[data-legal-state]')
const content = page.querySelector('[data-legal-content]')
const sectionTemplate = document.getElementById('legal-section-template')
// Absent d'une page pré-rendue dans l'image de production, qui sert déjà son texte
const loading = state.firstElementChild?.cloneNode(true)

/** HTML produit par l'API, qui échappe le HTML saisi dans l'admin : injecté tel quel. */
const fromHtml = (html) => {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

const renderSection = (section) => {
  const element = sectionTemplate.content.firstElementChild.cloneNode(true)
  element.querySelector('[data-legal-section-title]').textContent = section.title
  element.append(fromHtml(section.html))
  return element
}

const renderError = () => {
  state.replaceChildren(document.getElementById('legal-error-template').content.cloneNode(true))
  state.querySelector('[data-legal-error-message]').textContent = new LegalPageLoadError().message
  state.querySelector('[data-legal-retry]').addEventListener('click', loadLegalPage)
}

const loadLegalPage = async () => {
  const prerendered = content.children.length > 0
  if (!prerendered) state.replaceChildren(loading.cloneNode(true))
  let legalPage
  try {
    legalPage = await findLegalPage(page.dataset.legalPage)
  } catch {
    if (!prerendered) renderError()
    return
  }
  title.textContent = legalPage.title
  state.replaceChildren()
  content.replaceChildren(
    fromHtml(legalPage.introduction),
    ...legalPage.sections.map(renderSection),
  )
}

loadLegalPage()
