const normalize = (text) => text.toLocaleLowerCase('fr')

export const filterTasks = (tasks, query) =>
  tasks.filter((task) => normalize(task.title).includes(normalize(query.trim())))

export const splitOnMatch = (text, query) => {
  const needle = query.trim()
  const start = needle ? normalize(text).indexOf(normalize(needle)) : -1
  if (start === -1) return [{ text, match: false }]

  const end = start + needle.length
  return [
    { text: text.slice(0, start), match: false },
    { text: text.slice(start, end), match: true },
    { text: text.slice(end), match: false },
  ].filter((segment) => segment.text)
}
