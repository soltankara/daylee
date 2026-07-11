import type { Task } from '../types'
import { addDays, isoDate } from './dates'
import { compareDone, compareTasks } from './sort'

/** Monday of the given date's week, as a local ISO date. */
export function weekStartISO(now: Date = new Date()): string {
  const diff = (now.getDay() + 6) % 7 // Mon=0 … Sun=6
  return isoDate(addDays(now, -diff))
}

/** "Jul 6 – 12" (or "Jun 29 – Jul 5" across a month boundary). */
export function fmtWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = addDays(start, 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel =
    start.getMonth() === end.getMonth() ? String(end.getDate()) : fmt(end)
  return `${fmt(start)} – ${endLabel}`
}

export interface WeekGroups {
  doing: Task[]
  todo: Task[]
  backlog: Task[]
  done: Task[]
  total: number
}

/** Tasks committed to the given week, split and sorted like the main list. */
export function groupWeekTasks(tasks: Task[], week: string, today: string): WeekGroups {
  const planned = tasks.filter(
    (t) => t.plannedWeek === week && !t.archived && t.status !== 'canceled'
  )
  const cmp = (a: Task, b: Task) => compareTasks(a, b, today)
  return {
    doing: planned.filter((t) => t.status === 'doing').sort(cmp),
    todo: planned.filter((t) => t.status === 'todo').sort(cmp),
    backlog: planned.filter((t) => t.status === 'backlog').sort(cmp),
    done: planned.filter((t) => t.status === 'done').sort(compareDone),
    total: planned.length
  }
}

/**
 * Roll unfinished commitments forward: open tasks planned for a past week move
 * to the current week; done/canceled keep their historical week. Idempotent —
 * returns only the tasks that changed.
 */
export function rolloverWeek(tasks: Task[], now: Date = new Date()): Task[] {
  const current = weekStartISO(now)
  const ts = now.toISOString()
  return tasks
    .filter(
      (t) =>
        t.plannedWeek !== null &&
        t.plannedWeek < current &&
        t.status !== 'done' &&
        t.status !== 'canceled'
    )
    .map((t) => ({ ...t, plannedWeek: current, updatedAt: ts }))
}
