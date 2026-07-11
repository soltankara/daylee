/** Local-timezone ISO date (YYYY-MM-DD). */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function todayISO(now: Date = new Date()): string {
  return isoDate(now)
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Resolve a due-date token (without the leading `@`) to an ISO date, or null
 * if it isn't recognized — the caller leaves unrecognized tokens in the title.
 * Weekday names resolve to the NEXT occurrence, never today.
 */
export function parseDateToken(raw: string, now: Date = new Date()): string | null {
  const s = raw.toLowerCase()
  if (s === 'today' || s === 'tod') return isoDate(now)
  if (s === 'tomorrow' || s === 'tmr' || s === 'tom') return isoDate(addDays(now, 1))
  const i = WEEKDAYS.findIndex((d) => d === s || d.slice(0, 3) === s)
  if (i >= 0) {
    let diff = (i - now.getDay() + 7) % 7
    if (diff === 0) diff = 7
    return isoDate(addDays(now, diff))
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00')
    if (!isNaN(d.getTime()) && isoDate(d) === s) return s
  }
  return null
}

/** Short human label for a due date: "overdue · Jul 8", "today", "tomorrow", "Jul 15". */
export function fmtDue(dueISO: string, now: Date = new Date()): string {
  const today = isoDate(now)
  const short = new Date(dueISO + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
  if (dueISO < today) return 'overdue · ' + short
  if (dueISO === today) return 'today'
  if (dueISO === isoDate(addDays(now, 1))) return 'tomorrow'
  return short
}

/** Day heading for the Done log: Today, Yesterday, then "Wednesday, July 8". */
export function fmtDayLabel(dayISO: string, now: Date = new Date()): string {
  if (dayISO === isoDate(now)) return 'Today'
  if (dayISO === isoDate(addDays(now, -1))) return 'Yesterday'
  return new Date(dayISO + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

export function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function fmtHeading(now: Date = new Date()): string {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
