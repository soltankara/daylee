import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import { useStore } from '../store/useStore'
import { exportJsonText } from './download'
import type { BackupMeta } from './backupMeta'
import {
  MIRROR_NAME,
  _resetBackupForTests,
  backupNow,
  chooseBackupFolder,
  disableBackup,
  initBackup,
  resumeBackup,
  snapshotName,
  snapshotsToDelete,
  useBackupStore
} from './backup'

const NOW = () => new Date('2026-07-11T12:00:00')
const TODAY_SNAP = 'daybook-2026-07-11.json'

function mkTask(id: string, title: string): Task {
  return {
    id,
    title,
    note: '',
    status: 'todo',
    priority: 'none',
    category: null,
    dueDate: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    completedAt: null,
    sortIndex: 0,
    recurrence: null,
    archived: false,
    plannedWeek: null
  }
}

interface FakeDir {
  handle: FileSystemDirectoryHandle
  files: Map<string, string>
  writeCounts: Map<string, number>
  permission: PermissionState
  requestResult: PermissionState
  failWith: string | null
}

function fakeDir(name = 'Backups'): FakeDir {
  const files = new Map<string, string>()
  const writeCounts = new Map<string, number>()
  const self: FakeDir = {
    files,
    writeCounts,
    permission: 'granted',
    requestResult: 'granted',
    failWith: null,
    handle: null as unknown as FileSystemDirectoryHandle
  }
  const raw = {
    kind: 'directory',
    name,
    async getFileHandle(n: string) {
      return {
        async createWritable() {
          if (self.failWith) throw new DOMException('boom', self.failWith)
          let buf = ''
          return {
            async write(t: string) {
              buf = t
            },
            async close() {
              files.set(n, buf)
              writeCounts.set(n, (writeCounts.get(n) ?? 0) + 1)
            }
          }
        }
      }
    },
    async *keys() {
      for (const k of Array.from(files.keys())) yield k
    },
    async removeEntry(n: string) {
      files.delete(n)
    },
    async queryPermission() {
      return self.permission
    },
    async requestPermission() {
      self.permission = self.requestResult
      return self.requestResult
    }
  }
  self.handle = raw as unknown as FileSystemDirectoryHandle
  return self
}

function memMeta(initial?: {
  handle?: FileSystemDirectoryHandle
  lastBackupAt?: string
}): BackupMeta {
  let handle = initial?.handle ?? null
  let last = initial?.lastBackupAt ?? null
  return {
    async getDirHandle() {
      return handle
    },
    async setDirHandle(h) {
      handle = h
    },
    async getLastBackupAt() {
      return last
    },
    async setLastBackupAt(iso) {
      last = iso
    },
    async clear() {
      handle = null
      last = null
    }
  }
}

function resetTaskStore() {
  useStore.setState({ tasks: [], loaded: true, toast: null })
}

function changeTasks(...tasks: Task[]) {
  useStore.setState({ tasks })
}

