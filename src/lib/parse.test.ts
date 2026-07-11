import { describe, expect, it } from 'vitest'
import { parseQuick } from './parse'
import { parseDateToken } from './dates'

// Wednesday, 2026-07-08
const NOW = new Date('2026-07-08T12:00:00')

describe('parseQuick', () => {
  it('creates a plain task from a bare title', () => {
    expect(parseQuick('Pay rent', NOW)).toEqual({
      title: 'Pay rent',
      category: null,
      priority: 'none',
      dueDate: null
    })
  })

  it('parses #category and removes it from the title', () => {
    const p = parseQuick('Pay rent #home', NOW)
    expect(p.title).toBe('Pay rent')
    expect(p.category).toBe('home')
  })

  it('lowercases categories and allows dashes/underscores', () => {
    expect(parseQuick('x #Deep-Work_2', NOW).category).toBe('deep-work_2')
  })

  it('parses bare ! as high priority', () => {
    const p = parseQuick('Call bank !', NOW)
    expect(p.title).toBe('Call bank')
    expect(p.priority).toBe('high')
  })

  it('does not treat ! attached to a word as priority', () => {
    const p = parseQuick('Ship it!', NOW)
    expect(p.title).toBe('Ship it!')
    expect(p.priority).toBe('none')
  })

  it('parses !! as urgent', () => {
    const p = parseQuick('Server down !!', NOW)
    expect(p.title).toBe('Server down')
    expect(p.priority).toBe('urgent')
  })

  it('parses named priorities, case-insensitive', () => {
    expect(parseQuick('a !low', NOW).priority).toBe('low')
    expect(parseQuick('a !med', NOW).priority).toBe('medium')
    expect(parseQuick('a !medium', NOW).priority).toBe('medium')
    expect(parseQuick('a !high', NOW).priority).toBe('high')
    expect(parseQuick('a !Urgent', NOW).priority).toBe('urgent')
    expect(parseQuick('a !low', NOW).title).toBe('a')
  })

  it('leaves unrecognized ! tokens in the title', () => {
    expect(parseQuick('a !!!', NOW)).toMatchObject({ title: 'a !!!', priority: 'none' })
    expect(parseQuick('a !soon', NOW)).toMatchObject({ title: 'a !soon', priority: 'none' })
    expect(parseQuick('a !1', NOW)).toMatchObject({ title: 'a !1', priority: 'none' })
  })

  it('parses @today and @tomorrow', () => {
    expect(parseQuick('a @today', NOW).dueDate).toBe('2026-07-08')
    expect(parseQuick('a @tomorrow', NOW).dueDate).toBe('2026-07-09')
    expect(parseQuick('a @tmr', NOW).dueDate).toBe('2026-07-09')
  })

  it('parses weekday shortcuts as the NEXT occurrence, never today', () => {
    expect(parseQuick('a @fri', NOW).dueDate).toBe('2026-07-10')
    expect(parseQuick('a @friday', NOW).dueDate).toBe('2026-07-10')
    // NOW is a Wednesday — @wed must mean next Wednesday
    expect(parseQuick('a @wed', NOW).dueDate).toBe('2026-07-15')
    // and Monday has already passed this week
    expect(parseQuick('a @mon', NOW).dueDate).toBe('2026-07-13')
  })

  it('parses ISO dates', () => {
    expect(parseQuick('Renew passport @2026-08-01', NOW).dueDate).toBe('2026-08-01')
  })

  it('rejects invalid ISO dates and leaves the token in the title', () => {
    const p = parseQuick('a @2026-13-45', NOW)
    expect(p.dueDate).toBeNull()
    expect(p.title).toBe('a @2026-13-45')
  })

  it('leaves ambiguous @tokens in the title (emails, handles)', () => {
    const p = parseQuick('Email sam@example.com @someday', NOW)
    expect(p.dueDate).toBeNull()
    expect(p.title).toBe('Email sam@example.com @someday')
  })

  it('leaves a bare @ and bare # in the title', () => {
    expect(parseQuick('meet @ noon', NOW).title).toBe('meet @ noon')
    expect(parseQuick('issue # 42', NOW).title).toBe('issue # 42')
  })

  it('does not parse #tags with invalid characters', () => {
    const p = parseQuick('review #c++ notes', NOW)
    expect(p.category).toBeNull()
    expect(p.title).toBe('review #c++ notes')
  })

  it('combines all tokens in any position', () => {
    const p = parseQuick('! Pay rent #home @fri', NOW)
    expect(p).toEqual({
      title: 'Pay rent',
      category: 'home',
      priority: 'high',
      dueDate: '2026-07-10'
    })
  })

  it('combines !! with other tokens', () => {
    const p = parseQuick('fix roof !! #home @fri', NOW)
    expect(p).toEqual({
      title: 'fix roof',
      category: 'home',
      priority: 'urgent',
      dueDate: '2026-07-10'
    })
  })

  it('last token wins when repeated', () => {
    const p = parseQuick('a #home #work @today @fri', NOW)
    expect(p.category).toBe('work')
    expect(p.dueDate).toBe('2026-07-10')
  })

  it('collapses extra whitespace', () => {
    expect(parseQuick('  Pay   rent   #home  ', NOW).title).toBe('Pay rent')
  })

  it('caps the title at 300 chars', () => {
    expect(parseQuick('x'.repeat(400), NOW).title).toHaveLength(300)
  })

  it('returns an empty title when input is only tokens', () => {
    expect(parseQuick('#home ! @fri', NOW).title).toBe('')
  })
})

describe('parseDateToken', () => {
  it('is case-insensitive', () => {
    expect(parseDateToken('FRI', NOW)).toBe('2026-07-10')
    expect(parseDateToken('Tomorrow', NOW)).toBe('2026-07-09')
  })

  it('rejects things that look like dates but are not', () => {
    expect(parseDateToken('2026-1-5', NOW)).toBeNull()
    expect(parseDateToken('20260105', NOW)).toBeNull()
    expect(parseDateToken('next-week', NOW)).toBeNull()
    expect(parseDateToken('2026-02-30', NOW)).toBeNull()
  })
})
