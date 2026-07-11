import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { fmtDayLabel, fmtTime, isoDate } from '../lib/dates'
import type { Task } from '../types'

export function DoneLog() {
  const tasks = useStore((s) => s.tasks)
  const setView = useStore((s) => s.setView)
  const reopenTask = useStore((s) => s.reopenTask)

  const days = useMemo(() => {
    const closed = tasks
      .filter(
        (t): t is Task & { completedAt: string } =>
          (t.status === 'done' || t.status === 'canceled') && !!t.completedAt
      )
      .sort((a, b) => (a.completedAt > b.completedAt ? -1 : 1))
    const map = new Map<string, typeof closed>()
    for (const t of closed) {
      const day = isoDate(new Date(t.completedAt))
      const list = map.get(day)
      if (list) list.push(t)
      else map.set(day, [t])
    }
    const done = closed.filter((t) => t.status === 'done').length
    return { done, canceled: closed.length - done, entries: Array.from(map.entries()) }
  }, [tasks])

  const subtitle =
    `${days.done} task${days.done === 1 ? '' : 's'} completed` +
    (days.canceled ? ` · ${days.canceled} canceled` : '')

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
      <h1 className="page-title">Done log</h1>
      <div className="page-subtitle">{subtitle}</div>
      {days.entries.map(([day, items]) => (
        <section className="log-day" key={day}>
          <div className="log-day-header">
            <span>{fmtDayLabel(day)}</span>
            <span className="group-count">{items.length}</span>
          </div>
          <div className="log-list">
            {items.map((t) => (
              <div className="log-row" key={t.id}>
                <span
                  className={'log-check' + (t.status === 'canceled' ? ' canceled' : '')}
                  aria-hidden="true"
                >
                  {t.status === 'canceled' ? '×' : <span />}
                </span>
                <span
                  className={'log-title' + (t.status === 'canceled' ? ' canceled' : '')}
                >
                  {t.title}
                </span>
                {t.category && <span className="log-tag">#{t.category}</span>}
                <span className="log-time">{fmtTime(t.completedAt)}</span>
                <button className="log-reopen" onClick={() => reopenTask(t.id)}>
                  reopen
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {days.done + days.canceled === 0 && (
        <p className="log-empty">Nothing completed yet. It'll show up here, day by day.</p>
      )}
    </div>
  )
}