async function flush(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('pure helpers', () => {
  beforeEach(resetTaskStore)

  it('snapshotName formats a dated file name', () => {
    expect(snapshotName('2026-07-11')).toBe('daybook-2026-07-11.json')
  })

  it('snapshotsToDelete keeps the newest N and ignores other files', () => {
    const days = [3, 4, 5, 6, 7, 8, 9, 10, 11].map((d) =>
      `daybook-2026-07-${String(d).padStart(2, '0')}.json`
    )
    const names = ['daybook.json', 'notes.txt', ...days].sort(() => 0.5) // order-independent
    expect(snapshotsToDelete(names).sort()).toEqual([
      'daybook-2026-07-03.json',
      'daybook-2026-07-04.json'
    ])
    expect(snapshotsToDelete(days.slice(0, 7))).toEqual([])
  })

  it('exportJsonText round-trips the export payload', () => {
    const parsed = JSON.parse(exportJsonText([mkTask('a', 'One')])) as {
      app: string
      version: number
      exportedAt: string
      tasks: Task[]
    }
    expect(parsed.app).toBe('daybook')
    expect(parsed.version).toBe(2)
    expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN()
    expect(parsed.tasks[0].title).toBe('One')
  })
})

describe('backup flows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('showDirectoryPicker', vi.fn())
    resetTaskStore()
  })

  afterEach(() => {
    _resetBackupForTests()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('chooseBackupFolder writes the mirror and a dated snapshot immediately', async () => {
    const dir = fakeDir('MyBackups')
    const meta = memMeta()
    _resetBackupForTests({ pick: async () => dir.handle, meta, now: NOW })
    useStore.setState({ tasks: [mkTask('a', 'One')] })

    await chooseBackupFolder()

    expect(dir.files.has(MIRROR_NAME)).toBe(true)
    expect(dir.files.has(TODAY_SNAP)).toBe(true)
    expect(JSON.parse(dir.files.get(MIRROR_NAME)!).tasks[0].title).toBe('One')
    expect(useBackupStore.getState()).toMatchObject({ status: 'ready', folderName: 'MyBackups' })
    expect(useBackupStore.getState().lastBackupAt).not.toBeNull()
    await expect(meta.getDirHandle()).resolves.toBe(dir.handle)
  })

  it('debounces rapid changes into a single write with the latest content', async () => {
    const dir = fakeDir()
    _resetBackupForTests({ pick: async () => dir.handle, meta: memMeta(), now: NOW })
    await initBackup()
    await chooseBackupFolder()
    expect(dir.writeCounts.get(MIRROR_NAME)).toBe(1)

    changeTasks(mkTask('a', 'One'))
    changeTasks(mkTask('a', 'One'), mkTask('b', 'Two'))
    changeTasks(mkTask('a', 'One'), mkTask('b', 'Two'), mkTask('c', 'Three'))
    await flush(2000)

    expect(dir.writeCounts.get(MIRROR_NAME)).toBe(2)
    expect(JSON.parse(dir.files.get(MIRROR_NAME)!).tasks).toHaveLength(3)
  })

  it('writes one snapshot per day and prunes beyond the newest 7', async () => {
    const dir = fakeDir()
    for (let d = 1; d <= 8; d++) {
      dir.files.set(`daybook-2026-07-0${d}.json`, '{}')
    }
    _resetBackupForTests({ pick: async () => dir.handle, meta: memMeta(), now: NOW })
    await initBackup()
    await chooseBackupFolder()

    const snaps = Array.from(dir.files.keys()).filter((n) => n.startsWith('daybook-'))
    expect(snaps).toHaveLength(7)
    expect(dir.files.has('daybook-2026-07-01.json')).toBe(false)
    expect(dir.files.has('daybook-2026-07-02.json')).toBe(false)
    expect(dir.files.has(TODAY_SNAP)).toBe(true)
    expect(dir.files.has(MIRROR_NAME)).toBe(true)

    // second backup the same day: mirror only
    changeTasks(mkTask('a', 'One'))
    await flush(2000)
    expect(dir.writeCounts.get(MIRROR_NAME)).toBe(2)
    expect(dir.writeCounts.get(TODAY_SNAP)).toBe(1)
  })

  it('does not back up on initial hydration', async () => {
    const dir = fakeDir()
    _resetBackupForTests({ meta: memMeta({ handle: dir.handle }), now: NOW })
    await initBackup()
    expect(useBackupStore.getState().status).toBe('ready')

    useStore.setState({ loaded: false })
    useStore.setState({ tasks: [mkTask('a', 'One')], loaded: true }) // hydration
    await flush(2000)

    expect(dir.writeCounts.size).toBe(0)
  })

  it('pauses when permission is gone and resumes on request', async () => {
    const dir = fakeDir('Docs')
    dir.permission = 'prompt'
    _resetBackupForTests({ meta: memMeta({ handle: dir.handle }), now: NOW })
    await initBackup()
    expect(useBackupStore.getState()).toMatchObject({ status: 'paused', folderName: 'Docs' })
    expect(useStore.getState().toast?.msg).toMatch(/paused/i)

    changeTasks(mkTask('a', 'One'))
    await flush(2000)
    expect(dir.writeCounts.size).toBe(0)

    await resumeBackup()
    expect(useBackupStore.getState().status).toBe('ready')
    expect(dir.files.has(MIRROR_NAME)).toBe(true)
    expect(useStore.getState().toast?.msg).toBe('Backed up')
  })

  it('reports errors once per streak and retries on the next change', async () => {
    const dir = fakeDir()
    _resetBackupForTests({ pick: async () => dir.handle, meta: memMeta(), now: NOW })
    await initBackup()
    await chooseBackupFolder()

    dir.failWith = 'QuotaExceededError'
    changeTasks(mkTask('a', 'One'))
    await flush(2000)
    expect(useBackupStore.getState().status).toBe('error')
    expect(useStore.getState().toast?.msg).toMatch(/backup failed/i)

    useStore.getState().dismissToast()
    changeTasks(mkTask('a', 'One'), mkTask('b', 'Two'))
    await flush(2000)
    expect(useStore.getState().toast).toBeNull() // toast only once per streak

    dir.failWith = null
    changeTasks(mkTask('a', 'One'), mkTask('b', 'Two'), mkTask('c', 'Three'))
    await flush(2000)
    expect(useBackupStore.getState().status).toBe('ready')
    expect(JSON.parse(dir.files.get(MIRROR_NAME)!).tasks).toHaveLength(3)

    // toast fires again on a fresh failure streak
    dir.failWith = 'QuotaExceededError'
    changeTasks(mkTask('a', 'One'))
    await flush(2000)
    expect(useStore.getState().toast?.msg).toMatch(/backup failed/i)
  })

  it('flips to paused when the folder disappears', async () => {
    const dir = fakeDir()
    _resetBackupForTests({ pick: async () => dir.handle, meta: memMeta(), now: NOW })
    await initBackup()
    await chooseBackupFolder()

    dir.failWith = 'NotFoundError'
    changeTasks(mkTask('a', 'One'))
    await flush(2000)
    expect(useBackupStore.getState().status).toBe('paused')
  })

  it('backupNow writes immediately and toasts', async () => {
    const dir = fakeDir()
    _resetBackupForTests({ pick: async () => dir.handle, meta: memMeta(), now: NOW })
    await chooseBackupFolder()
    useStore.getState().dismissToast()

    await backupNow()
    expect(dir.writeCounts.get(MIRROR_NAME)).toBe(2)
    expect(useStore.getState().toast?.msg).toBe('Backed up')
  })

  it('disableBackup clears everything and stops writing', async () => {
    const dir = fakeDir()
    const meta = memMeta()
    _resetBackupForTests({ pick: async () => dir.handle, meta, now: NOW })
    await initBackup()
    await chooseBackupFolder()

    changeTasks(mkTask('a', 'One')) // pending debounce
    await disableBackup()
    await flush(2000)

    expect(dir.writeCounts.get(MIRROR_NAME)).toBe(1) // only the initial write
    expect(useBackupStore.getState()).toMatchObject({
      status: 'off',
      folderName: null,
      lastBackupAt: null
    })
    await expect(meta.getDirHandle()).resolves.toBeNull()

    changeTasks(mkTask('a', 'One'), mkTask('b', 'Two'))
    await flush(2000)
    expect(dir.writeCounts.get(MIRROR_NAME)).toBe(1)
  })

  it('canceling the folder picker is a silent no-op', async () => {
    _resetBackupForTests({
      pick: async () => {
        throw new DOMException('user canceled', 'AbortError')
      },
      meta: memMeta(),
      now: NOW
    })
    await initBackup()
    await chooseBackupFolder()
    expect(useBackupStore.getState().status).toBe('off')
    expect(useStore.getState().toast).toBeNull()
  })
})
