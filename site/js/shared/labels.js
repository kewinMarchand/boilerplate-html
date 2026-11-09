/**
 * Libellés de la page (section 29 bis de la spec commune) : chaque script lit les siens dans les
 * attributs `data-label-*` de son élément, écrits dans la langue de la page (la génération de chaque
 * langue les traduit). `{nom}` est remplacé par la valeur donnée.
 */
export const formatLabel = (text, values = {}) =>
  text.replace(/\{(\w+)\}/g, (_, name) => String(values[name]))

/**
 * Forme du nombre dans la langue : `one` (« 1 produit », et « 0 produit » en français) ou `other`,
 * `{count}` et les autres `values` remplacés.
 */
export const countLabel = (count, { one, other }, locale, values = {}) =>
  formatLabel(new Intl.PluralRules(locale).select(count) === 'one' ? one : other, {
    count,
    ...values,
  })
