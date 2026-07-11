# Daybook

Personal task tracker PWA — single user, local-first, no server. All data in browser
IndexedDB with optional auto-backup to a local folder. Full architecture (storage layers,
backup/sync design): see `docs/ARCHITECTURE.md`.

## Commands

- `npm run dev` — dev server
- `npm test` — run all tests once (Vitest); `npm run test:watch` for watch mode
- `npm run build` — type-check (`tsc -b`) + production build; run this to verify types
- `npm run preview` — serve the production build
- `npm run deploy` — build + rsync `dist/` to `~/Sites/daylee`, the folder served at
  https://daylee.com (see Deployment)

## Code map

- `src/store/useStore.ts` — single Zustand store: all state + actions (persist through
  the injected `TaskStorage`)
- `src/storage/` — `storage.ts` (interface), `dexie.ts` (IndexedDB, production),
  `memory.ts` (tests), `merge.ts` (import merge, newer `updatedAt` wins)
- `src/lib/` — pure logic: `parse.ts` (quick-add syntax), `sort.ts`/`order.ts`/`week.ts`
  (grouping), `backup.ts` + `backupMeta.ts` (auto-backup), `download.ts` (export)
- `src/components/` — one component per file; views switch in `App.tsx`
- `src/styles/tokens.css` — design tokens; use them, never hard-code colors

## Style

- TypeScript strict; no `any`. Named exports only (default export only for `App`)
- Pure logic goes in `src/lib/` with unit tests next to it (`foo.ts` + `foo.test.ts`);
  components stay thin
- State changes are immutable — Zustand subscribers rely on `tasks` array reference
  changes
- Reuse existing CSS classes and tokens before adding CSS

## Testing

- Component tests live in `src/test/`, use `MemoryStorage` and reset the store in
  `beforeEach` (copy the `resetStore` pattern from `src/test/app.test.tsx`)
- Backup tests never touch real disk: inject fakes via `_resetBackupForTests()` (see
  `src/lib/backup.test.ts`)
- After any change run `npm test` and `npm run build` — both must be green

## Deployment

- The app is served locally at **https://daylee.com**: `/etc/hosts` maps daylee.com to
  127.0.0.1 and Caddy (`brew services`, config in `/opt/homebrew/etc/Caddyfile`, local CA
  via `tls internal`) serves `~/Sites/daylee` — installed as a PWA from there
- Ship a change: `npm test` green → `npm run deploy`; the installed PWA picks up the new
  service worker on next launch — no Caddy restart needed
- `~/Sites/daylee` is a build artifact on the internal disk (works with the exFAT drive
  unplugged) — never edit it by hand

## Gotchas

- This is a private tool: no analytics, no trackers, no third-party network calls at
  runtime (fonts excepted)
- `tsconfig.app.json` has an explicit `"types"` array and `DOM.AsyncIterable` in `lib`;
  do NOT add `@types/wicg-file-system-access` (conflicts with built-in DOM types —
  ambient declarations live in `src/types/fs-access.d.ts`)
- Zustand 5 `subscribe` (no middleware) passes `(state, prev)` — diff manually
- The repo sits on an exFAT volume: ignore macOS `._*` metadata files
