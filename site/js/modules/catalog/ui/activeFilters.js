import { EXPOSURE_LABELS, SIZE_LABELS } from './labels.js'

const attributeValueLabel = (attributeFacets, code, value) =>
  attributeFacets.find((facet) => facet.code === code)?.values.find((item) => item.value === value)
    ?.label ?? value

/** Libellés des valeurs d'attribut lus dans les facettes de l'API ; valeur inconnue : son code. */
export const activeFilters = (query, attributeFacets = []) => [
  ...query.exposures.map((value) => ({
    label: EXPOSURE_LABELS[value],
    remove: (q) => ({ exposures: q.exposures.filter((item) => item !== value) }),
  })),
  ...query.sizes.map((value) => ({
    label: SIZE_LABELS[value],
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
    : [{ label: `Prix minimum : ${query.priceMin} €`, remove: () => ({ priceMin: null }) }]),
  ...(query.priceMax === null
    ? []
    : [{ label: `Prix maximum : ${query.priceMax} €`, remove: () => ({ priceMax: null }) }]),
  ...(query.inStock ? [{ label: 'En stock', remove: () => ({ inStock: false }) }] : []),
]
