import { countLabel } from '/js/shared/labels.js'

const EXPOSURE_LABELS = {
  soleil: 'labelExposureSun',
  'mi-ombre': 'labelExposurePartialShade',
  ombre: 'labelExposureShade',
}
const SIZE_LABELS = { S: 'labelSizeS', M: 'labelSizeM', L: 'labelSizeL' }

/**
 * Libellés d'affichage du catalogue, lus dans les `data-label-*` de la page (`labels` : son `dataset`,
 * ou celui que le pré-rendu lit dans le HTML).
 */
export const exposureLabel = (labels, exposure) => labels[EXPOSURE_LABELS[exposure]]

export const sizeLabel = (labels, size) => labels[SIZE_LABELS[size]]

export const formatResultsCount = (total, labels, locale) =>
  countLabel(total, { one: labels.labelResultsOne, other: labels.labelResultsOther }, locale)
