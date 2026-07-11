import type { Task } from '../types'

const COLS = [
  'id',
  'title',
  'note',
  'status',
  'priority',
  'category',
  'dueDate',
  'plannedWeek',
  'createdAt',
  'updatedAt',
  'completedAt',
  'archived'
] as const

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function tasksToCsv(tasks: Task[]): string {
  const rows = [COLS.join(',')]
  for (const t of tasks) rows.push(COLS.map((c) => esc(t[c])).join(','))
  return rows.join('\n')
}
