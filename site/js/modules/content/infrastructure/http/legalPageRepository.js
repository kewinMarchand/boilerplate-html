import { apiGet } from '/js/shared/api.js'

import { toLegalPage } from './legalPageTranslation.js'

export const findLegalPage = async (slug) =>
  toLegalPage(await apiGet(`/api/legal_pages/${encodeURIComponent(slug)}`))
