import { create } from 'zustand'
import { useStore } from '../store/useStore'
import { exportJsonText } from './download'
import { todayISO } from './dates'
import { createDexieBackupMeta, type BackupMeta } from './backupMeta'

export const MIRROR_NAME = 'daybook.json'
export const SNAPSHOT_KEEP = 7

const SNAPSHOT_RE = /^daybook-\d{4}-\d{2}-\d{2}\.json$/

export function snapshotName(dayISO: string): string {
  return `daybook-${dayISO}.json`
}

/** Given a folder's entry names, the dated snapshots beyond the newest `keep`. */
export function snapshotsToDelete(entryNames: string[], keep = SNAPSHOT_KEEP): string[] {
  return entryNames
    .filter((n) => SNAPSHOT_RE.test(n))
    .sort()
    .reverse()
    .slice(keep)
}

export type BackupStatus = 'unsupported' | 'off' | 'ready' | 'paused' | 'error'

export interface BackupUiState {
  status: BackupStatus
  folderName: string | null
  lastBackupAt: string | null
}

export const useBackupStore = create<BackupUiState>(() => ({
  status: 'unsupported',
  folderName: null,
  lastBackupAt: null
}))

interface BackupDeps {
  pick(): Promise<FileSystemDirectoryHandle>
  meta: BackupMeta
  now(): Date
  debounceMs: number
}

const defaultDeps = (): BackupDeps => ({
  pick: () => window.showDirectoryPicker({ id: 'daybook-backup', mode: 'readwrite' }),
  meta: createDexieBackupMeta(),
  now: () => new Date(),
  debounceMs: 2000
})

let deps = defaultDeps()
let dirHandle: FileSystemDirectoryHandle | null = null
let wired = false
let unsubscribe: (() => void) | undefined
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let writing = false
let pending = false
let snapshotDoneForDay: string | null = null
let errorToasted = false

export function isBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

function setUi(patch: Partial<BackupUiState>): void {
  useBackupStore.setState(patch)
}

function schedule(): void {
  // error retries on the next change; paused waits for a user gesture
  const status = useBackupStore.getState().status
  if (status !== 'ready' && status !== 'error') return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void performBackup(false), deps.debounceMs)
}

async function writeFile(name: string, text: string): Promise<void> {
  if (!dirHandle) return
  const file = await dirHandle.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  await writable.write(text)
  await writable.close()
}

async function performBackup(manual: boolean): Promise<void> {
  if (!dirHandle) return
  if (writing) {
    pending = true
    return
  }
  writing = true
  try {
    const text = exportJsonText(useStore.getState().tasks)
    await writeFile(MIRROR_NAME, text)

    const day = todayISO(deps.now())
    if (snapshotDoneForDay !== day) {
      await writeFile(snapshotName(day), text)
      const names: string[] = []
      for await (const name of dirHandle.keys()) names.push(name)
      for (const stale of snapshotsToDelete(names)) {
        await dirHandle.removeEntry(stale)
      }
      snapshotDoneForDay = day
    }

    const at = deps.now().toISOString()
    setUi({ status: 'ready', lastBackupAt: at })
    void deps.meta.setLastBackupAt(at)
    errorToasted = false
    if (manual) useStore.getState().showToast('Backed up')
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    setUi({ status: name === 'NotFoundError' || name === 'NotAllowedError' ? 'paused' : 'error' })
    if (!errorToasted) {
      useStore.getState().showToast('Backup failed — check the folder in Settings')
      errorToasted = true
    }
  } finally {
    writing = false
    if (pending) {
      pending = false
      schedule()
    }
  }
}

/** Call once at app startup. No-op where the File System Access API is missing. */
export async function initBackup(): Promise<void> {
  if (wired) return
  wired = true
  if (!isBackupSupported()) {
    setUi({ status: 'unsupported' })
    return
  }

  // prev.loaded === false during the hydration set() — skips the initial fill
  unsubscribe = useStore.subscribe((s, prev) => {
    if (s.tasks !== prev.tasks && prev.loaded) schedule()
  })

  const handle = await deps.meta.getDirHandle().catch(() => null)
  if (!handle) {
    setUi({ status: 'off' })
    return
  }
  dirHandle = handle
  const lastBackupAt = await deps.meta.getLastBackupAt().catch(() => null)
  const perm = await handle.queryPermission({ mode: 'readwrite' })
  if (perm === 'granted') {
    setUi({ status: 'ready', folderName: handle.name, lastBackupAt })
  } else {
    setUi({ status: 'paused', folderName: handle.name, lastBackupAt })
    useStore.getState().showToast('Backups paused — re-enable in Settings')
  }
}

/** Pick (or change) the backup folder. Needs a user gesture. */
export async function chooseBackupFolder(): Promise<void> {
  let handle: FileSystemDirectoryHandle
  try {
    handle = await deps.pick()
  } catch {
    return // user canceled the picker
  }
  dirHandle = handle
  await deps.meta.setDirHandle(handle)
  snapshotDoneForDay = null
  setUi({ status: 'ready', folderName: handle.name })
  useStore.getState().showToast(`Backing up to “${handle.name}”`)
  await performBackup(false)
}

/** Re-grant write permission after a browser restart. Needs a user gesture. */
export async function resumeBackup(): Promise<void> {
  if (!dirHandle) return
  const perm = await dirHandle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return
  setUi({ status: 'ready' })
  await performBackup(true)
}

export async function backupNow(): Promise<void> {
  clearTimeout(debounceTimer)
  await performBackup(true)
}

export async function disableBackup(): Promise<void> {
  clearTimeout(debounceTimer)
  dirHandle = null
  snapshotDoneForDay = null
  await deps.meta.clear().catch(() => {})
  setUi({ status: 'off', folderName: null, lastBackupAt: null })
}

/** Test hook: reset module state and optionally override dependencies. */
export function _resetBackupForTests(overrides?: Partial<BackupDeps>): void {
  clearTimeout(debounceTimer)
  unsubscribe?.()
  unsubscribe = undefined
  deps = { ...defaultDeps(), ...overrides }
  dirHandle = null
  wired = false
  writing = false
  pending = false
  snapshotDoneForDay = null
  errorToasted = false
  useBackupStore.setState({ status: 'unsupported', folderName: null, lastBackupAt: null })
}
