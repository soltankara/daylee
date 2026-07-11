import { useEffect, useRef, type MouseEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Status, Task } from '../types'
import { useStore } from '../store/useStore'
import { fmtDue } from '../lib/dates'
import { isDueToday, isOverdue } from '../lib/sort'
import { PriorityIcon } from './PriorityIcon'

export function BoardColumn({
  status,
  label,
  tasks,
  total,
  today
}: {
  status: Status
  label: string
  tasks: Task[]
  total: number
  today: string
}) {
  const { setNodeRef } = useDroppable({ id: 'col:' + status })

  return (
    <section className="board-col" aria-label={label}>
      <div className="group-header board-col-header">
        <span className={`group-label-${status}`}>{label}</span>
        <span className="group-count">{total}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="board-col-body" ref={setNodeRef}>
          {tasks.map((t) => (
            <BoardCard key={t.id} task={t} today={today} />
          ))}
          {total > tasks.length && (
            <div className="board-col-more">+{total - tasks.length} more in the done log</div>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

export function BoardCardContent({
  task,
  today,
  onOpen
}: {
  task: Task
  today: string
  onOpen?: (e: MouseEvent) => void
}) {
  const isDone = task.status === 'done'
  const overdue = isOverdue(task, today)
  const dueToday = isDueToday(task, today)

  return (
    <>
      <div className="board-card-top">
        <span
          className={
            'board-card-title' +
            ((task.priority === 'high' || task.priority === 'urgent') && !isDone
              ? ' high'
              : '') +
            (isDone ? ' done' : '')
          }
        >
          {task.title}
        </span>
        <button
          className="task-action visible board-card-open"
          aria-label="Edit details"
          title="Edit details"
          onClick={onOpen}
          tabIndex={onOpen ? undefined : -1}
        >
          ⋯
        </button>
      </div>
      {(task.category || task.dueDate || task.priority !== 'none') && (
        <div className="board-card-meta">
          {!isDone && <PriorityIcon p={task.priority} />}
          {task.category && <span className="task-tag">#{task.category}</span>}
          {task.dueDate && !isDone && (
            <span
              className={'task-due' + (overdue ? ' overdue' : dueToday ? ' due-today' : '')}
            >
              {fmtDue(task.dueDate)}
            </span>
          )}
        </div>
      )}
    </>
  )
}

function BoardCard({ task, today }: { task: Task; today: string }) {
  const selId = useStore((s) => s.selId)
  const setSelId = useStore((s) => s.setSelId)
  const toggleExpanded = useStore((s) => s.toggleExpanded)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  })

  // the click that ends a drag must not open the peek panel
  const draggedRef = useRef(false)
  useEffect(() => {
    if (isDragging) {
      draggedRef.current = true
    } else if (draggedRef.current) {
      const t = setTimeout(() => {
        draggedRef.current = false
      }, 0)
      return () => clearTimeout(t)
    }
  }, [isDragging])

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        'board-card' +
        (selId === task.id ? ' selected' : '') +
        (isDragging ? ' dragging' : '')
      }
      onClick={() => {
        if (draggedRef.current) return
        setSelId(task.id)
        toggleExpanded(task.id)
      }}
      {...attributes}
      {...listeners}
    >
      <BoardCardContent
        task={task}
        today={today}
        onOpen={(e) => {
          e.stopPropagation()
          toggleExpanded(task.id)
        }}
      />
    </div>
  )
}
