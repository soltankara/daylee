import type { Task, StatusFilter } from '../types'
import { PRIORITY_RANK } from '../types'

const STALE_MS = 14 * 864e5

const CLOSED = new Set(['done', 'canceled'])

export function isOverdue(t: Task, today: string): boolean {
  return !CLOSED.has(t.status) && !!t.dueDate && t.dueDate < today
}

export function isDueToday(t: Task, today: string): boolean {
  return !CLOSED.has(t.status) && t.dueDate === today
}

/** To-do with no due date, sitting untouched for 14+ days — visual hint only. */
export function isStale(t: Task, now: Date = new Date()): boolean {
  return (
    t.status === 'todo' && !t.dueDate && now.getTime() - Date.parse(t.createdAt) > STALE_MS
  )
}

/**
 * In the "Today" smart view: due today or overdue, plus everything in doing.
 * Backlog is deliberately "not now", so it never shows up here.
 */
export function isTodayView(t: Task, today: string): boolean {
  return (
    !CLOSED.has(t.status) &&
    t.status !== 'backlog' &&
    ((!!t.dueDate && t.dueDate <= today) || t.status === 'doing')
  )
}

/**
 * Default in-group order: priority (urgent → none) → overdue → due date
 * ascending (no due date last) → newest first.
 */
export function compareTasks(a: Task, b: Task, today: string): number {
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  const oa = a.dueDate && a.dueDate < today ? 0 : 1
  const ob = b.dueDate && b.dueDate < today ? 0 : 1
  if (oa !== ob) return oa - ob
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  }
  return a.createdAt > b.createdAt ? -1 : 1
}

export function compareDone(a: Task, b: Task): number {
  return (b.completedAt ?? '') < (a.completedAt ?? '') ? -1 : 1
}

/** Board-column order: manual sortIndex first, smart order as the tiebreak. */
export function orderForBoard(tasks: Task[], today: string): Task[] {
  return [...tasks].sort((a, b) => a.sortIndex - b.sortIndex || compareTasks(a, b, today))
}

export interface FilterState {
  status: StatusFilter
  category: string | null
  search: string
}

export function matchesFilters(t: Task, f: FilterState, today: string): boolean {
  const q = f.search.trim().toLowerCase()
  if (q && !(t.title + ' ' + t.note).toLowerCase().includes(q)) return false
  if (f.category && t.category !== f.category) return false
  if (f.status === 'all') return true
  if (f.status === 'today') return isTodayView(t, today)
  return t.status === f.status
}

export interface TaskGroups {
  doing: Task[]
  todo: Task[]
  backlog: Task[]
  done: Task[]
}

/**
 * Filter out archived and canceled, apply filters, split by status, sort each
 * group. Canceled tasks live only in the Done log.
 */
export function groupTasks(tasks: Task[], f: FilterState, today: string): TaskGroups {
  const visible = tasks.filter(
    (t) => !t.archived && t.status !== 'canceled' && matchesFilters(t, f, today)
  )
  const cmp = (a: Task, b: Task) => compareTasks(a, b, today)
  return {
    doing: visible.filter((t) => t.status === 'doing').sort(cmp),
    todo: visible.filter((t) => t.status === 'todo').sort(cmp),
    backlog: visible.filter((t) => t.status === 'backlog').sort(cmp),
    done: visible.filter((t) => t.status === 'done').sort(compareDone)
  }
}

export function deriveCategories(tasks: Task[]): string[] {
  return Array.from(
    new Set(tasks.filter((t) => !t.archived && t.category).map((t) => t.category as string))
  ).sort()
}
