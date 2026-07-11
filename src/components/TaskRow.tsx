import { useEffect, useRef, useState } from 'react'
import type { Task } from '../types'
import { useStore } from '../store/useStore'
import { fmtDue } from '../lib/dates'
import { isDueToday, isOverdue, isStale } from '../lib/sort'
import { nextStatus } from '../lib/task'
import { PriorityIcon } from './PriorityIcon'

export function TaskRow({ task, today }: { task: Task; today: string }) {
  const selId = useStore((s) => s.selId)
  const editingId = useStore((s) => s.editingId)
  const expandedId = useStore((s) => s.expandedId)
  const popId = useStore((s) => s.popId)
  const cycleStatus = useStore((s) => s.cycleStatus)
  const updateTask = useStore((s) => s.updateTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const setSelId = useStore((s) => s.setSelId)
  const setEditingId = useStore((s) => s.setEditingId)
  const toggleExpanded = useStore((s) => s.toggleExpanded)

  const selected = selId === task.id
  const editing = editingId === task.id
  const expanded = expandedId === task.id
  const isDone = task.status === 'done'
  const overdue = isOverdue(task, today)
  const dueToday = isDueToday(task, today)
  const stale = isStale(task)

  const [editVal, setEditVal] = useState(task.title)
  const editRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)
  useEffect(() => {
    if (editing) {
      cancelledRef.current = false
      setEditVal(task.title)
      editRef.current?.focus()
      editRef.current?.select()
    }
    // re-seed the draft only when editing starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const commitEdit = () => {
    const v = editVal.trim()
    if (v && v !== task.title) updateTask(task.id, { title: v })
    setEditingId(null)
  }

  const ringClass =
    'status-ring ' +
    task.status +
    (stale ? ' stale' : '') +
    (popId === task.id ? ' pop' : '')

  const statusAria = `${task.status} — click to mark ${
    nextStatus(task.status) === 'todo' ? 'to do' : nextStatus(task.status)
  }`

  return (
    <div>
      <div
        className={'task-row' + (selected ? ' selected' : '')}
        onClick={(e) => {
          // clicks on inline controls (title edit input, etc.) are not card clicks
          if ((e.target as HTMLElement).closest('input, button, select, textarea')) return
          setSelId(task.id)
          toggleExpanded(task.id)
        }}
      >
        <button
          className="status-btn"
          aria-label={statusAria}
          title={statusAria}
          onClick={(e) => {
            e.stopPropagation()
            cycleStatus(task.id)
          }}
        >
          <span className={ringClass}>
            {task.status === 'doing' && <span className="status-dot" />}
            {isDone && <span className="status-check" />}
            {task.status === 'canceled' && <span className="status-x">×</span>}
          </span>
        </button>

        {editing ? (
          <input
            ref={editRef}
            className="title-edit"
            value={editVal}
            aria-label="Edit task title"
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') {
                // stop the global handler's blur from committing via onBlur
                e.preventDefault()
                cancelledRef.current = true
                setEditingId(null)
              }
            }}
            onBlur={() => {
              if (!cancelledRef.current) commitEdit()
            }}
          />
        ) : (
          <div
            className={
              'task-title' +
              ((task.priority === 'high' || task.priority === 'urgent') && !isDone
                ? ' high'
                : '') +
              (isDone ? ' done' : '')
            }
            onClick={(e) => {
              e.stopPropagation()
              setSelId(task.id)
              setEditingId(task.id)
            }}
          >
            {task.title}
          </div>
        )}

        {!isDone && <PriorityIcon p={task.priority} />}

        {task.category && <span className="task-tag">#{task.category}</span>}
        {task.dueDate && !isDone && (
          <span
            className={'task-due' + (overdue ? ' overdue' : dueToday ? ' due-today' : '')}
          >
            {fmtDue(task.dueDate)}
          </span>
        )}

        <button
          className={'task-action' + (expanded ? ' visible' : '')}
          aria-label="Edit details"
          title="Edit details"
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(task.id)
          }}
        >
          ⋯
        </button>
        <button
          className="task-action"
          aria-label="Delete task"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            deleteTask(task.id)
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
