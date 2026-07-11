import Dexie, { type EntityTable } from 'dexie'

/**
 * Persistence for the auto-backup feature's own bookkeeping: the picked
 * directory handle (structured-cloneable, so it survives in IndexedDB) and
 * the last successful backup time. Kept in its own tiny DB so the tasks
 * storage layer stays untouched. Injectable so tests can use plain memory —
 * mock handles have methods and can't round-trip through IndexedDB anyway.
 */
export interface BackupMeta {
  getDirHandle(): Promise<FileSystemDirectoryHandle | null>
  setDirHandle(handle: FileSystemDirectoryHandle): Promise<void>
  getLastBackupAt(): Promise<string | null>
  setLastBackupAt(iso: string): Promise<void>
  clear(): Promise<void>
}

interface KvRow {
  key: string
  value: unknown
}

class MetaDB extends Dexie {
  kv!: EntityTable<KvRow, 'key'>

  constructor() {
    super('daybook-meta')
    this.version(1).stores({ kv: 'key' })
  }
}

const DIR_KEY = 'backupDir'
const LAST_KEY = 'lastBackupAt'

export function createDexieBackupMeta(): BackupMeta {
  // lazy so importing this module never opens a DB in unsupported browsers
  let db: MetaDB | null = null
  const getDb = () => (db ??= new MetaDB())

  return {
    async getDirHandle() {
      const row = await getDb().kv.get(DIR_KEY)
      return (row?.value as FileSystemDirectoryHandle | undefined) ?? null
    },
    async setDirHandle(handle) {
      await getDb().kv.put({ key: DIR_KEY, value: handle })
    },
    async getLastBackupAt() {
      const row = await getDb().kv.get(LAST_KEY)
      return typeof row?.value === 'string' ? row.value : null
    },
    async setLastBackupAt(iso) {
      await getDb().kv.put({ key: LAST_KEY, value: iso })
    },
    async clear() {
      await getDb().kv.bulkDelete([DIR_KEY, LAST_KEY])
    }
  }
}
