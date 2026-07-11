import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Status, Task } from '../types'
import type { TaskGroups } from '../lib/sort'
import { orderForBoard } from '../lib/sort'
import { useStore } from '../store/useStore'
import { BoardColumn, BoardCardContent } from './BoardColumn'

const DONE_CAP = 10

const COLUMNS: Array<{ status: Status; label: string; kind: keyof TaskGroups }> = [
  { status: 'backlog', label: 'Backlog', kind: 'backlog' },
  { status: 'todo', label: 'To do', kind: 'todo' },
  { status: 'doing', label: 'Doing', kind: 'doing' },
  { status: 'done', label: 'Done', kind: 'done' }
]

const DROP_ANIMATION = {
  duration: 180,
  easing: 'cubic-bezier(0.2, 0, 0, 1)'
}

export function Board({ groups, today }: { groups: TaskGroups; today: string }) {
  const moveTask = useStore((s) => s.moveTask)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const columns = useMemo(() => {
    return COLUMNS.map((c) => {
      const ordered = orderForBoard(groups[c.kind], today)
      const capped = c.status === 'done' ? ordered.slice(0, DONE_CAP) : ordered
      return { ...c, tasks: capped, total: ordered.length }
    })
  }, [groups, today])

  const findColumn = (id: string): { status: Status; index: number } | null => {
    if (id.startsWith('col:')) {
      const status = id.slice(4) as Status
      const col = columns.find((c) => c.status === status)
      return col ? { status, index: col.tasks.length } : null
    }
    for (const c of columns) {
      const i = c.tasks.findIndex((t: Task) => t.id === id)
      if (i >= 0) return { status: c.status, index: i }
    }
    return null
  }

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const target = findColumn(String(over.id))
    if (!target || String(active.id) === String(over.id)) return
    moveTask(String(active.id), target.status, target.index)
  }

  const activeTask = activeId
    ? columns.flatMap((c) => c.tasks).find((t) => t.id === activeId)
    : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="board" role="list" aria-label="Board">
        {columns.map((c) => (
          <BoardColumn
            key={c.status}
            status={c.status}
            label={c.label}
            tasks={c.tasks}
            total={c.total}
            today={today}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={DROP_ANIMATION}>
        {activeTask ? (
          <div className="board-card overlay">
            <BoardCardContent task={activeTask} today={today} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
