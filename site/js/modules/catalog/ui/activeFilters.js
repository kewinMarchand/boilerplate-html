import { formatLabel } from '/js/shared/labels.js'

import { exposureLabel, sizeLabel } from './labels.js'

const attributeValueLabel = (attributeFacets, code, value) =>
  attributeFacets.find((facet) => facet.code === code)?.values.find((item) => item.value === value)
    ?.label ?? value

/**
 * Puces des filtres actifs, libellées par les `data-label-*` de la page (`labels`) ; valeurs d'attribut
 * lues dans les facettes de l'API, valeur inconnue : son code.
 */
export const activeFilters = (query, labels, attributeFacets = []) => [
  ...query.exposures.map((value) => ({
    label: exposureLabel(labels, value),
    remove: (q) => ({ exposures: q.exposures.filter((item) => item !== value) }),
  })),
  ...query.sizes.map((value) => ({
    label: sizeLabel(labels, value),
    remove: (q) => ({ sizes: q.sizes.filter((item) => item !== value) }),
  })),
  ...Object.entries(query.attributes).flatMap(([code, values]) =>
    values.map((value) => ({
      label: attributeValueLabel(attributeFacets, code, value),
      remove: (q) => ({
        attributes: {
          ...q.attributes,
          [code]: q.attributes[code].filter((item) => item !== value),
        },
      }),
    })),
  ),
  ...(query.priceMin === null
    ? []
    : [
        {
          label: formatLabel(labels.labelPriceMin, { price: query.priceMin }),
          remove: () => ({ priceMin: null }),
        },
      ]),
  ...(query.priceMax === null
    ? []
    : [
        {
          label: formatLabel(labels.labelPriceMax, { price: query.priceMax }),
          remove: () => ({ priceMax: null }),
        },
      ]),
  ...(query.inStock ? [{ label: labels.labelInStock, remove: () => ({ inStock: false }) }] : []),
]
