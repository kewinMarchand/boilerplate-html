import { ApiContractError, field } from '/js/shared/api.js'

export const toSlide = (dto) => ({
  id: String(field(dto, 'id', 'number')),
  slug: field(dto, 'slug', 'string'),
  title: field(dto, 'title', 'string'),
  text: field(dto, 'text', 'string'),
  image: field(dto, 'image', 'number'),
})

export const toSlides = (dto) => {
  if (!Array.isArray(dto)) throw new ApiContractError('slides')
  return dto.map(toSlide)
}
