import { describe, expect, it } from 'vitest'
import { nextStatus, normalizePriority, normalizeTask } from './task'

describe('nextStatus', () => {
  it('cycles the happy path and promotes/reopens parked states to todo', () => {
    expect(nextStatus('todo')).toBe('doing')
    expect(nextStatus('doing')).toBe('done')
    expect(nextStatus('done')).toBe('todo')
    expect(nextStatus('backlog')).toBe('todo')
    expect(nextStatus('canceled')).toBe('todo')
  })
})

describe('normalizePriority', () => {
  it('maps the v1 value "normal" and unknowns to none, passes new values through', () => {
    expect(normalizePriority('normal')).toBe('none')
    expect(normalizePriority(undefined)).toBe('none')
    expect(normalizePriority('critical')).toBe('none')
    expect(normalizePriority('low')).toBe('low')
    expect(normalizePriority('urgent')).toBe('urgent')
  })
})

describe('normalizeTask (v1 export compatibility)', () => {
  it('imports a v1-format record, migrating priority and defaulting plannedWeek', () => {
    const t = normalizeTask({
      id: 'v1-task',
      title: 'From an old backup',
      status: 'doing',
      priority: 'normal',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(t).toMatchObject({
      id: 'v1-task',
      status: 'doing',
      priority: 'none',
      plannedWeek: null
    })
  })

  it('accepts the new statuses and validates plannedWeek', () => {
    expect(normalizeTask({ id: 'a', title: 'x', status: 'backlog' })?.status).toBe('backlog')
    expect(normalizeTask({ id: 'b', title: 'x', status: 'canceled' })?.status).toBe('canceled')
    expect(normalizeTask({ id: 'c', title: 'x', status: 'weird' })?.status).toBe('todo')
    expect(
      normalizeTask({ id: 'd', title: 'x', plannedWeek: '2026-07-06' })?.plannedWeek
    ).toBe('2026-07-06')
    expect(normalizeTask({ id: 'e', title: 'x', plannedWeek: 'next week' })?.plannedWeek).toBe(
      null
    )
  })
})
