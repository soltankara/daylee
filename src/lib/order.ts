import type { Task } from '../types'
import { compareTasks, orderForBoard } from './sort'

/** Spacing between freshly assigned indexes, leaving room for midpoint inserts. */
export const SORT_GAP = 1024

/** Midpoints stop being representable below this — time to renormalize. */
const MIN_GAP = 1e-6

export function sortIndexBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return SORT_GAP
  if (before === null) return (after as number) - SORT_GAP
  if (after === null) return before + SORT_GAP
  return (before + after) / 2
}

export function needsRenormalize(before: number | null, after: number | null): boolean {
  return before !== null && after !== null && after - before < MIN_GAP
}

/** Re-space a column's tasks at SORT_GAP intervals; returns only changed tasks. */
export function renormalize(column: Task[]): Task[] {
  return column
    .map((t, i) => ({ t, idx: (i + 1) * SORT_GAP }))
    .filter(({ t, idx }) => t.sortIndex !== idx)
    .map(({ t, idx }) => ({ ...t, sortIndex: idx }))
}

/**
 * One-time bootstrap for data created before manual ordering existed (every
 * sortIndex 0): give each status group its smart-sort order. Idempotent —
 * returns [] when all indexes within a group are already distinct.
 */
export function ensureSortIndexes(tasks: Task[], today: string): Task[] {
  const changed: Task[] = []
  const byStatus = new Map<string, Task[]>()
  for (const t of tasks) {
    const g = byStatus.get(t.status)
    if (g) g.push(t)
    else byStatus.set(t.status, [t])
  }
  for (const group of byStatus.values()) {
    const seen = new Set(group.map((t) => t.sortIndex))
    if (seen.size === group.length) continue
    const ordered = [...group].sort((a, b) => compareTasks(a, b, today))
    changed.push(...renormalize(ordered))
  }
  return changed
}

/**
 * Compute the sortIndex for dropping a task at `targetIndex` within `column`
 * (the column's current board order, target task excluded). Returns the new
 * index plus any neighbors that had to be renormalized.
 */
export function placeInColumn(
  column: Task[],
  index: number,
  today: string
): { sortIndex: number; renormalized: Task[] } {
  const ordered = orderForBoard(column, today)
  const targetIndex = Math.max(0, Math.min(index, ordered.length))
  const before = targetIndex > 0 ? ordered[targetIndex - 1].sortIndex : null
  const after = targetIndex < ordered.length ? ordered[targetIndex].sortIndex : null
  if (!needsRenormalize(before, after)) {
    return { sortIndex: sortIndexBetween(before, after), renormalized: [] }
  }
  const renormalized = renormalize(ordered)
  const fresh = ordered.map(
    (t) => renormalized.find((r) => r.id === t.id) ?? t
  )
  const b = targetIndex > 0 ? fresh[targetIndex - 1].sortIndex : null
  const a = targetIndex < fresh.length ? fresh[targetIndex].sortIndex : null
  return { sortIndex: sortIndexBetween(b, a), renormalized }
}
