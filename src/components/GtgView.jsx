import { useEffect, useMemo, useState } from 'react'
import { addGtg, clearGtgForDay, deleteGtg, gtgForDay, gtgTotalsForDay, useStore } from '../lib/store.js'
import { formatClock } from '../lib/date.js'
import { UNIT } from '../lib/schema.js'
import ConfirmModal from './ConfirmModal.jsx'

const QUICK_STEPS = [1, 3, 5, 10]

export default function GtgView({ day }) {
  const allExercises = useStore((s) => s.exercises)
  const allGtg = useStore((s) => s.gtg)
  const entries = useMemo(() => gtgForDay(allGtg, day), [allGtg, day])
  const totals = useMemo(() => gtgTotalsForDay(allGtg, day), [allGtg, day])

  const gtgExercises = useMemo(() => allExercises.filter((e) => e.gtg), [allExercises])

  const [custom, setCustom] = useState({})
  const [confirm, setConfirm] = useState(null)

  // Seed each tracked exercise's custom input once it appears.
  useEffect(() => {
    setCustom((prev) => {
      const missing = gtgExercises.filter((ex) => prev[ex.id] === undefined)
      if (missing.length === 0) return prev
      const next = { ...prev }
      for (const ex of missing) next[ex.id] = 8
      return next
    })
  }, [gtgExercises])

  const dayTotal = [...totals.values()].reduce((a, b) => a + b.reps, 0)

  if (gtgExercises.length === 0) {
    return (
      <div className="empty">
        No exercises are marked for GTG. Turn one on under Data → Exercises.
      </div>
    )
  }

  return (
    <>
      <div className="tally">
        {gtgExercises.map((ex) => {
          const t = totals.get(ex.id) || { reps: 0, count: 0 }
          const value = custom[ex.id] ?? 8
          return (
            <div className="tally-card" key={ex.id}>
              <div className="top">
                <div>
                  <div className="label">{ex.name}</div>
                  <div className="muted">
                    {t.count} set{t.count === 1 ? '' : 's'} today
                  </div>
                </div>
                <div className="total">{t.reps}</div>
              </div>

              <div className="quick">
                {QUICK_STEPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      addGtg({
                        exerciseId: ex.id,
                        reps: n,
                        weight: ex.defaultWeight,
                        day,
                      })
                    }
                  >
                    +{n}
                  </button>
                ))}
              </div>

              <div className="row">
                <input
                  className="input grow"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="999"
                  aria-label={`Custom reps for ${ex.name}`}
                  value={value}
                  onChange={(e) =>
                    setCustom((p) => ({
                      ...p,
                      [ex.id]: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                />
                <button
                  type="button"
                  className="btn primary"
                  disabled={!Number.isFinite(Number(value)) || Number(value) <= 0}
                  onClick={() => {
                    try {
                      addGtg({
                        exerciseId: ex.id,
                        reps: Number(value),
                        weight: ex.defaultWeight,
                        day,
                      })
                    } catch {
                      /* guarded by the disabled state above */
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card flat">
        <div className="row between">
          <h2 className="card-title">Entries · {dayTotal} reps total</h2>
          {entries.length > 0 && (
            <button
              type="button"
              className="btn danger"
              style={{ minHeight: 40, padding: '0 10px', fontSize: 12 }}
              onClick={() =>
                setConfirm({
                  title: 'Clear the day?',
                  message: `Deletes all ${entries.length} GTG entr${
                    entries.length === 1 ? 'y' : 'ies'
                  } for this day.`,
                  confirmLabel: 'Clear all',
                  action: () => clearGtgForDay(day),
                })
              }
            >
              Clear day
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="empty">Nothing logged yet. Tap a quick button above.</div>
        ) : (
          <div className="list">
            {entries.map((entry) => (
              <div className="item" key={entry.id}>
                <div className="grow">
                  <div className="name">{entry.exerciseName}</div>
                  <div className="meta">
                    {formatClock(entry.at)}
                    {entry.weight > 0 ? ` · +${entry.weight}${UNIT}` : ''}
                  </div>
                </div>
                <span className="reps">+{entry.reps}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Delete ${entry.reps} ${entry.exerciseName}`}
                  onClick={() =>
                    setConfirm({
                      title: 'Delete entry?',
                      message: `+${entry.reps} ${entry.exerciseName} at ${formatClock(entry.at)}`,
                      confirmLabel: 'Delete',
                      action: () => deleteGtg(entry.id),
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
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
