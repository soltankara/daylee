import { useStore } from '../store/useStore'
import { download, downloadJsonExport } from '../lib/download'
import { tasksToCsv } from '../lib/csv'
import { fmtTime, todayISO } from '../lib/dates'
import {
  SNAPSHOT_KEEP,
  backupNow,
  chooseBackupFolder,
  disableBackup,
  resumeBackup,
  useBackupStore
} from '../lib/backup'

export function Settings() {
  const tasks = useStore((s) => s.tasks)
  const setView = useStore((s) => s.setView)
  const archiveDone = useStore((s) => s.archiveDone)
  const importTasks = useStore((s) => s.importTasks)
  const showToast = useStore((s) => s.showToast)

  const backup = useBackupStore()

  const doneN = tasks.filter((t) => t.status === 'done').length
  const archivedN = tasks.filter((t) => t.archived).length

  const exportJson = () => downloadJsonExport(tasks)

  const turnOffBackup = () => {
    void disableBackup().then(() => showToast('Auto-backup turned off'))
  }

  const exportCsv = () => {
    download(`daylee-export-${todayISO()}.csv`, tasksToCsv(tasks), 'text/csv')
  }

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const input = e.target
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const n = await importTasks(String(reader.result))
        showToast(`Imported ${n} task${n === 1 ? '' : 's'}`)
      } catch {
        showToast('Import failed — not a Daylee JSON file')
      }
      input.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <a
        href="#list"
        className="back-link"
        onClick={(e) => {
          e.preventDefault()
          setView('list')
        }}
      >
        ← back
      </a>
      <h1 className="page-title">Export &amp; data</h1>
      <div className="page-subtitle">
        {tasks.length} tasks · {doneN} done · {archivedN} archived · stored in this browser
      </div>

      <section className="settings-section">
        <div className="settings-section-title">Export</div>
        <p>Your data is yours. Download everything at any time.</p>
        <div className="settings-actions">
          <button className="btn-primary" onClick={exportJson}>
            download .json
          </button>
          <button className="btn-secondary" onClick={exportCsv}>
            download .csv
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">Backup</div>
        {backup.status === 'unsupported' && (
          <p>Auto-backup isn’t supported in this browser — use the manual export above.</p>
        )}
        {backup.status === 'off' && (
          <>
            <p>
              Pick a folder and Daylee keeps a live daylee.json there, plus the last{' '}
              {SNAPSHOT_KEEP} daily snapshots.
            </p>
            <div className="settings-actions">
              <button className="btn-primary" onClick={() => void chooseBackupFolder()}>
                choose backup folder
              </button>
            </div>
          </>
        )}
        {backup.status === 'ready' && (
          <>
            <p>
              Backing up to “{backup.folderName}”
              {backup.lastBackupAt && <> · last backup {fmtTime(backup.lastBackupAt)}</>}
            </p>
            <div className="settings-actions">
              <button className="btn-primary" onClick={() => void backupNow()}>
                back up now
              </button>
              <button className="btn-secondary" onClick={() => void chooseBackupFolder()}>
                change folder
              </button>
              <button className="btn-secondary" onClick={turnOffBackup}>
                turn off
              </button>
            </div>
          </>
        )}
        {backup.status === 'paused' && (
          <>
            <p>Paused — Daylee needs permission to write to “{backup.folderName}”.</p>
            <div className="settings-actions">
              <button className="btn-primary" onClick={() => void resumeBackup()}>
                resume backups
              </button>
              <button className="btn-secondary" onClick={() => void chooseBackupFolder()}>
                choose a different folder
              </button>
              <button className="btn-secondary" onClick={turnOffBackup}>
                turn off
              </button>
            </div>
          </>
        )}
        {backup.status === 'error' && (
          <>
            <p>Last backup failed — it will retry on the next change.</p>
            <div className="settings-actions">
              <button className="btn-primary" onClick={() => void backupNow()}>
                back up now
              </button>
              <button className="btn-secondary" onClick={() => void chooseBackupFolder()}>
                change folder
              </button>
              <button className="btn-secondary" onClick={turnOffBackup}>
                turn off
              </button>
            </div>
          </>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-title">Import</div>
        <p>Bring a Daylee JSON export back. Tasks merge by id — the newer copy of each task wins.</p>
        <input
          className="import-input"
          type="file"
          accept=".json,application/json"
          onChange={onImport}
          aria-label="Import JSON file"
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-title">Housekeeping</div>
        <p>Archiving clears done tasks from the main list. They stay in the Done log forever.</p>
        <button className="btn-secondary" onClick={archiveDone}>
          archive all done tasks
        </button>
      </section>
    </div>
  )
}
