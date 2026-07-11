import type { Priority } from '../types'
import { PRIORITY_LABELS } from '../types'

/**
 * Linear-style priority glyphs in the paper palette: urgent is a filled
 * square with an exclamation mark; high/medium/low light up 3/2/1 bars.
 */
export function PriorityIcon({ p }: { p: Priority }) {
  if (p === 'none') return null
  const label = PRIORITY_LABELS[p] + ' priority'
  if (p === 'urgent') {
    return (
      <svg
        className="priority-icon urgent"
        viewBox="0 0 12 12"
        width="12"
        height="12"
        role="img"
        aria-label={label}
      >
        <rect width="12" height="12" rx="2.5" fill="var(--warn)" />
        <path
          d="M6 2.6v4.2M6 9.2v.2"
          stroke="#fdfcf7"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  const lit = p === 'high' ? 3 : p === 'medium' ? 2 : 1
  return (
    <svg
      className={'priority-icon ' + p}
      viewBox="0 0 12 12"
      width="12"
      height="12"
      role="img"
      aria-label={label}
    >
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={i * 4.5}
          y={8 - i * 3}
          width="3"
          height={4 + i * 3}
          rx="1"
          fill="var(--ink-soft)"
          opacity={i < lit ? 1 : 0.25}
        />
      ))}
    </svg>
  )
}
