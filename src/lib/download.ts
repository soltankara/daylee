import type { Task } from '../types'
import { todayISO } from './dates'

export function download(name: string, text: string, type: string): void {
  const a = document.createElement('a')
  const url = URL.createObjectURL(new Blob([text], { type }))
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** The canonical export/backup payload — shared by manual export and auto-backup. */
export function exportJsonText(tasks: Task[]): string {
  return JSON.stringify(
    { app: 'daybook', version: 2, exportedAt: new Date().toISOString(), tasks },
    null,
    2
  )
}

export function downloadJsonExport(tasks: Task[]): void {
  download(`daybook-export-${todayISO()}.json`, exportJsonText(tasks), 'application/json')
}
