import Dexie, { type EntityTable } from 'dexie'
import type { Task } from '../types'
import type { TaskStorage } from './storage'
import { mergeTasks } from './merge'
import { normalizePriority } from '../lib/task'

class DayleeDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>

  constructor() {
    super('daylee')
    this.version(1).stores({
      tasks: 'id, status, dueDate, completedAt, updatedAt'
    })
    // v2: priority widens from normal|high to none…urgent; plannedWeek added.
    this.version(2)
      .stores({
        tasks: 'id, status, dueDate, completedAt, updatedAt'
      })
      .upgrade((tx) =>
        tx
          .table('tasks')
          .toCollection()
          .modify((t) => {
            t.priority = normalizePriority(t.priority)
            if (t.plannedWeek === undefined) t.plannedWeek = null
          })
      )
  }
}

export class DexieStorage implements TaskStorage {
  private db = new DayleeDB()

  async listTasks(): Promise<Task[]> {
    return this.db.tasks.toArray()
  }

  async saveTask(task: Task): Promise<void> {
    await this.db.tasks.put(task)
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.db.tasks.bulkPut(tasks)
  }

  async deleteTask(id: string): Promise<void> {
    await this.db.tasks.delete(id)
  }

  async exportAll(): Promise<Task[]> {
    return this.listTasks()
  }

  async importAll(tasks: Task[]): Promise<number> {
    return this.db.transaction('rw', this.db.tasks, async () => {
      const existing = await this.db.tasks.toArray()
      const { changed } = mergeTasks(existing, tasks)
      await this.db.tasks.bulkPut(changed)
      return changed.length
    })
  }
}
