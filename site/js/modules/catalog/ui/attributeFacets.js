const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

export const attributeInputId = (code, value) => `filter-attribute-${code}-${value}`

const checkbox = (code, { value, label, count }, checked) => {
  const id = attributeInputId(code, value)
  return `<div class="bui-checkbox"><input class="bui-checkbox__input" type="checkbox" id="${id}" name="attr-${code}" value="${value}" data-facet="attributes" data-attribute="${code}" data-testid="catalog-filter-attribute-${code}-${value}"${checked ? ' checked' : ''}${count === 0 && !checked ? ' disabled' : ''} /><label class="bui-checkbox__label" for="${id}">${escapeHtml(label)} <span class="facet-count" data-count="attribute-${code}-${value}">(${count})</span></label></div>`
}

/**
 * Groupes de cases des attributs filtrables, au balisage de la facette Exposition : écrits par le
 * pré-rendu et par le navigateur. Codes et valeurs sont validés par la traduction de l'API.
 */
export const attributeFacetsHtml = (facets, query) =>
  facets
    .map(
      ({ code, label, values }) =>
        `<details class="facet" open><summary>${escapeHtml(label)}</summary><fieldset><legend class="visually-hidden">${escapeHtml(label)}</legend>${values
          .map((value) => checkbox(code, value, query.attributes[code]?.includes(value.value)))
          .join('')}</fieldset></details>`,
    )
    .join('')
