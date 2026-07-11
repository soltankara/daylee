import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { buildCommands, type Command } from '../lib/commands'
import { fuzzyScore } from '../lib/fuzzy'
import { downloadJsonExport } from '../lib/download'

const MAX_RESULTS = 8

export function CommandPalette({ addRef }: { addRef: React.RefObject<HTMLInputElement> }) {
  const tasks = useStore((s) => s.tasks)
  const selId = useStore((s) => s.selId)
  const closePalette = useStore((s) => s.closePalette)
  const addTask = useStore((s) => s.addTask)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreRef.current = (document.activeElement as HTMLElement) ?? null
    inputRef.current?.focus()
    return () => restoreRef.current?.focus?.()
  }, [])

  const commands = useMemo(() => {
    const s = useStore.getState()
    return buildCommands({
      selTask: tasks.find((t) => t.id === selId) ?? null,
      setStatus: s.setStatus,
      setPriority: s.setPriority,
      toggleWeek: (id) => s.toggleWeek(id),
      deleteTask: s.deleteTask,
      setView: s.setView,
      setFilterStatus: s.setFilterStatus,
      clearFilters: s.clearFilters,
      exportJson: () => downloadJsonExport(s.tasks),
      archiveDone: s.archiveDone,
      focusAdd: () => requestAnimationFrame(() => addRef.current?.focus())
    })
  }, [tasks, selId, addRef])

  const results = useMemo(() => {
    const q = query.trim()
    const scored = commands
      .map((c) => ({ c, score: fuzzyScore(q, c.title) }))
      .filter((r): r is { c: Command; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.c)
    if (q) {
      scored.push({
        id: 'create',
        title: `Create task: ${q}`,
        hint: 'enter',
        run: () => addTask(q)
      })
    }
    return scored
  }, [commands, query, addTask])

  const activeIdx = Math.min(active, Math.max(0, results.length - 1))

  const runCommand = (c: Command) => {
    closePalette()
    c.run()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(Math.min(activeIdx + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max(activeIdx - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const c = results[activeIdx]
      if (c) runCommand(c)
    }
  }

  return (
    <div className="palette-overlay" onClick={closePalette}>
      <div
        className="palette"
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          placeholder="Type a command or a new task…"
          aria-label="Command palette input"
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        <div className="palette-list" role="listbox" aria-label="Commands">
          {results.map((c, i) => (
            <div
              key={c.id}
              role="option"
              aria-selected={i === activeIdx}
              className={'palette-item' + (i === activeIdx ? ' active' : '')}
              onMouseEnter={() => setActive(i)}
              onClick={() => runCommand(c)}
            >
              <span className="palette-item-title">{c.title}</span>
              {c.hint && <span className="palette-item-hint">{c.hint}</span>}
            </div>
          ))}
          {results.length === 0 && <div className="palette-empty">No matching commands</div>}
        </div>
      </div>
    </div>
  )
}
