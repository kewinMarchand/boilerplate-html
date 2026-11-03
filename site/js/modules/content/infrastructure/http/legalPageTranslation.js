import { field } from '/js/shared/api.js'

export const toLegalPage = (dto) => ({
  slug: field(dto, 'slug', 'string'),
  title: field(dto, 'title', 'string'),
  introduction: field(dto, 'introduction', 'string'),
  sections: field(dto, 'sections', 'array').map((section) => ({
    title: field(section, 'title', 'string'),
    html: field(section, 'html', 'string'),
  })),
})
