import type { Task } from '../types'
import type { TaskStorage } from './storage'
import { mergeTasks } from './merge'

/** In-memory implementation for tests. */
export class MemoryStorage implements TaskStorage {
  private tasks = new Map<string, Task>()

  async listTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values())
  }

  async saveTask(task: Task): Promise<void> {
    this.tasks.set(task.id, task)
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    for (const t of tasks) this.tasks.set(t.id, t)
  }

  async deleteTask(id: string): Promise<void> {
    this.tasks.delete(id)
  }

  async exportAll(): Promise<Task[]> {
    return this.listTasks()
  }

  async importAll(tasks: Task[]): Promise<number> {
    const { changed } = mergeTasks(Array.from(this.tasks.values()), tasks)
    for (const t of changed) this.tasks.set(t.id, t)
    return changed.length
  }
}
