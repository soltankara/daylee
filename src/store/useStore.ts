import { create } from 'zustand'
import type { Status, Priority, StatusFilter, Task, View } from '../types'
import { NOTE_MAX, TITLE_MAX } from '../types'
import { parseQuick } from '../lib/parse'
import { createTask, nextStatus, normalizeTask } from '../lib/task'
import { todayISO } from '../lib/dates'
import { isTodayView } from '../lib/sort'
import { ensureSortIndexes, placeInColumn } from '../lib/order'
import { rolloverWeek, weekStartISO } from '../lib/week'
import type { TaskStorage } from '../storage/storage'

export interface Toast {
  msg: string
  onUndo: (() => void) | null
}

interface DaybookState {
  tasks: Task[]
  loaded: boolean
  view: View
  filterStatus: StatusFilter
  filterCat: string | null
  search: string
  selId: string | null
  editingId: string | null
  /** task open in the side-peek details panel */
  expandedId: string | null
  showAllDone: boolean
  toast: Toast | null
  /** id whose status ring should play the pop animation */
  popId: string | null
  paletteOpen: boolean

  init(storage: TaskStorage, now?: Date): Promise<void>
  addTask(raw: string): void
  cycleStatus(id: string): void
  setStatus(id: string, status: Status): void
  setPriority(id: string, priority: Priority): void
  toggleWeek(id: string, now?: Date): void
  moveTask(id: string, status: Status, targetIndex: number): void
  updateTask(id: string, patch: Partial<Task>): void
  deleteTask(id: string): void
  reopenTask(id: string): void
  archiveDone(): void
  importTasks(fileText: string): Promise<number>
  exportTasks(): Task[]
  showToast(msg: string, onUndo?: () => void): void
  dismissToast(): void

  setView(view: View): void
  setFilterStatus(f: StatusFilter): void
  toggleFilterCat(cat: string): void
  setSearch(q: string): void
  clearFilters(): void
  setSelId(id: string | null): void
  setEditingId(id: string | null): void
  toggleExpanded(id: string | null): void
  setShowAllDone(v: boolean): void
  openPalette(): void
  closePalette(): void
}

let storage: TaskStorage | null = null
let toastTimer: ReturnType<typeof setTimeout> | undefined
let popTimer: ReturnType<typeof setTimeout> | undefined

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** One-time import of data written by the design prototype, if present. */
function readLegacyLocalStorage(): Task[] {
  try {
    const raw = localStorage.getItem('daybook.v1')
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const arr = (parsed as { tasks?: unknown }).tasks
    if (!Array.isArray(arr)) return []
    return arr.map(normalizeTask).filter((t): t is Task => t !== null)
  } catch {
    return []
  }
}

