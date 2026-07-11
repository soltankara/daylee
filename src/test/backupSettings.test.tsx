import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { useStore } from '../store/useStore'
import { MemoryStorage } from '../storage/memory'
import type { BackupMeta } from '../lib/backupMeta'
import { _resetBackupForTests, initBackup, useBackupStore } from '../lib/backup'

function resetStore() {
  useStore.setState({
    tasks: [],
    loaded: false,
    view: 'settings',
    filterStatus: 'all',
    filterCat: null,
    search: '',
    selId: null,
    editingId: null,
    expandedId: null,
    showAllDone: false,
    toast: null,
    popId: null,
    paletteOpen: false
  })
}

function memMeta(initial?: { handle?: FileSystemDirectoryHandle }): BackupMeta {
  let handle = initial?.handle ?? null
  let last: string | null = null
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

function fakeHandle(name: string, permission: PermissionState = 'granted') {
  const files = new Map<string, string>()
  let perm = permission
  return {
    files,
    handle: {
      kind: 'directory',
      name,
      async getFileHandle(n: string) {
        return {
          async createWritable() {
            let buf = ''
            return {
              async write(t: string) {
                buf = t
              },
              async close() {
                files.set(n, buf)
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
        return perm
      },
      async requestPermission() {
        perm = 'granted'
        return perm
      }
    } as unknown as FileSystemDirectoryHandle
  }
}

async function setup() {
  render(<App storage={new MemoryStorage()} />)
  await waitFor(() => expect(useStore.getState().loaded).toBe(true))
  return userEvent.setup()
}

// settle async backup work (file writes, store updates) inside act
const flush = () => act(async () => {})

beforeEach(resetStore)
afterEach(() => {
  _resetBackupForTests()
  vi.unstubAllGlobals()
})

describe('backup settings', () => {
  it('shows the unsupported note in browsers without the API', async () => {
    _resetBackupForTests()
    await setup()
    expect(screen.getByText(/isn’t supported in this browser/)).toBeInTheDocument()
    expect(screen.queryByText('choose backup folder')).not.toBeInTheDocument()
  })

  it('choose folder → ready with folder name, back up now toasts, turn off reverts', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn())
    const dir = fakeHandle('MyBackups')
    _resetBackupForTests({ pick: async () => dir.handle, meta: memMeta() })
    const user = await setup()

    await user.click(await screen.findByText('choose backup folder'))
    await flush()
    // matches the status line and possibly the toast
    expect((await screen.findAllByText(/Backing up to “MyBackups”/)).length).toBeGreaterThan(0)
    expect(dir.files.has('daybook.json')).toBe(true)

    await user.click(screen.getByText('back up now'))
    await flush()
    await waitFor(() => expect(useStore.getState().toast?.msg).toBe('Backed up'))
    expect(screen.getByText(/last backup/)).toBeInTheDocument()

    await user.click(screen.getByText('turn off'))
    await flush()
    expect(await screen.findByText(/pick a folder/i)).toBeInTheDocument()
    await waitFor(() => expect(useStore.getState().toast?.msg).toBe('Auto-backup turned off'))
    expect(useBackupStore.getState().status).toBe('off')
  })

  it('renders paused state and resumes on click', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn())
    const dir = fakeHandle('Docs', 'prompt')
    _resetBackupForTests({ meta: memMeta({ handle: dir.handle }) })
    await initBackup()
    const user = await setup()

    expect(screen.getByText(/needs permission to write to “Docs”/)).toBeInTheDocument()
    await user.click(screen.getByText('resume backups'))
    await flush()
    expect(await screen.findByText(/Backing up to “Docs”/)).toBeInTheDocument()
    expect(dir.files.has('daybook.json')).toBe(true)
  })
})
