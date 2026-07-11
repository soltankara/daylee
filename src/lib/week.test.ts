import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { fmtWeekLabel, rolloverWeek, weekStartISO } from './week'

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

describe('weekStartISO', () => {
  it('returns the Monday of the current week', () => {
    // 2026-07-08 is a Wednesday
    expect(weekStartISO(new Date('2026-07-08T12:00:00'))).toBe('2026-07-06')
    // Monday maps to itself
    expect(weekStartISO(new Date('2026-07-06T00:30:00'))).toBe('2026-07-06')
    // Sunday belongs to the week that started six days earlier
    expect(weekStartISO(new Date('2026-07-12T23:00:00'))).toBe('2026-07-06')
  })

  it('handles year boundaries', () => {
    // 2027-01-01 is a Friday; its week starts Monday 2026-12-28
    expect(weekStartISO(new Date('2027-01-01T12:00:00'))).toBe('2026-12-28')
  })
})

describe('fmtWeekLabel', () => {
  it('formats a same-month week', () => {
    expect(fmtWeekLabel('2026-07-06')).toBe('Jul 6 – 12')
  })

  it('formats a month-crossing week', () => {
    expect(fmtWeekLabel('2026-06-29')).toBe('Jun 29 – Jul 5')
  })
})

describe('rolloverWeek', () => {
  const NOW = new Date('2026-07-08T12:00:00') // week of 2026-07-06

  it('moves open tasks planned for a past week into the current week', () => {
    const stale = mk({ plannedWeek: '2026-06-29' })
    const changed = rolloverWeek([stale], NOW)
    expect(changed).toHaveLength(1)
    expect(changed[0].plannedWeek).toBe('2026-07-06')
  })

  it('leaves done, canceled, current-week and unplanned tasks alone', () => {
    const done = mk({ plannedWeek: '2026-06-29', status: 'done' })
    const canceled = mk({ plannedWeek: '2026-06-29', status: 'canceled' })
    const current = mk({ plannedWeek: '2026-07-06' })
    const unplanned = mk()
    expect(rolloverWeek([done, canceled, current, unplanned], NOW)).toEqual([])
  })

  it('is idempotent', () => {
    const stale = mk({ plannedWeek: '2026-06-22' })
    const [rolled] = rolloverWeek([stale], NOW)
    expect(rolloverWeek([rolled], NOW)).toEqual([])
  })
})
