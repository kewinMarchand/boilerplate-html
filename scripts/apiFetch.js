const API_TIMEOUT_MS = 10_000

/**
 * Lecture de l'API à la génération du site. `params` devient la chaîne de requête (une liste répète le
 * paramètre). API_SCENARIO fixe l'en-tête `X-Scenario` de chaque appel : `bilingual` sert le scénario
 * bilingue de l'API aux tests (section 29 bis de la spec commune).
 */
export const fetchJson = async (apiUrl, path, params = {}) => {
  const url = new URL(path, apiUrl)
  for (const [name, value] of Object.entries(params)) {
    for (const item of [value].flat()) {
      if (item !== undefined && item !== null) url.searchParams.append(name, String(item))
    }
  }
  const scenario = process.env.API_SCENARIO
  const response = await fetch(url, {
    headers: { accept: 'application/json', ...(scenario && { 'x-scenario': scenario }) },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`réponse ${response.status}`)
  return response.json()
}
