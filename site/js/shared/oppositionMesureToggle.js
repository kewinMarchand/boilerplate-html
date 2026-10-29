import { getStorage, isMesureRefusee, setOppositionMesure } from './oppositionMesure.js'

const input = document.querySelector('[data-opposition-mesure]')
const status = document.querySelector('[data-opposition-mesure-etat]')
const storage = getStorage()

const render = () => {
  const refusee = isMesureRefusee(storage)
  input.checked = refusee
  status.textContent = refusee
    ? 'Vos visites ne sont plus mesurées depuis ce navigateur.'
    : 'Vos visites sont mesurées, de façon anonyme.'
}

input.addEventListener('change', () => {
  setOppositionMesure(storage, input.checked)
  render()
})
render()
