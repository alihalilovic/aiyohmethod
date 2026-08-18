import { useEffect, useMemo, useState } from 'react'
import {
  addSet,
  deleteSession,
  deleteSet,
  finishSession,
  reopenSession,
  sessionsForDay,
  startSession,
  useStore,
} from '../lib/store.js'
import { dayKey, formatClock, formatDuration, sessionDurationMs } from '../lib/date.js'
import { UNIT } from '../lib/schema.js'
import ConfirmModal from './ConfirmModal.jsx'
import RepStepper from './RepStepper.jsx'

/** Re-renders once a second so a running session's clock ticks. */
function useTicker(active) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [active])
}

export default function TodayView({ day }) {
  const exercises = useStore((s) => s.exercises)
  const allSessions = useStore((s) => s.sessions)
  const sessions = useMemo(() => sessionsForDay(allSessions, day), [allSessions, day])

  const activeSession = sessions.find((s) => !s.endedAt) || null
  useTicker(Boolean(activeSession))

  const [exerciseId, setExerciseId] = useState(() => exercises[0]?.id ?? '')
  const [reps, setReps] = useState(8)
  const [weight, setWeight] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)

  const exercise = useMemo(
    () => exercises.find((e) => e.id === exerciseId) || exercises[0],
    [exercises, exerciseId],
  )

  // Keep the selection valid when the exercise list changes.
  useEffect(() => {
    if (exercises.length && !exercises.some((e) => e.id === exerciseId)) {
      setExerciseId(exercises[0].id)
    }
  }, [exercises, exerciseId])

  // Default the weight box to the exercise's configured weight.
  useEffect(() => {
    setWeight(String(exercise?.defaultWeight ?? 0))
  }, [exercise?.id, exercise?.defaultWeight])

  const isToday = day === dayKey()
  const dayTotals = sessions.reduce(
    (acc, s) => {
      acc.sets += s.sets.length
      acc.reps += s.sets.reduce((a, b) => a + b.reps, 0)
      acc.ms += sessionDurationMs(s)
      return acc
    },
    { sets: 0, reps: 0, ms: 0 },
  )

  function handleAddSet(e) {
    e.preventDefault()
    setError('')
    try {
      addSet({
        sessionId: activeSession?.id,
        day,
        exerciseId: exercise.id,
        reps,
        weight: Number(weight) || 0,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  if (!exercises.length) {
    return <div className="empty">No exercises configured. Add one under Data.</div>
  }

  return (
    <>
      {sessions.length > 0 && (
        <div className="stat-grid">
          <div className="stat">
            <div className="v">{sessions.length}</div>
            <div className="k">Sessions</div>
          </div>
          <div className="stat">
            <div className="v">{dayTotals.sets}</div>
            <div className="k">Sets</div>
          </div>
          <div className="stat">
            <div className="v">{dayTotals.reps}</div>
            <div className="k">Reps</div>
          </div>
        </div>
      )}

      {/* Session control */}
      <div className="card">
        {activeSession ? (
          <>
            <div className="row between">
              <div>
                <div className="card-title">Session running</div>
                <div className="timer">
                  <span className="live" aria-hidden="true" />
                  {formatDuration(sessionDurationMs(activeSession))}
                </div>
              </div>
              <div className="muted" style={{ textAlign: 'right' }}>
                started
                <br />
                <strong>{formatClock(activeSession.startedAt)}</strong>
              </div>
            </div>
            <button
              type="button"
              className="btn block"
              onClick={() =>
                setConfirm({
                  title: 'Finish session?',
                  message: `${activeSession.sets.length} set(s) logged in ${formatDuration(
                    sessionDurationMs(activeSession),
                  )}.`,
                  confirmLabel: 'Finish',
                  destructive: false,
                  action: () => finishSession(activeSession.id),
                })
              }
            >
              Finish workout
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn primary block lg"
            onClick={() => startSession(day)}
            disabled={!isToday}
          >
            Start session
          </button>
        )}
        {!isToday && !activeSession && (
          <p className="muted">Sessions can only be started on today's date.</p>
        )}
      </div>

      {/* Add set */}
      {(isToday || activeSession) && (
        <form className="card" onSubmit={handleAddSet}>
          <h2 className="card-title">Log a set</h2>

          <div className="field">
            <label htmlFor="exercise">Exercise</label>
            <select
              id="exercise"
              className="select"
              value={exercise.id}
              onChange={(e) => setExerciseId(e.target.value)}
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          <div className="row">
            <RepStepper value={reps} onChange={setReps} label="Reps" />
            <div className="field" style={{ width: 108, flex: '0 0 108px' }}>
              <label htmlFor="weight">+{UNIT}</label>
              <input
                id="weight"
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>

          {error ? <div className="banner">{error}</div> : null}

          <button type="submit" className="btn primary block lg">
            Add set
          </button>
        </form>
      )}

      {/* Sessions */}
      {sessions.length === 0 ? (
        <div className="empty">No sets logged for this day.</div>
      ) : (
        sessions
          .slice()
          .reverse()
          .map((session, i) => {
            const totalReps = session.sets.reduce((a, b) => a + b.reps, 0)
            return (
              <div className="card" key={session.id}>
                <div className="session-head">
                  <div>
                    <div className="card-title">Session {sessions.length - i}</div>
                    <div className="when">
                      {formatClock(session.startedAt)} –{' '}
                      {session.endedAt ? formatClock(session.endedAt) : 'now'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="timer" style={{ fontSize: 22 }}>
                      {formatDuration(sessionDurationMs(session))}
                    </div>
                    <div className="when">
                      {session.sets.length} sets · {totalReps} reps
                    </div>
                  </div>
                </div>

                {session.sets.length === 0 ? (
                  <div className="empty">No sets yet.</div>
                ) : (
                  <div className="list">
                    {session.sets.map((set, idx) => (
                      <div className="item" key={set.id}>
                        <span className="idx">{idx + 1}</span>
                        <div className="grow">
                          <div className="name">{set.exerciseName}</div>
                          <div className="meta">
                            {formatClock(set.at)}
                            {set.weight > 0 ? ` · +${set.weight}${UNIT}` : ''}
                          </div>
                        </div>
                        <span className="reps">{set.reps}</span>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Delete set of ${set.reps} ${set.exerciseName}`}
                          onClick={() =>
                            setConfirm({
                              title: 'Delete set?',
                              message: `${set.reps} × ${set.exerciseName}${
                                set.weight > 0 ? ` @ +${set.weight}${UNIT}` : ''
                              }`,
                              confirmLabel: 'Delete',
                              action: () => deleteSet(session.id, set.id),
                            })
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="row">
                  {session.endedAt ? (
                    <button
                      type="button"
                      className="btn ghost grow"
                      onClick={() => reopenSession(session.id)}
                      disabled={Boolean(activeSession)}
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn grow"
                      onClick={() =>
                        setConfirm({
                          title: 'Finish session?',
                          message: `${session.sets.length} set(s) logged.`,
                          confirmLabel: 'Finish',
                          destructive: false,
                          action: () => finishSession(session.id),
                        })
                      }
                    >
                      Finish
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() =>
                      setConfirm({
                        title: 'Delete session?',
                        message: `This removes the session and its ${session.sets.length} set(s).`,
                        confirmLabel: 'Delete',
                        action: () => deleteSession(session.id),
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive !== false}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.action?.()
          setConfirm(null)
        }}
      />
    </>
  )
}
