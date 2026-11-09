const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/

const CONTACT_RULES = {
  name: {
    isValid: (value) => value.trim().length >= 2,
  },
  email: {
    isValid: (value) => EMAIL_PATTERN.test(value),
  },
  message: {
    isValid: (value) => value.trim().length >= 10,
  },
}

/** Le message d'un champ refusé est dans la langue de la page : `data-label-invalid` du champ. */
export const isFieldValid = (name, value) => CONTACT_RULES[name].isValid(value)
