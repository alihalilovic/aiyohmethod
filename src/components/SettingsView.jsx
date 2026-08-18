import { useMemo, useRef, useState } from 'react'
import {
  deleteExercise,
  resetAll,
  computeStats,
  setSetting,
  toggleGtgExercise,
  upsertExercise,
  useStore,
  getStorageAvailable,
} from '../lib/store.js'
import { CATEGORIES, UNIT } from '../lib/schema.js'
import { exportBackup, importBackup } from '../lib/backup.js'
import ConfirmModal from './ConfirmModal.jsx'

const BLANK = { name: '', category: 'push', defaultWeight: 0, gtg: false }

export default function SettingsView() {
  const exercises = useStore((s) => s.exercises)
  const settings = useStore((s) => s.settings)
  const sessions = useStore((s) => s.sessions)
  const gtg = useStore((s) => s.gtg)
  const stats = useMemo(() => computeStats(sessions, gtg), [sessions, gtg])

  const fileRef = useRef(null)
  const [importMode, setImportMode] = useState('merge')
  const [status, setStatus] = useState(null) // { kind: 'ok'|'error', text }
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)

  function handleExport() {
    try {
      const name = exportBackup()
      setStatus({ kind: 'ok', text: `Exported ${name}` })
    } catch (err) {
      setStatus({ kind: 'error', text: `Export failed: ${err.message}` })
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return

    setBusy(true)
    setStatus(null)
    try {
      const result = await importBackup(file, importMode)
      const parts = [
        result.mode === 'replace' ? 'Replaced all data.' : 'Merged backup.',
        `+${result.added.sessions} session(s)`,
        `+${result.added.gtg} GTG entr(ies)`,
        `+${result.added.exercises} exercise(s)`,
      ]
      setStatus({ kind: 'ok', text: `${parts.join(' ')}${
        result.warnings.length ? ` — ${result.warnings.join(' ')}` : ''
      }` })
    } catch (err) {
      setStatus({ kind: 'error', text: `Import failed: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  function handleAddExercise(e) {
    e.preventDefault()
    try {
      upsertExercise(draft)
      setDraft(BLANK)
      setStatus({ kind: 'ok', text: `Added ${draft.name}.` })
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    }
  }

  return (
    <>
      {!getStorageAvailable() && (
        <div className="banner">
          Browser storage is unavailable — data will be lost when you close this tab. Export a
          backup before leaving.
        </div>
      )}

      {status && (
        <div className={status.kind === 'ok' ? 'banner ok' : 'banner'}>{status.text}</div>
      )}

      <div className="stat-grid">
        <div className="stat">
          <div className="v">{stats.days}</div>
          <div className="k">Days</div>
        </div>
        <div className="stat">
          <div className="v">{stats.sets}</div>
          <div className="k">Sets</div>
        </div>
        <div className="stat">
          <div className="v">{stats.reps + stats.gtgReps}</div>
          <div className="k">Total reps</div>
        </div>
      </div>

      {/* Backup */}
      <div className="card">
        <h2 className="card-title">Backup</h2>
        <button type="button" className="btn primary block lg" onClick={handleExport}>
          Export JSON
        </button>

        <div className="field">
          <label>On import</label>
          <div className="seg">
            <button
              type="button"
              aria-pressed={importMode === 'merge'}
              onClick={() => setImportMode('merge')}
            >
              Merge
            </button>
            <button
              type="button"
              aria-pressed={importMode === 'replace'}
              onClick={() => setImportMode('replace')}
            >
              Replace
            </button>
          </div>
          <p className="muted">
            {importMode === 'merge'
              ? 'Keeps what you have and adds anything missing from the file.'
              : 'Wipes current data and restores exactly what is in the file.'}
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn block lg"
          disabled={busy}
          onClick={() => {
            if (importMode === 'replace') {
              setConfirm({
                title: 'Replace all data?',
                message: 'Everything currently stored will be overwritten by the file you pick.',
                confirmLabel: 'Pick file',
                action: () => fileRef.current?.click(),
              })
            } else {
              fileRef.current?.click()
            }
          }}
        >
          {busy ? 'Importing…' : 'Import JSON'}
        </button>
      </div>

      {/* Exercises */}
      <div className="card">
        <h2 className="card-title">Exercises</h2>
        <div className="list">
          {exercises.map((ex) => (
            <div className="item" key={ex.id}>
              <div className="grow">
                <div className="name">{ex.name}</div>
                <div className="meta">
                  {CATEGORIES.find((c) => c.id === ex.category)?.label || ex.category}
                  {` · default +${ex.defaultWeight}${UNIT}`}
                </div>
              </div>
              <button
                type="button"
                className="btn ghost"
                style={{
                  minHeight: 40,
                  padding: '0 10px',
                  fontSize: 11,
                  borderColor: ex.gtg ? 'var(--red)' : undefined,
                  color: ex.gtg ? 'var(--red)' : undefined,
                }}
                aria-pressed={ex.gtg}
                onClick={() => toggleGtgExercise(ex.id)}
              >
                GTG {ex.gtg ? 'on' : 'off'}
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete ${ex.name}`}
                onClick={() =>
                  setConfirm({
                    title: `Delete ${ex.name}?`,
                    message: 'Sets already logged keep their name and stay in your history.',
                    confirmLabel: 'Delete',
                    action: () => deleteExercise(ex.id),
                  })
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <form className="card flat" onSubmit={handleAddExercise}>
          <h3 className="card-title">Add exercise</h3>
          <div className="field">
            <label htmlFor="ex-name">Name</label>
            <input
              id="ex-name"
              className="input"
              value={draft.name}
              placeholder="e.g. Ring rows"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="row">
            <div className="field grow">
              <label htmlFor="ex-cat">Category</label>
              <select
                id="ex-cat"
                className="select"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 108, flex: '0 0 108px' }}>
              <label htmlFor="ex-weight">Default +{UNIT}</label>
              <input
                id="ex-weight"
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={draft.defaultWeight}
                onChange={(e) => setDraft({ ...draft, defaultWeight: e.target.value })}
              />
            </div>
          </div>
          <label className="row" style={{ fontSize: 14, fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={draft.gtg}
              style={{ width: 22, height: 22 }}
              onChange={(e) => setDraft({ ...draft, gtg: e.target.checked })}
            />
            Track in GTG
          </label>
          <button type="submit" className="btn block" disabled={!draft.name.trim()}>
            Add exercise
          </button>
        </form>
      </div>

      {/* Preferences */}
      <div className="card">
        <h2 className="card-title">Preferences</h2>
        <div className="field">
          <label>Theme</label>
          <div className="seg">
            {['light', 'dark', 'system'].map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={settings.theme === t}
                onClick={() => setSetting('theme', t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card">
        <h2 className="card-title">Danger zone</h2>
        <button
          type="button"
          className="btn danger block"
          onClick={() =>
            setConfirm({
              title: 'Erase everything?',
              message:
                'Deletes every session, set and GTG entry on this device, and restores the default exercise list. Export a backup first if you want to keep it.',
              confirmLabel: 'Erase all',
              action: () => {
                resetAll()
                setStatus({ kind: 'ok', text: 'All data erased.' })
              },
            })
          }
        >
          Erase all data
        </button>
      </div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.action?.()
          setConfirm(null)
        }}
      />
    </>
  )
}
