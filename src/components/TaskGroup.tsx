import type { Task } from '../types'
import { TaskRow } from './TaskRow'

interface Props {
  label: string
  kind: 'doing' | 'todo' | 'backlog' | 'done'
  tasks: Task[]
  today: string
  /** total before collapsing (Done group shows the full count even when clipped) */
  totalCount?: number
  moreLabel?: string
  onShowAll?: () => void
}

export function TaskGroup({ label, kind, tasks, today, totalCount, moreLabel, onShowAll }: Props) {
  if (!tasks.length) return null
  return (
    <section className="group" aria-label={label}>
      <div className="group-header">
        <span className={`group-label-${kind}`}>{label}</span>
        <span className="group-count">{totalCount ?? tasks.length}</span>
      </div>
      <div className="group-list">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} />
        ))}
      </div>
      {moreLabel && (
        <button className="show-all" onClick={onShowAll}>
          {moreLabel}
        </button>
      )}
    </section>
  )
}
