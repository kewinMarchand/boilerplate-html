import { apiGet } from '/js/shared/api.js'

import { toSlides } from './slideTranslation.js'

export const findSlides = async () => toSlides(await apiGet('/api/slides'))
