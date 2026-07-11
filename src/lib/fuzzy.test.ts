import { describe, expect, it } from 'vitest'
import { fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('matches subsequences case-insensitively', () => {
    expect(fuzzyScore('gtb', 'Go to board')).not.toBeNull()
    expect(fuzzyScore('BOARD', 'Go to board')).not.toBeNull()
  })

  it('returns null when the query is not a subsequence', () => {
    expect(fuzzyScore('xyz', 'Go to board')).toBeNull()
    expect(fuzzyScore('boardx', 'Go to board')).toBeNull()
  })

  it('an empty query matches everything with score 0', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })

  it('prefers word starts and consecutive matches', () => {
    // "board" hits a word start + consecutive run in "Go to board"
    const wordStart = fuzzyScore('board', 'Go to board')!
    const scattered = fuzzyScore('board', 'be over and read')!
    expect(wordStart).toBeGreaterThan(scattered)
  })

  it('ranks an exact-prefix title above a later scattered match', () => {
    const prefix = fuzzyScore('mark', 'Mark as done')!
    const scattered = fuzzyScore('mark', 'my archive re-check')!
    expect(prefix).toBeGreaterThan(scattered)
  })
})
