import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { SORT_GAP, ensureSortIndexes, placeInColumn, renormalize, sortIndexBetween } from './order'

const TODAY = '2026-07-08'

let seq = 0
function mk(o: Partial<Task> = {}): Task {
  seq++
  return {
    id: 't' + seq,
    title: 'Task ' + seq,
    note: '',
    status: 'todo',
    priority: 'none',
    category: null,
    dueDate: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    completedAt: null,
    sortIndex: 0,
    recurrence: null,
    archived: false,
    plannedWeek: null,
    ...o
  }
}

describe('sortIndexBetween', () => {
  it('handles empty, first, last and middle placements', () => {
    expect(sortIndexBetween(null, null)).toBe(SORT_GAP)
    expect(sortIndexBetween(null, 1024)).toBe(0)
    expect(sortIndexBetween(2048, null)).toBe(2048 + SORT_GAP)
    expect(sortIndexBetween(1024, 2048)).toBe(1536)
  })
})

describe('renormalize', () => {
  it('re-spaces at SORT_GAP intervals and returns only changed tasks', () => {
    const a = mk({ sortIndex: SORT_GAP })
    const b = mk({ sortIndex: SORT_GAP + 1e-9 })
    const changed = renormalize([a, b])
    expect(changed.map((t) => t.id)).toEqual([b.id])
    expect(changed[0].sortIndex).toBe(2 * SORT_GAP)
  })
})

describe('ensureSortIndexes', () => {
  it('assigns smart-sort order to pre-v1.1 data (all zeros), per status group', () => {
    const urgent = mk({ priority: 'urgent' })
    const plain = mk()
    const doing = mk({ status: 'doing' })
    const changed = ensureSortIndexes([plain, urgent, doing], TODAY)
    const byId = new Map(changed.map((t) => [t.id, t.sortIndex]))
    // urgent sorts before plain within the todo group
    expect(byId.get(urgent.id)).toBeLessThan(byId.get(plain.id) as number)
    // a single-task group with sortIndex 0 is already distinct — untouched
    expect(byId.has(doing.id)).toBe(false)
  })

  it('is idempotent', () => {
    const tasks = [mk(), mk(), mk()]
    const first = ensureSortIndexes(tasks, TODAY)
    expect(first.length).toBeGreaterThan(0)
    const after = tasks.map((t) => first.find((c) => c.id === t.id) ?? t)
    expect(ensureSortIndexes(after, TODAY)).toEqual([])
  })
})

describe('placeInColumn', () => {
  it('drops between neighbors using the midpoint', () => {
    const a = mk({ sortIndex: 1024 })
    const b = mk({ sortIndex: 2048 })
    const { sortIndex, renormalized } = placeInColumn([a, b], 1, TODAY)
    expect(sortIndex).toBe(1536)
    expect(renormalized).toEqual([])
  })

  it('renormalizes when the gap is exhausted', () => {
    const a = mk({ sortIndex: 1 })
    const b = mk({ sortIndex: 1 + 1e-9 })
    const { sortIndex, renormalized } = placeInColumn([a, b], 1, TODAY)
    expect(renormalized.length).toBeGreaterThan(0)
    expect(sortIndex).toBeGreaterThan(SORT_GAP)
    expect(sortIndex).toBeLessThan(2 * SORT_GAP)
  })
})
