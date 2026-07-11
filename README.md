# Daybook

A personal task tracker for exactly one user: you. Capturing a task takes under three
seconds; finding out "what should I do right now?" takes one glance.

Local-first: everything is stored in your browser (IndexedDB). No accounts, no analytics,
no network calls beyond font loading. Installable as a PWA and fully functional offline.
Optional auto-backup mirrors your data to a folder you pick (`daybook.json` + the last 7
daily snapshots) — see `docs/ARCHITECTURE.md` for how storage, backup and sync work.

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
- **Board** (default) — Backlog / To do / Doing / Done columns. Drag between columns to
  change status, drag within a column for manual order (touch and keyboard drag
  supported). Click a card to open its details panel; click anywhere outside to close it.
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

## Deployment

The production build is a folder of static files — no server-side code. This machine
serves it at **https://daylee.com** and the app is installed from there as a PWA (own
window, Dock icon, works offline even with the server stopped).

One-time setup (already done on this Mac):

1. `/etc/hosts` maps the domain to localhost: `127.0.0.1 daylee.com`
2. `brew install caddy`, then a Caddyfile at `/opt/homebrew/etc/Caddyfile`:

   ```
   daylee.com {
     tls internal
     root * /Users/soltan/Sites/daylee
     file_server
     try_files {path} /index.html
   }
   ```

3. `sudo caddy trust` (trusts the local HTTPS certificate — required: PWA install and
   the auto-backup file API only work on secure origins) and `brew services start caddy`
   (starts at every login)
4. Open https://daylee.com in Chrome and click the install icon in the address bar

Ship a change:

```bash
npm test          # must be green
npm run deploy    # build + sync dist/ to ~/Sites/daylee
```

The installed PWA picks up the new version on its next launch (service-worker
auto-update); Caddy never needs restarting. `~/Sites/daylee` is a build artifact — never
edit it by hand.

Your data is yours: one-click JSON/CSV export and JSON import (merge by id, newer
`updatedAt` wins) live under **Export & data**. v1.0 exports import cleanly — old
`normal|high` priorities map to the new scale automatically.
