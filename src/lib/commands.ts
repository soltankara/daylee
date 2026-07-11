import type { Priority, Status, StatusFilter, Task, View } from '../types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../types'
import { weekStartISO } from './week'

export interface Command {
  id: string
  title: string
  /** small mono hint shown right-aligned (shortcut or context) */
  hint?: string
  run(): void
}

export interface CommandContext {
  selTask: Task | null
  setStatus(id: string, status: Status): void
  setPriority(id: string, priority: Priority): void
  toggleWeek(id: string): void
  deleteTask(id: string): void
  setView(view: View): void
  setFilterStatus(f: StatusFilter): void
  clearFilters(): void
  exportJson(): void
  archiveDone(): void
  focusAdd(): void
}

const VIEWS: Array<[View, string, string?]> = [
  ['list', 'Go to list', ''],
  ['board', 'Go to board', 'b'],
  ['week', 'Go to this week', 'w'],
  ['log', 'Go to done log', ''],
  ['settings', 'Go to export & data', '']
]

const FILTERS: Array<[StatusFilter, string, string?]> = [
  ['today', 'Filter: Today', 't'],
  ['all', 'Filter: All', '0'],
  ['todo', 'Filter: To do', '1'],
  ['doing', 'Filter: Doing', '2'],
  ['backlog', 'Filter: Backlog', '4'],
  ['done', 'Filter: Done', '3']
]

const STATUSES: Status[] = ['backlog', 'todo', 'doing', 'done', 'canceled']
const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']

/**
 * The palette's command list, built fresh per open. Task-scoped commands
 * appear only when a task is selected — context-awareness by construction.
 */
export function buildCommands(ctx: CommandContext): Command[] {
  const cmds: Command[] = []
  const t = ctx.selTask

  if (t) {
    const short = t.title.length > 28 ? t.title.slice(0, 28) + '…' : t.title
    for (const s of STATUSES) {
      if (s === t.status) continue
      cmds.push({
        id: 'status-' + s,
        title: `Mark as ${STATUS_LABELS[s].toLowerCase()}`,
        hint: short,
        run: () => ctx.setStatus(t.id, s)
      })
    }
    for (const p of PRIORITIES) {
      if (p === t.priority) continue
      cmds.push({
        id: 'priority-' + p,
        title: `Set priority: ${PRIORITY_LABELS[p].toLowerCase()}`,
        hint: short,
        run: () => ctx.setPriority(t.id, p)
      })
    }
    const planned = t.plannedWeek === weekStartISO()
    cmds.push({
      id: 'week-toggle',
      title: planned ? 'Remove from this week' : 'Add to this week',
      hint: short,
      run: () => ctx.toggleWeek(t.id)
    })
    cmds.push({
      id: 'delete-task',
      title: 'Delete task',
      hint: short,
      run: () => ctx.deleteTask(t.id)
    })
  }

  cmds.push({ id: 'add', title: 'Add a task', hint: 'n', run: () => ctx.focusAdd() })
  for (const [v, title, hint] of VIEWS) {
    cmds.push({ id: 'view-' + v, title, hint, run: () => ctx.setView(v) })
  }
  for (const [f, title, hint] of FILTERS) {
    cmds.push({
      id: 'filter-' + f,
      title,
      hint,
      run: () => {
        ctx.setView('list')
        ctx.setFilterStatus(f)
      }
    })
  }
  cmds.push({ id: 'clear-filters', title: 'Clear filters', run: () => ctx.clearFilters() })
  cmds.push({ id: 'export-json', title: 'Export JSON backup', run: () => ctx.exportJson() })
  cmds.push({ id: 'archive-done', title: 'Archive all done tasks', run: () => ctx.archiveDone() })

  return cmds
}