export const useStore = create<DaybookState>((set, get) => {
  const persistTask = (task: Task) => {
    storage?.saveTask(task).catch(() => {
      get().showToast("Couldn't save — storage error")
    })
  }

  const persistTasks = (tasks: Task[]) => {
    if (!tasks.length) return
    storage?.saveTasks(tasks).catch(() => {
      get().showToast("Couldn't save — storage error")
    })
  }

  const applyPatch = (id: string, patch: Partial<Task>) => {
    const now = new Date().toISOString()
    let saved: Task | undefined
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t
        saved = { ...t, ...patch, updatedAt: now }
        return saved
      })
    }))
    if (saved) persistTask(saved)
  }

  const popRing = (id: string) => {
    if (prefersReducedMotion()) return
    clearTimeout(popTimer)
    set({ popId: id })
    popTimer = setTimeout(() => set({ popId: null }), 450)
  }

  return {
    tasks: [],
    loaded: false,
    view: 'board',
    filterStatus: 'all',
    filterCat: null,
    search: '',
    selId: null,
    editingId: null,
    expandedId: null,
    showAllDone: false,
    toast: null,
    popId: null,
    paletteOpen: false,

    async init(s: TaskStorage, now: Date = new Date()) {
      storage = s
      let tasks = await s.listTasks()
      if (tasks.length === 0) {
        const legacy = readLegacyLocalStorage()
        if (legacy.length) {
          await s.saveTasks(legacy)
          tasks = legacy
          try {
            localStorage.removeItem('daybook.v1')
          } catch {
            /* ignore */
          }
        }
      }
      const today = todayISO(now)

      // bootstrap manual board order for pre-v1.1 data, then roll the week
      const reindexed = ensureSortIndexes(tasks, today)
      const rolled = rolloverWeek(
        tasks.map((t) => reindexed.find((r) => r.id === t.id) ?? t),
        now
      )
      const changed = new Map([...reindexed, ...rolled].map((t) => [t.id, t]))
      if (changed.size) {
        tasks = tasks.map((t) => changed.get(t.id) ?? t)
        await s.saveTasks(Array.from(changed.values())).catch(() => {
          /* surfaced on the next write */
        })
      }

      const hasToday = tasks.some((t) => !t.archived && isTodayView(t, today))
      set({ tasks, loaded: true, filterStatus: hasToday ? 'today' : 'all' })
      if (rolled.length) {
        get().showToast(
          `Rolled ${rolled.length} task${rolled.length === 1 ? '' : 's'} into this week`
        )
      }
    },

    addTask(raw: string) {
      const p = parseQuick(raw.trim())
      if (!p.title) return
      const t = createTask(p)
      // new tasks go to the top of their board column
      const minIdx = Math.min(0, ...get().tasks.filter((x) => x.status === 'todo').map((x) => x.sortIndex))
      t.sortIndex = minIdx - 1024
      set((s) => ({ tasks: [t, ...s.tasks], selId: t.id }))
      persistTask(t)
    },

    cycleStatus(id: string) {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      get().setStatus(id, nextStatus(t.status))
    },

    setStatus(id: string, status: Status) {
      const t = get().tasks.find((x) => x.id === id)
      if (!t || t.status === status) return
      const closed = status === 'done' || status === 'canceled'
      applyPatch(id, {
        status,
        completedAt: closed ? new Date().toISOString() : null
      })
      popRing(id)
    },

    setPriority(id: string, priority: Priority) {
      applyPatch(id, { priority })
    },

    toggleWeek(id: string, now: Date = new Date()) {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      const wk = weekStartISO(now)
      applyPatch(id, { plannedWeek: t.plannedWeek === wk ? null : wk })
    },

    moveTask(id: string, status: Status, targetIndex: number) {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      const today = todayISO()
      const column = get().tasks.filter(
        (x) => x.id !== id && x.status === status && !x.archived
      )
      const { sortIndex, renormalized } = placeInColumn(column, targetIndex, today)
      const closed = status === 'done' || status === 'canceled'
      const now = new Date().toISOString()
      const moved: Task = {
        ...t,
        status,
        sortIndex,
        completedAt:
          t.status === status ? t.completedAt : closed ? now : null,
        updatedAt: now
      }
      const patched = new Map([[id, moved], ...renormalized.map((r) => [r.id, r] as const)])
      set((s) => ({ tasks: s.tasks.map((x) => patched.get(x.id) ?? x) }))
      persistTasks(Array.from(patched.values()))
      if (t.status !== status) popRing(id)
    },

    updateTask(id: string, patch: Partial<Task>) {
      if (typeof patch.title === 'string') patch.title = patch.title.slice(0, TITLE_MAX)
      if (typeof patch.note === 'string') patch.note = patch.note.slice(0, NOTE_MAX)
      applyPatch(id, patch)
    },

    deleteTask(id: string) {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      set((s) => ({
        tasks: s.tasks.filter((x) => x.id !== id),
        expandedId: s.expandedId === id ? null : s.expandedId,
        editingId: s.editingId === id ? null : s.editingId,
        selId: s.selId === id ? null : s.selId
      }))
      storage?.deleteTask(id).catch(() => {
        get().showToast("Couldn't save — storage error")
      })
      get().showToast(`Deleted “${t.title}”`, () => {
        set((s) => ({ tasks: [t, ...s.tasks], toast: null }))
        persistTask(t)
      })
    },

    reopenTask(id: string) {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      applyPatch(id, { status: 'todo', completedAt: null, archived: false })
      get().showToast(`Reopened “${t.title}”`)
    },

    archiveDone() {
      const toArchive = get().tasks.filter((t) => t.status === 'done' && !t.archived)
      if (!toArchive.length) {
        get().showToast('No done tasks to archive')
        return
      }
      const now = new Date().toISOString()
      const patched = new Map(
        toArchive.map((t) => [t.id, { ...t, archived: true, updatedAt: now }])
      )
      set((s) => ({ tasks: s.tasks.map((t) => patched.get(t.id) ?? t) }))
      storage?.saveTasks(Array.from(patched.values())).catch(() => {
        get().showToast("Couldn't save — storage error")
      })
      get().showToast(`Archived ${toArchive.length} done task${toArchive.length === 1 ? '' : 's'}`)
    },

    async importTasks(fileText: string): Promise<number> {
      const data: unknown = JSON.parse(fileText)
      const arr = Array.isArray(data) ? data : (data as { tasks?: unknown }).tasks
      if (!Array.isArray(arr)) throw new Error('not a Daybook export')
      const incoming = arr.map(normalizeTask).filter((t): t is Task => t !== null)
      if (!storage) throw new Error('storage not ready')
      const n = await storage.importAll(incoming)
      set({ tasks: await storage.listTasks() })
      return n
    },

    exportTasks() {
      return get().tasks
    },

    showToast(msg: string, onUndo?: () => void) {
      clearTimeout(toastTimer)
      set({ toast: { msg, onUndo: onUndo ?? null } })
      toastTimer = setTimeout(() => set({ toast: null }), 6000)
    },

    dismissToast() {
      clearTimeout(toastTimer)
      set({ toast: null })
    },

    setView: (view) => set({ view, selId: null, expandedId: null, editingId: null }),
    setFilterStatus: (filterStatus) => set({ filterStatus }),
    toggleFilterCat: (cat) =>
      set((s) => ({ filterCat: s.filterCat === cat ? null : cat })),
    setSearch: (search) => set({ search }),
    clearFilters: () => set({ filterStatus: 'all', filterCat: null, search: '' }),
    setSelId: (selId) => set({ selId }),
    setEditingId: (editingId) => set({ editingId }),
    toggleExpanded: (id) =>
      set((s) => ({
        expandedId: id !== null && s.expandedId === id ? null : id,
        selId: id ?? s.selId
      })),
    setShowAllDone: (showAllDone) => set({ showAllDone }),
    openPalette: () => set({ paletteOpen: true }),
    closePalette: () => set({ paletteOpen: false })
  }
})
