import type { Task } from '../types'

/**
 * Backend-agnostic persistence seam (spec §6.1). v1 ships the Dexie/IndexedDB
 * implementation; a future sync backend only has to implement this interface.
 */
export interface TaskStorage {
  listTasks(): Promise<Task[]>
  saveTask(task: Task): Promise<void>
  saveTasks(tasks: Task[]): Promise<void>
  deleteTask(id: string): Promise<void>
  exportAll(): Promise<Task[]>
  /** Merge by id; the newer `updatedAt` wins. Returns how many tasks changed. */
  importAll(tasks: Task[]): Promise<number>
}
