# Daybook

A personal task tracker for exactly one user: you. Capturing a task takes under three
seconds; finding out "what should I do right now?" takes one glance.

Local-first: everything is stored in your browser (IndexedDB). No accounts, no analytics,
no network calls beyond font loading. Installable as a PWA and fully functional offline.

v1.1 borrows Linear's structure at personal scale: a drag-and-drop board, a ⌘K command
palette, a side-peek details panel, backlog/canceled workflow states, five priority
levels, and a "This week" planning view.

## Quick-entry syntax

Type in the box and press Enter. A few characters add structure, only when you want it:

| You type | What happens |
| --- | --- |
| `Pay rent #home` | sets category `home` |
| `Call the bank !` | high priority |
| `Server down !!` | urgent (also `!low`, `!med`, `!high`, `!urgent`) |
| `Water plants @tomorrow` | due tomorrow (`@today`, `@fri`, weekday names work too) |
| `Renew passport @2026-08-01` | due on a date |

Ambiguous tokens (like `sam@example.com` or `!!!`) are left in the title — the parser
never guesses.

## Views

- **List** — smart-sorted groups (Doing / To do / Backlog / Done); Today filter shows
  what's due or in flight.
- **Board** — Backlog / To do / Doing / Done columns. Drag between columns to change
  status, drag within a column for manual order (touch and keyboard drag supported).
- **This week** — commit tasks to the current week (⌘K → "Add to this week"); unfinished
  ones roll forward automatically each Monday.
- **Done log** — completed and canceled tasks, day by day, with one-click reopen.

Statuses: backlog → to do → doing → done, plus canceled (kept in the log, never
deleted-by-history). Space cycles the happy path; backlog and canceled are set from the
palette, the details panel, or a board drag.

## Keyboard shortcuts

`⌘K`/`Ctrl+K` command palette · `n`/`a` add · `/` search · `j`/`k` move ·
`space` cycle status · `e` details · `x` delete (with undo) · `b` board · `w` this week ·
`1/2/3/4/0` filter To do / Doing / Done / Backlog / All · `t` Today

## Development

```bash
npm install
npm run dev       # dev server
npm test          # unit + component tests (Vitest)
npm run build     # type-check + production build (PWA)
npm run preview   # serve the production build
```

Stack: React 18 + TypeScript (strict) + Vite, Zustand, Dexie (IndexedDB) behind a
backend-agnostic storage interface (`src/storage/storage.ts`), @dnd-kit for the board,
vite-plugin-pwa.

Your data is yours: one-click JSON/CSV export and JSON import (merge by id, newer
`updatedAt` wins) live under **Export & data**. v1.0 exports import cleanly — old
`normal|high` priorities map to the new scale automatically.
