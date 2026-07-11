import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import {
  compareTasks,
  deriveCategories,
  groupTasks,
  isDueToday,
  isOverdue,
  isStale,
  isTodayView
} from './sort'
import { tasksToCsv } from './csv'

const TODAY = '2026-07-08'
const NOW = new Date('2026-07-08T12:00:00')

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

describe('derived states', () => {
  it('overdue: due before today and not done', () => {
    expect(isOverdue(mk({ dueDate: '2026-07-07' }), TODAY)).toBe(true)
    expect(isOverdue(mk({ dueDate: '2026-07-08' }), TODAY)).toBe(false)
    expect(isOverdue(mk({ dueDate: '2026-07-07', status: 'done' }), TODAY)).toBe(false)
    expect(isOverdue(mk(), TODAY)).toBe(false)
  })

  it('due today: due date equals today and not done', () => {
    expect(isDueToday(mk({ dueDate: TODAY }), TODAY)).toBe(true)
    expect(isDueToday(mk({ dueDate: TODAY, status: 'done' }), TODAY)).toBe(false)
  })

  it('stale: todo, no due date, created 14+ days ago', () => {
    expect(isStale(mk({ createdAt: '2026-06-20T10:00:00.000Z' }), NOW)).toBe(true)
    expect(isStale(mk({ createdAt: '2026-07-01T10:00:00.000Z' }), NOW)).toBe(false)
    expect(
      isStale(mk({ createdAt: '2026-06-20T10:00:00.000Z', dueDate: TODAY }), NOW)
    ).toBe(false)
    expect(
      isStale(mk({ createdAt: '2026-06-20T10:00:00.000Z', status: 'doing' }), NOW)
    ).toBe(false)
  })

  it('today view: due today or overdue, plus anything doing', () => {
    expect(isTodayView(mk({ dueDate: TODAY }), TODAY)).toBe(true)
    expect(isTodayView(mk({ dueDate: '2026-07-01' }), TODAY)).toBe(true)
    expect(isTodayView(mk({ status: 'doing' }), TODAY)).toBe(true)
    expect(isTodayView(mk({ dueDate: '2026-07-20' }), TODAY)).toBe(false)
    expect(isTodayView(mk(), TODAY)).toBe(false)
    expect(isTodayView(mk({ dueDate: TODAY, status: 'done' }), TODAY)).toBe(false)
  })
})

describe('compareTasks default ordering', () => {
  it('orders: high priority, then overdue, then due asc, then newest', () => {
    const high = mk({ priority: 'high' })
    const overdue = mk({ dueDate: '2026-07-05' })
    const dueSoon = mk({ dueDate: '2026-07-09' })
    const dueLater = mk({ dueDate: '2026-07-20' })
    const older = mk({ createdAt: '2026-06-28T10:00:00.000Z' })
    const newer = mk({ createdAt: '2026-07-02T10:00:00.000Z' })

    const sorted = [older, dueLater, newer, dueSoon, overdue, high].sort((a, b) =>
      compareTasks(a, b, TODAY)
    )
    expect(sorted.map((t) => t.id)).toEqual(
      [high, overdue, dueSoon, dueLater, newer, older].map((t) => t.id)
    )
  })

  it('sorts tasks without due date after dated ones', () => {
    const dated = mk({ dueDate: '2026-07-30' })
    const undated = mk()
    expect(compareTasks(undated, dated, TODAY)).toBeGreaterThan(0)
  })

  it('a high-priority task outranks an overdue normal one', () => {
    const high = mk({ priority: 'high' })
    const overdue = mk({ dueDate: '2026-07-01' })
    expect(compareTasks(high, overdue, TODAY)).toBeLessThan(0)
  })

  it('ranks all five priority levels: urgent > high > medium > low > none', () => {
    const none = mk({ priority: 'none' })
    const low = mk({ priority: 'low' })
    const medium = mk({ priority: 'medium' })
    const high = mk({ priority: 'high' })
    const urgent = mk({ priority: 'urgent' })
    const sorted = [none, medium, urgent, low, high].sort((a, b) =>
      compareTasks(a, b, TODAY)
    )
    expect(sorted.map((t) => t.id)).toEqual(
      [urgent, high, medium, low, none].map((t) => t.id)
    )
  })
})

