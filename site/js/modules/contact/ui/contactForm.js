import { validateField } from '../domain/contactSchema.js'
import { ContactRejectedError } from '../infrastructure/http/contactTranslation.js'
import { sendContactMessage } from '../infrastructure/http/sendContactMessage.js'

const form = document.querySelector('[data-contact-form]')
const status = form.querySelector('[data-contact-status]')
const submit = form.querySelector('[type="submit"]')
// Le champ caché `product` (demande de renseignement) n'a pas de règle de saisie
const fields = [...form.querySelectorAll('input:not([type="hidden"]), textarea')]
let isSending = false

const showFieldError = (field, message) => {
  document.getElementById(field.getAttribute('aria-describedby')).textContent = message ?? ''
  if (message) {
    field.setAttribute('aria-invalid', 'true')
  } else {
    field.removeAttribute('aria-invalid')
  }
}

const check = (field) => {
  const message = validateField(field.name, field.value)
  showFieldError(field, message)
  return !message
}

const showRejection = (fieldErrors) => {
  const rejected = fieldErrors.map(({ field: name, message }) => {
    const field = form.elements.namedItem(name)
    showFieldError(field, message)
    return field
  })
  rejected[0].focus()
}

const showStatus = (templateId) => {
  status.replaceChildren(document.getElementById(templateId).content.cloneNode(true))
}

form.noValidate = true

for (const field of fields) {
  field.addEventListener('blur', () => {
    if (field.value !== '' || field.hasAttribute('aria-invalid')) check(field)
  })
  field.addEventListener('input', () => {
    if (field.hasAttribute('aria-invalid')) check(field)
  })
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (isSending) return

  status.replaceChildren()
  const invalidFields = fields.filter((field) => !check(field))
  if (invalidFields.length) {
    invalidFields[0].focus()
    return
  }

  isSending = true
  submit.setAttribute('aria-disabled', 'true')
  try {
    await sendContactMessage(Object.fromEntries(new FormData(form)))
    form.reset()
    showStatus('contact-success-template')
  } catch (error) {
    if (error instanceof ContactRejectedError) {
      showRejection(error.fieldErrors)
    } else {
      showStatus('contact-error-template')
    }
  } finally {
    isSending = false
    submit.removeAttribute('aria-disabled')
  }
})
