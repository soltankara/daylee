export type Status = 'backlog' | 'todo' | 'doing' | 'done' | 'canceled'
export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent'

/** Lower rank sorts first. */
export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4
}

export const STATUS_LABELS: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
  canceled: 'Canceled'
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
}

/** Reserved for a later version — no UI yet, but kept in the schema so adding it needs no migration. */
export type Recurrence =
  | { kind: 'daily' }
  | { kind: 'weekdays' }
  | { kind: 'weekly'; days: number[] }
  | { kind: 'monthly'; date: number }

export interface Task {
  id: string
  /** 1–300 chars, plain text */
  title: string
  /** 0–2000 chars */
  note: string
  status: Status
  priority: Priority
  category: string | null
  /** ISO date (YYYY-MM-DD), no time-of-day in v1 */
  dueDate: string | null
  /** ISO timestamps */
  createdAt: string
  updatedAt: string
  /** closed-at: set when the task becomes done OR canceled, cleared on reopen */
  completedAt: string | null
  /** manual ordering within a board column */
  sortIndex: number
  recurrence: Recurrence | null
  /** cleared from the main list but kept in the Done log */
  archived: boolean
  /** Monday (ISO date) of the week this task is committed to, or null */
  plannedWeek: string | null
}

export const TITLE_MAX = 300
export const NOTE_MAX = 2000

export type View = 'list' | 'board' | 'week' | 'log' | 'settings'
export type StatusFilter = 'today' | 'all' | Status
