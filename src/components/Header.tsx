import { useStore } from '../store/useStore'
import { fmtHeading, isoDate, todayISO } from '../lib/dates'

export function Header() {
  const tasks = useStore((s) => s.tasks)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const today = todayISO()
  const open = tasks.filter(
    (t) => !t.archived && t.status !== 'done' && t.status !== 'canceled'
  ).length
  const doneToday = tasks.filter(
    (t) =>
      t.status === 'done' && t.completedAt && isoDate(new Date(t.completedAt)) === today
  ).length

  return (
    <header className="header">
      <div>
        <div className="wordmark">Daylee</div>
        <h1 className="header-date">{fmtHeading()}</h1>
      </div>
      <div className="header-right">
        <div className="view-toggle" role="group" aria-label="View">
          <button
            className={'view-toggle-btn' + (view === 'list' ? ' active' : '')}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            list
          </button>
          <button
            className={'view-toggle-btn' + (view === 'board' ? ' active' : '')}
            aria-pressed={view === 'board'}
            onClick={() => setView('board')}
          >
            board
          </button>
        </div>
        <div className="header-count">
          {open} open · {doneToday} done today
        </div>
      </div>
    </header>
  )
}
