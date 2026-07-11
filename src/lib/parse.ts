import type { Priority } from '../types'
import { TITLE_MAX } from '../types'
import { parseDateToken } from './dates'

export interface ParsedQuick {
  title: string
  category: string | null
  priority: Priority
  dueDate: string | null
}

const NAMED_PRIORITY: Record<string, Priority> = {
  low: 'low',
  med: 'medium',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent'
}

/**
 * Quick-entry syntax: `#word` → category, bare `!` → high / `!!` → urgent /
 * `!low|!med|!medium|!high|!urgent` → named priority,
 * `@today|@tomorrow|@fri|@2026-07-15` → due date. Parsed tokens are removed
 * from the title; anything ambiguous stays in the title rather than guessing.
 */
export function parseQuick(raw: string, now: Date = new Date()): ParsedQuick {
  const words = raw.split(/\s+/)
  const rest: string[] = []
  let category: string | null = null
  let priority: Priority = 'none'
  let dueDate: string | null = null

  for (const w of words) {
    if (w === '!') {
      priority = 'high'
      continue
    }
    if (w === '!!') {
      priority = 'urgent'
      continue
    }
    if (w.length > 1 && w[0] === '!' && NAMED_PRIORITY[w.slice(1).toLowerCase()]) {
      priority = NAMED_PRIORITY[w.slice(1).toLowerCase()]
      continue
    }
    if (/^#[\w-]+$/.test(w)) {
      category = w.slice(1).toLowerCase()
      continue
    }
    if (w.length > 1 && w[0] === '@') {
      const d = parseDateToken(w.slice(1), now)
      if (d) {
        dueDate = d
        continue
      }
    }
    rest.push(w)
  }

  return { title: rest.join(' ').trim().slice(0, TITLE_MAX), category, priority, dueDate }
}
