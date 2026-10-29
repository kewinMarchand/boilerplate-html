import { getStorage, isMesureRefusee } from './oppositionMesure.js'

const config = document.querySelector('script[data-matomo-url]').dataset
const base = config.matomoUrl.endsWith('/') ? config.matomoUrl : `${config.matomoUrl}/`

/**
 * Mesure d'audience Matomo sans cookie, donc sans bandeau. Ce script n'est inclus dans la page que
 * si Matomo est configuré. `disableCookies` passe avant toute autre commande, puis une page vue
 * par chargement : le site n'a pas de navigation côté client. Un refus du visiteur, lu avant la
 * première commande, n'envoie rien : ni file, ni script, ni requête (section 16 de la spec).
 */
if (!isMesureRefusee(getStorage())) {
  const paq = (window._paq = window._paq || [])
  paq.push(['disableCookies'])
  paq.push(['setTrackerUrl', `${base}matomo.php`])
  paq.push(['setSiteId', config.matomoSiteId])
  paq.push(['trackPageView'])

  const tracker = document.createElement('script')
  tracker.src = `${base}matomo.js`
  tracker.async = true
  document.head.append(tracker)
}
