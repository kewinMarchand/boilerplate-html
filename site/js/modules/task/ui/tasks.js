import { countLabel, formatLabel } from '/js/shared/labels.js'
import { pageLocale } from '/js/shared/locale.js'

import { filterTasks, splitOnMatch } from '../domain/tasks.js'
import { findAllTasks } from '../infrastructure/http/tasksRepository.js'
import { TasksLoadError } from '../infrastructure/TasksLoadError.js'

const state = document.querySelector('[data-tasks-state]')
// Libellés des scripts dans la langue de la page
const labels = state.dataset
const locale = pageLocale()

const visibleCount = (visible, total) =>
  countLabel(visible, { one: labels.labelVisibleOne, other: labels.labelVisibleOther }, locale, {
    total,
  })

const doneCount = (done, total) =>
  countLabel(done, { one: labels.labelDoneOne, other: labels.labelDoneOther }, locale, { total })

const render = (templateId) => {
  state.replaceChildren(document.getElementById(templateId).content.cloneNode(true))
}

const fetchTasks = async () => {
  try {
    return await findAllTasks()
  } catch {
    throw new TasksLoadError()
  }
}

const renderTitle = (element, title, query) => {
  element.replaceChildren(
    ...splitOnMatch(title, query).map((segment) => {
      if (!segment.match) return document.createTextNode(segment.text)
      const mark = document.createElement('mark')
      mark.textContent = segment.text
      return mark
    }),
  )
}

const renderItems = (tasks, query) => {
  const visible = filterTasks(tasks, query)
  const itemTemplate = document.getElementById('tasks-item-template')
  const noMatch = state.querySelector('[data-tasks-no-match]')

  state.querySelector('[data-tasks-list]').replaceChildren(
    ...visible.map((task) => {
      const item = itemTemplate.content.firstElementChild.cloneNode(true)
      item.dataset.done = String(task.done)
      renderTitle(item.querySelector('[data-task-title]'), task.title, query)
      item.querySelector('[data-task-status]').textContent = task.done
        ? labels.labelDone
        : labels.labelTodo
      return item
    }),
  )
  state.querySelector('[data-tasks-count]').value = visibleCount(visible.length, tasks.length)
  noMatch.hidden = visible.length > 0
  noMatch.querySelector('[data-tasks-no-match-message]').textContent = formatLabel(
    labels.labelNoMatch,
    { query: query.trim() },
  )
}

const renderList = (tasks) => {
  render('tasks-list-template')
  const done = tasks.filter((task) => task.done).length
  const progress = state.querySelector('[data-tasks-progress]')
  const filter = state.querySelector('[data-tasks-filter]')

  progress.max = tasks.length
  progress.value = done
  progress.textContent = doneCount(done, tasks.length)
  state.querySelector('[data-tasks-progress-text]').textContent = doneCount(done, tasks.length)

  filter.addEventListener('input', () => renderItems(tasks, filter.value))
  renderItems(tasks, '')
}

const renderError = () => {
  render('tasks-error-template')
  state.querySelector('[data-tasks-retry]').addEventListener('click', () => loadTasks(true))
}

const loadTasks = async (isRetry = false) => {
  render('tasks-loading-template')
  try {
    const tasks = await fetchTasks()
    if (tasks.length) {
      renderList(tasks)
    } else {
      render('tasks-empty-template')
    }
  } catch {
    renderError()
  }
  if (isRetry) state.focus()
}

loadTasks()
