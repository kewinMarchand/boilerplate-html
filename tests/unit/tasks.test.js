import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { filterTasks, splitOnMatch } from '../../site/js/modules/task/domain/tasks.js'

const TASKS = [
  { id: '1', title: 'Brancher la vraie API', done: false },
  { id: '2', title: 'Lancer make qa', done: true },
]

describe('tâches', () => {
  it('filtre sans tenir compte de la casse', () => {
    assert.deepEqual(
      filterTasks(TASKS, 'api').map((task) => task.id),
      ['1'],
    )
    assert.equal(filterTasks(TASKS, '  ').length, 2)
  })

  it('découpe le titre autour de la correspondance', () => {
    assert.deepEqual(splitOnMatch('Brancher la vraie API', 'api'), [
      { text: 'Brancher la vraie ', match: false },
      { text: 'API', match: true },
    ])
    assert.deepEqual(splitOnMatch('Lancer', 'zz'), [{ text: 'Lancer', match: false }])
  })
})
