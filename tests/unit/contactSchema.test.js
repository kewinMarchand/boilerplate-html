import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isFieldValid } from '../../site/js/modules/contact/domain/contactSchema.js'

describe('validation du formulaire de contact', () => {
  it('accepte un message complet', () => {
    assert.equal(isFieldValid('name', 'Ada'), true)
    assert.equal(isFieldValid('email', 'ada@exemple.fr'), true)
    assert.equal(isFieldValid('message', 'Bonjour, ceci est un message.'), true)
  })

  it('refuse un nom, une adresse ou un message invalides', () => {
    assert.equal(isFieldValid('name', ' A '), false)
    assert.equal(isFieldValid('email', 'ada'), false)
    assert.equal(isFieldValid('email', 'ada@exemple'), false)
    assert.equal(isFieldValid('message', 'Court'), false)
  })
})
