import { useEffect, useRef } from 'react'
import type { Priority, Status, Task } from '../types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../types'
import { useStore } from '../store/useStore'
import { fmtDayLabel, fmtTime, isoDate } from '../lib/dates'
import { weekStartISO } from '../lib/week'
import { PriorityIcon } from './PriorityIcon'

const STATUSES: Status[] = ['backlog', 'todo', 'doing', 'done', 'canceled']
const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

/**
 * Linear-style peek panel: task details slide in over the list so context
 * stays visible. On small screens it becomes a bottom sheet.
 */
export function SidePeek({ task }: { task: Task }) {
  const updateTask = useStore((s) => s.updateTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const setStatus = useStore((s) => s.setStatus)
  const setPriority = useStore((s) => s.setPriority)
  const toggleWeek = useStore((s) => s.toggleWeek)
  const toggleExpanded = useStore((s) => s.toggleExpanded)

  const panelRef = useRef<HTMLDivElement>(null)
  const openedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (openedForRef.current !== task.id) {
      openedForRef.current = task.id
      panelRef.current?.querySelector<HTMLElement>('.peek-note')?.focus({ preventScroll: true })
    }
  }, [task.id])

  // clicking anywhere outside the panel closes it; clicking a card fires after
  // this (pointerdown vs click), so it reopens the peek for that task
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        toggleExpanded(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [toggleExpanded])

  const thisWeek = task.plannedWeek === weekStartISO()
  const closedLabel = task.status === 'canceled' ? 'canceled' : 'completed'

  return (
    <div className="side-peek" role="dialog" aria-label="Task details" ref={panelRef}>
      <div className="peek-header">
        <span className="peek-title">{task.title}</span>
        <button
          className="task-action visible"
          aria-label="Close details"
          title="Close"
          onClick={() => toggleExpanded(null)}
        >
          ×
        </button>
      </div>

      <textarea
        className="details-note peek-note"
        value={task.note}
        onChange={(e) => updateTask(task.id, { note: e.target.value })}
        placeholder="Add a note…"
        rows={3}
        aria-label="Task note"
      />

      <div className="peek-field">
        <span className="peek-label">status</span>
        <select
          className="peek-select"
          value={task.status}
          aria-label="Task status"
          onChange={(e) => setStatus(task.id, e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="peek-field">
        <span className="peek-label">priority</span>
        <div className="peek-priorities" role="group" aria-label="Task priority">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              className={'peek-pri' + (task.priority === p ? ' active' : '')}
              aria-pressed={task.priority === p}
              aria-label={PRIORITY_LABELS[p]}
              title={PRIORITY_LABELS[p]}
              onClick={() => setPriority(task.id, p)}
            >
              {p === 'none' ? <span className="peek-pri-none">—</span> : <PriorityIcon p={p} />}
            </button>
          ))}
        </div>
      </div>

      <div className="peek-field">
        <span className="peek-label">category</span>
        <input
          className="details-cat"
          value={task.category ?? ''}
          onChange={(e) =>
            updateTask(task.id, {
              category: e.target.value.replace(/^#/, '').trim() || null
            })
          }
          placeholder="none"
          aria-label="Task category"
        />
      </div>

      <div className="peek-field">
        <span className="peek-label">due</span>
        <input
          className="details-due"
          type="date"
          value={task.dueDate ?? ''}
          aria-label="Due date"
          onChange={(e) => updateTask(task.id, { dueDate: e.target.value || null })}
        />
      </div>

      <div className="peek-field">
        <span className="peek-label">week</span>
        <button
          className={'peek-week' + (thisWeek ? ' active' : '')}
          aria-pressed={thisWeek}
          onClick={() => toggleWeek(task.id)}
        >
          {thisWeek ? 'planned this week ✓' : 'add to this week'}
        </button>
      </div>

      <div className="peek-meta">
        created {fmtDayLabel(isoDate(new Date(task.createdAt)))}
        {task.completedAt && (
          <>
            {' · '}
            {closedLabel} {fmtDayLabel(isoDate(new Date(task.completedAt)))} at{' '}
            {fmtTime(task.completedAt)}
          </>
        )}
      </div>

      <div className="details-footer">
        <button className="details-delete" onClick={() => deleteTask(task.id)}>
          delete task
        </button>
        <span className="details-spacer" />
        <button className="details-close" onClick={() => toggleExpanded(null)}>
          close
        </button>
      </div>
    </div>
  )
}