describe('backlog & canceled', () => {
  it('backlog is excluded from the Today view even when overdue', () => {
    expect(isTodayView(mk({ status: 'backlog', dueDate: '2026-07-01' }), TODAY)).toBe(false)
  })

  it('backlog is never stale', () => {
    expect(isStale(mk({ status: 'backlog', createdAt: '2026-06-01T10:00:00.000Z' }), NOW)).toBe(
      false
    )
  })

  it('canceled is never overdue, due today, or in the Today view', () => {
    const t = mk({ status: 'canceled', dueDate: '2026-07-01' })
    expect(isOverdue(t, TODAY)).toBe(false)
    expect(isDueToday(mk({ status: 'canceled', dueDate: TODAY }), TODAY)).toBe(false)
    expect(isTodayView(t, TODAY)).toBe(false)
  })

  it('groupTasks emits a backlog group and excludes canceled entirely', () => {
    const tasks = [
      mk({ status: 'backlog' }),
      mk({ status: 'todo' }),
      mk({ status: 'canceled', completedAt: '2026-07-08T09:00:00.000Z' })
    ]
    const g = groupTasks(tasks, { status: 'all', category: null, search: '' }, TODAY)
    expect(g.backlog).toHaveLength(1)
    expect(g.todo).toHaveLength(1)
    expect(g.done).toHaveLength(0)
  })
})

describe('groupTasks', () => {
  it('splits by status, excludes archived, applies filters', () => {
    const tasks = [
      mk({ status: 'doing' }),
      mk({ status: 'todo' }),
      mk({ status: 'done', completedAt: '2026-07-08T09:00:00.000Z' }),
      mk({ status: 'done', archived: true, completedAt: '2026-07-01T09:00:00.000Z' })
    ]
    const g = groupTasks(tasks, { status: 'all', category: null, search: '' }, TODAY)
    expect(g.doing).toHaveLength(1)
    expect(g.todo).toHaveLength(1)
    expect(g.done).toHaveLength(1)
  })

  it('combines status AND category AND search', () => {
    const tasks = [
      mk({ title: 'Buy milk', category: 'errands' }),
      mk({ title: 'Buy stamps', category: 'home' }),
      mk({ title: 'Sell bike', category: 'errands' })
    ]
    const g = groupTasks(
      tasks,
      { status: 'todo', category: 'errands', search: 'buy' },
      TODAY
    )
    expect(g.todo.map((t) => t.title)).toEqual(['Buy milk'])
  })

  it('searches notes as well as titles', () => {
    const tasks = [mk({ title: 'Call Sam', note: 'about the invoice' })]
    const g = groupTasks(tasks, { status: 'all', category: null, search: 'invoice' }, TODAY)
    expect(g.todo).toHaveLength(1)
  })

  it('sorts done by completedAt descending', () => {
    const a = mk({ status: 'done', completedAt: '2026-07-07T10:00:00.000Z' })
    const b = mk({ status: 'done', completedAt: '2026-07-08T10:00:00.000Z' })
    const g = groupTasks([a, b], { status: 'all', category: null, search: '' }, TODAY)
    expect(g.done.map((t) => t.id)).toEqual([b.id, a.id])
  })
})

describe('deriveCategories', () => {
  it('returns distinct sorted categories from non-archived tasks', () => {
    const tasks = [
      mk({ category: 'work' }),
      mk({ category: 'home' }),
      mk({ category: 'home' }),
      mk({ category: 'zzz', archived: true }),
      mk()
    ]
    expect(deriveCategories(tasks)).toEqual(['home', 'work'])
  })
})

describe('tasksToCsv', () => {
  it('escapes commas, quotes and newlines', () => {
    const t = mk({ title: 'Say "hi", then\nleave', note: 'a,b' })
    const csv = tasksToCsv([t])
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'id,title,note,status,priority,category,dueDate,plannedWeek,createdAt,updatedAt,completedAt,archived'
    )
    expect(csv).toContain('"Say ""hi"", then\nleave"')
    expect(csv).toContain('"a,b"')
  })
})
