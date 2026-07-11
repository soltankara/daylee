import type { Priority, Status, Task } from '../types'
import { NOTE_MAX, TITLE_MAX } from '../types'
import type { ParsedQuick } from './parse'

export function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)
  }
}

export function createTask(p: ParsedQuick, now: Date = new Date()): Task {
  const ts = now.toISOString()
  return {
    id: uid(),
    title: p.title.slice(0, TITLE_MAX),
    note: '',
    status: 'todo',
    priority: p.priority,
    category: p.category,
    dueDate: p.dueDate,
    createdAt: ts,
    updatedAt: ts,
    completedAt: null,
    sortIndex: 0,
    recurrence: null,
    archived: false,
    plannedWeek: null
  }
}

/**
 * Space-cycle keeps the v1 happy path; the parked states promote/reopen to
 * "to do" — they are only entered explicitly (palette, side-peek, board drag).
 */
export function nextStatus(s: Status): Status {
  switch (s) {
    case 'backlog':
      return 'todo'
    case 'todo':
      return 'doing'
    case 'doing':
      return 'done'
    case 'done':
      return 'todo'
    case 'canceled':
      return 'todo'
  }
}

const STATUSES: readonly Status[] = ['backlog', 'todo', 'doing', 'done', 'canceled']

/** Maps the v1 value 'normal' (and anything unknown) to 'none'. */
export function normalizePriority(v: unknown): Priority {
  return v === 'low' || v === 'medium' || v === 'high' || v === 'urgent' ? v : 'none'
}

/** Normalize a possibly-partial imported record into a full Task, or null if invalid. */
export function normalizeTask(raw: unknown): Task | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id || typeof r.title !== 'string' || !r.title) return null
  const status: Status = STATUSES.includes(r.status as Status) ? (r.status as Status) : 'todo'
  const ts = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString()
  return {
    id: r.id,
    title: r.title.slice(0, TITLE_MAX),
    note: typeof r.note === 'string' ? r.note.slice(0, NOTE_MAX) : '',
    status,
    priority: normalizePriority(r.priority),
    category: typeof r.category === 'string' && r.category ? r.category : null,
    dueDate: typeof r.dueDate === 'string' && r.dueDate ? r.dueDate : null,
    createdAt: ts,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : ts,
    completedAt: typeof r.completedAt === 'string' ? r.completedAt : null,
    sortIndex: typeof r.sortIndex === 'number' ? r.sortIndex : 0,
    // pass recurrence through untouched so exports round-trip once it grows UI
    recurrence:
      typeof r.recurrence === 'object' && r.recurrence !== null
        ? (r.recurrence as Task['recurrence'])
        : null,
    archived: r.archived === true,
    plannedWeek:
      typeof r.plannedWeek === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.plannedWeek)
        ? r.plannedWeek
        : null
  }
}
