import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { todayISO } from '../lib/dates'
import { fmtWeekLabel, groupWeekTasks, weekStartISO } from '../lib/week'
import { TaskGroup } from './TaskGroup'

export function WeekView() {
  const tasks = useStore((s) => s.tasks)
  const setView = useStore((s) => s.setView)

  const today = todayISO()
  const week = weekStartISO()

  const groups = useMemo(() => groupWeekTasks(tasks, week, today), [tasks, week, today])

  const pct = groups.total ? Math.round((groups.done.length / groups.total) * 100) : 0

  return (
    <div>
      <a
        href="#list"
        className="back-link"
        onClick={(e) => {
          e.preventDefault()
          setView('list')
        }}
      >
        ← back
      </a>
      <h1 className="page-title">This week</h1>
      <div className="page-subtitle">{fmtWeekLabel(week)}</div>

      {groups.total > 0 && (
        <div className="week-progress" aria-label="Week progress">
          <div className="week-progress-count">
            {groups.done.length} / {groups.total} done
          </div>
          <div className="week-progress-track">
            <div className="week-progress-fill" style={{ width: pct + '%' }} />
          </div>
        </div>
      )}

      <TaskGroup label="Doing" kind="doing" tasks={groups.doing} today={today} />
      <TaskGroup label="To do" kind="todo" tasks={groups.todo} today={today} />
      <TaskGroup label="Backlog" kind="backlog" tasks={groups.backlog} today={today} />
      <TaskGroup label="Done" kind="done" tasks={groups.done} today={today} />

      {groups.total === 0 && (
        <p className="log-empty">
          Nothing planned yet. Select a task and use ⌘K → “Add to this week”, or the week
          toggle in a task's details.
        </p>
      )}
    </div>
  )
}
