import { useEffect, useRef, type RefObject } from 'react'
import { useStore } from '../store/useStore'
import type { StatusFilter } from '../types'

const FILTER_KEYS: Record<string, StatusFilter> = {
  '1': 'todo',
  '2': 'doing',
  '3': 'done',
  '4': 'backlog',
  '0': 'all',
  t: 'today'
}

/**
 * Global desktop shortcuts (spec §4.7). Inputs swallow everything except
 * Escape, which blurs the field.
 */
export function useKeyboard(
  flatIds: string[],
  addRef: RefObject<HTMLInputElement>,
  searchRef: RefObject<HTMLInputElement>
) {
  // keep latest ids without re-binding the listener every render
  const idsRef = useRef(flatIds)
  idsRef.current = flatIds

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K opens the palette from anywhere, including inside fields
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const st = useStore.getState()
        if (st.paletteOpen) st.closePalette()
        else st.openPalette()
        return
      }
      if (useStore.getState().paletteOpen) return // the palette handles its own keys
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      const tag = (target.tagName || '').toUpperCase()
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
      if (inField) {
        if (e.key === 'Escape') target.blur()
        return
      }

      const s = useStore.getState()
      const k = e.key

      if (k === 'n' || k === 'a') {
        e.preventDefault()
        if (s.view !== 'board') s.setView('list')
        requestAnimationFrame(() => addRef.current?.focus())
        return
      }
      if (k === '/') {
        e.preventDefault()
        if (s.view !== 'board') s.setView('list')
        requestAnimationFrame(() => searchRef.current?.focus())
        return
      }
      if (s.view === 'log' || s.view === 'settings') {
        if (k === 'Escape') s.setView('list')
        return
      }
      if (k === 'b') {
        e.preventDefault()
        s.setView(s.view === 'board' ? 'list' : 'board')
        return
      }
      if (k === 'w') {
        e.preventDefault()
        s.setView(s.view === 'week' ? 'list' : 'week')
        return
      }

      const flat = idsRef.current
      const move = (dir: 1 | -1) => {
        if (!flat.length) return
        const i = flat.indexOf(s.selId ?? '')
        const ni =
          i < 0 ? (dir > 0 ? 0 : flat.length - 1) : Math.max(0, Math.min(flat.length - 1, i + dir))
        s.setSelId(flat[ni])
      }

      if (k === 'j' || k === 'ArrowDown') {
        e.preventDefault()
        move(1)
        return
      }
      if (k === 'k' || k === 'ArrowUp') {
        e.preventDefault()
        move(-1)
        return
      }
      if (k === ' ') {
        e.preventDefault()
        const id = s.selId ?? flat[0]
        if (id) s.cycleStatus(id)
        return
      }
      if (k === 'e') {
        e.preventDefault()
        const id = s.selId ?? flat[0]
        if (id) s.toggleExpanded(id)
        return
      }
      if (k === 'x' || k === 'Delete' || k === 'Backspace') {
        e.preventDefault()
        if (s.selId) s.deleteTask(s.selId)
        return
      }
      if (k === 'Escape') {
        // layered: close the peek first, clear the selection on the next press
        if (s.expandedId) s.toggleExpanded(null)
        else s.setSelId(null)
        return
      }
      const f = FILTER_KEYS[k]
      if (f) s.setFilterStatus(f)
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [addRef, searchRef])
}
