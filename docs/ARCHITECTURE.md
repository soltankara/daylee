# Daylee — Architecture

## What this project is

Daylee is a personal task tracker for exactly one user. The design goals: capturing a
task takes under three seconds, and "what should I do right now?" is answered in one
glance. It borrows Linear's structure at personal scale — a drag-and-drop board, a ⌘K
command palette, a side-peek details panel, backlog/canceled workflow states, five
priority levels, and a "This week" planning view.

It is **local-first and private by design**: no accounts, no server, no analytics, no
network calls at runtime beyond font loading. It installs as a PWA and works fully
offline. All data lives in the browser, with an optional automatic file backup described
below.

Stack: React 18 + TypeScript (strict) + Vite, Zustand for state, Dexie (IndexedDB) behind
a backend-agnostic storage interface, @dnd-kit for the board, vite-plugin-pwa,
Vitest + Testing Library + fake-indexeddb for tests.

## Three layers of storage

**1. In-memory (Zustand store, `src/store/useStore.ts`)** — the working copy. Everything
the UI renders comes from a single `tasks` array. Every action (add, edit, complete,
archive…) updates this array immutably — a new array reference each time. That reference
change is what downstream subscribers key off.

**2. IndexedDB (the real database)** — the source of truth. A Dexie database called
`daylee` (`src/storage/dexie.ts`) lives inside the browser profile, behind the
`TaskStorage` interface (`src/storage/storage.ts`; `MemoryStorage` is the test
implementation). On startup, `init()` loads all tasks into the store in one shot; after
that, every mutation writes through to IndexedDB immediately. This survives page reloads
but dies if site data is cleared or the browser evicts storage.

**3. The backup folder (plain files on disk)** — a one-way mirror of layer 2 via the
File System Access API (`src/lib/backup.ts`). A tiny second Dexie database,
`daylee-meta` (`src/lib/backupMeta.ts`), remembers *which folder* the user picked — the
`FileSystemDirectoryHandle` is structured-cloneable, so it persists in IndexedDB and
never has to be re-picked.

## Auto-backup logic

The chain is: **store change → subscriber → debounce → write**.

- At startup, `initBackup()` subscribes to the task store. The subscriber fires on every
  state change but only acts when the `tasks` array reference actually changed — and it
  ignores the initial hydration from IndexedDB (`prev.loaded === false` during that
  transition), so opening the app never triggers a pointless backup.
- A real change starts a **2-second debounce timer**. Five quick edits produce one write
  with the final state. A `writing`/`pending` guard ensures a change arriving mid-write
  queues one follow-up write instead of overlapping.
- The write itself (`performBackup`) serializes all tasks into the same JSON payload as
  manual export (`exportJsonText` in `src/lib/download.ts`), then:
  1. **Rewrites `daylee.json`** — the live mirror, always current. The API writes to a
     temp file and atomically swaps it in on close, so a crash mid-write can never
     corrupt the mirror.
  2. **Once per day**, also writes a dated snapshot `daylee-YYYY-MM-DD.json`. This
     protects against "I deleted everything yesterday and the mirror faithfully backed
     that up" — you can reach back up to 7 days.
  3. **Prunes**: lists the folder, matches dated snapshot names, sorts, and deletes
     everything beyond the newest 7 (`snapshotsToDelete`). The folder is permanently
     capped at 8 files (1 mirror + 7 snapshots).

## Permission lifecycle

The File System Access API is permission-gated, which drives a small state machine in
`useBackupStore`: `unsupported` → Safari/Firefox, Settings shows a note; `off` → no
folder chosen; `ready` → normal operation; `paused`; `error`.

**Paused** happens mainly after a full browser restart: Chrome keeps the folder handle
but downgrades write permission to `'prompt'`, and re-granting requires a real user
gesture — so backups stop, a toast points to Settings, and "resume backups" re-grants and
immediately writes. A deleted/moved folder (`NotFoundError`/`NotAllowedError`) also lands
in paused. **Error** is any other failure (disk full etc.): one toast per failure streak,
and the next change retries automatically.

## What "sync" means here — and doesn't

There is no server and no merging. Backup is strictly **one-way, IndexedDB → files**; the
app never reads the backup folder on its own. Restore is manual: Settings → Import with
`daylee.json` (or an older snapshot), which merges by task id with newer `updatedAt`
winning (`src/storage/merge.ts`). Pointing the backup at an iCloud/Dropbox folder gets
off-machine durability for free — the OS client uploads the files. Two tabs writing at
once is last-writer-wins, which is safe because every write is the full valid state.

Known v1 limitations (accepted): a change within ~2 s of closing the tab loses its
debounce tick (the daily snapshot bounds the loss); Brave disables the API by default and
correctly shows the unsupported note.
