import type { Task } from '../types'

/** Last-write-wins merge by id (spec §4.6): the newer `updatedAt` copy of each task survives. */
export function mergeTasks(
  existing: Task[],
  incoming: Task[]
): { merged: Task[]; changed: Task[] } {
  const byId = new Map(existing.map((t) => [t.id, t]))
  const changed: Task[] = []
  for (const t of incoming) {
    const ex = byId.get(t.id)
    if (!ex || (t.updatedAt || '') > (ex.updatedAt || '')) {
      byId.set(t.id, t)
      changed.push(t)
    }
  }
  return { merged: Array.from(byId.values()), changed }
}
