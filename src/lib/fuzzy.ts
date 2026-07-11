/**
 * Case-insensitive subsequence match. Returns a score (higher = better) or
 * null when the query is not a subsequence of the text. Consecutive hits and
 * word-start hits score extra; earlier matches beat later ones.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (!q) return 0
  let score = 0
  let ti = 0
  let prevHit = -2
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti)
    if (idx === -1) return null
    score += 1
    if (idx === prevHit + 1) score += 4
    if (idx === 0 || t[idx - 1] === ' ' || t[idx - 1] === '-') score += 3
    score -= idx * 0.01 // slight preference for early matches
    prevHit = idx
    ti = idx + 1
  }
  return score
}
