import { useCallback, useRef, useSyncExternalStore } from 'react'
import { STORAGE_KEY, emptyData, makeId, normalizeData } from './schema.js'
import { dayKey } from './date.js'

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function loadFromStorage() {
  let raw
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private mode / storage disabled — run in memory for this session.
    return { data: emptyData(), storageAvailable: false }
  }
  if (!raw) return { data: emptyData(), storageAvailable: true }
  try {
    const { data } = normalizeData(JSON.parse(raw))
    return { data, storageAvailable: true }
  } catch (err) {
    console.error('Saved data was corrupt, starting fresh.', err)
    try {
      localStorage.setItem(`${STORAGE_KEY}:corrupt-backup`, raw)
    } catch {
      /* best effort only */
    }
    return { data: emptyData(), storageAvailable: true }
  }
}

const boot = loadFromStorage()
let state = boot.data
let storageAvailable = boot.storageAvailable
let lastError = null

const listeners = new Set()

function persist() {
  if (!storageAvailable) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    storageAvailable = false
    lastError = 'Could not save to this browser. Storage may be full or disabled.'
    console.error('Persist failed', err)
  }
}

function commit(next) {
  state = next
  persist()
  listeners.forEach((l) => l())
}

/** Apply a pure updater to the current state. */
function update(fn) {
  commit(fn(state))
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getState = () => state
export const getStorageAvailable = () => storageAvailable
export const getLastError = () => lastError

/**
 * Subscribe to a slice of state.
 *
 * The selected value is cached against the state object and the selector
 * identity, so a selector that builds a new array or object still returns the
 * same reference for every call within one render. Without that, React sees a
 * changing snapshot and re-renders forever.
 */
export function useStore(selector = (s) => s) {
  const selectorRef = useRef(selector)
  selectorRef.current = selector

  const cacheRef = useRef({ state: null, selector: null, value: undefined })

  const getSnapshot = useCallback(() => {
    const cache = cacheRef.current
    if (cache.state === state && cache.selector === selectorRef.current) return cache.value
    const value = selectorRef.current(state)
    cacheRef.current = { state, selector: selectorRef.current, value }
    return value
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/* Keep multiple open tabs in sync. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || e.newValue == null) return
    try {
      const { data } = normalizeData(JSON.parse(e.newValue))
      state = data
      listeners.forEach((l) => l())
    } catch {
      /* ignore a bad write from another tab */
    }
  })
}

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

/* Derived data. These take raw arrays rather than the whole state so callers
   can memoize them on the exact slice they depend on. */

export const sessionsForDay = (sessions, day) =>
  sessions.filter((x) => x.date === day).sort((a, b) => a.startedAt.localeCompare(b.startedAt))

export const activeSession = (sessions) => sessions.find((x) => !x.endedAt) || null

export const gtgForDay = (gtg, day) =>
  gtg.filter((g) => g.date === day).sort((a, b) => b.at.localeCompare(a.at))

export function gtgTotalsForDay(gtg, day) {
  const totals = new Map()
  for (const entry of gtg) {
    if (entry.date !== day) continue
    const prev = totals.get(entry.exerciseId) || { reps: 0, count: 0 }
    totals.set(entry.exerciseId, {
      name: entry.exerciseName,
      reps: prev.reps + entry.reps,
      count: prev.count + 1,
    })
  }
  return totals
}

export function computeStats(sessions, gtg) {
  const sets = sessions.reduce((acc, x) => acc + x.sets.length, 0)
  const reps = sessions.reduce((acc, x) => acc + x.sets.reduce((a, b) => a + b.reps, 0), 0)
  const gtgReps = gtg.reduce((acc, g) => acc + g.reps, 0)
  const days = new Set([...sessions.map((x) => x.date), ...gtg.map((g) => g.date)])
  return { sessions: sessions.length, sets, reps, gtgEntries: gtg.length, gtgReps, days: days.size }
}

/* ------------------------------------------------------------------ */
/* Actions — sessions                                                  */
/* ------------------------------------------------------------------ */

export function startSession(day = dayKey()) {
  let created = null
  update((s) => {
    const active = s.sessions.find((x) => !x.endedAt)
    if (active) {
      created = active
      return s
    }
    created = {
      id: makeId('ses'),
      date: day,
      startedAt: new Date().toISOString(),
      endedAt: null,
      sets: [],
    }
    return { ...s, sessions: [...s.sessions, created] }
  })
  return created
}

export function finishSession(sessionId) {
  update((s) => ({
    ...s,
    sessions: s.sessions.map((x) =>
      x.id === sessionId && !x.endedAt ? { ...x, endedAt: new Date().toISOString() } : x,
    ),
  }))
}

export function reopenSession(sessionId) {
  update((s) => ({
    ...s,
    sessions: s.sessions.map((x) => (x.id === sessionId ? { ...x, endedAt: null } : x)),
  }))
}

export function deleteSession(sessionId) {
  update((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== sessionId) }))
}

/** Adds a set to the given session; starts one for `day` when there is none. */
export function addSet({ sessionId, day = dayKey(), exerciseId, reps, weight }) {
  const repCount = Math.round(Number(reps))
  if (!Number.isFinite(repCount) || repCount <= 0) {
    throw new Error('Reps must be a positive number.')
  }

  let targetId = sessionId
  if (!targetId) {
    const active = state.sessions.find((x) => !x.endedAt && x.date === day)
    targetId = active ? active.id : startSession(day).id
  }

  update((s) => {
    const exercise = s.exercises.find((e) => e.id === exerciseId)
    const set = {
      id: makeId('set'),
      exerciseId,
      exerciseName: exercise?.name || exerciseId,
      reps: repCount,
      weight: Math.max(0, Number(weight) || 0),
      at: new Date().toISOString(),
    }
    return {
      ...s,
      sessions: s.sessions.map((x) => (x.id === targetId ? { ...x, sets: [...x.sets, set] } : x)),
    }
  })
  return targetId
}

export function deleteSet(sessionId, setId) {
  update((s) => ({
    ...s,
    sessions: s.sessions.map((x) =>
      x.id === sessionId ? { ...x, sets: x.sets.filter((st) => st.id !== setId) } : x,
    ),
  }))
}

/* ------------------------------------------------------------------ */
/* Actions — GTG                                                       */
/* ------------------------------------------------------------------ */

export function addGtg({ exerciseId, reps, weight = 0, day = dayKey() }) {
  const repCount = Math.round(Number(reps))
  if (!Number.isFinite(repCount) || repCount <= 0) {
    throw new Error('Reps must be a positive number.')
  }
  update((s) => {
    const exercise = s.exercises.find((e) => e.id === exerciseId)
    const entry = {
      id: makeId('gtg'),
      date: day,
      exerciseId,
      exerciseName: exercise?.name || exerciseId,
      reps: repCount,
      weight: Math.max(0, Number(weight) || 0),
      at: new Date().toISOString(),
    }
    return { ...s, gtg: [...s.gtg, entry] }
  })
}

export function deleteGtg(entryId) {
  update((s) => ({ ...s, gtg: s.gtg.filter((g) => g.id !== entryId) }))
}

export function clearGtgForDay(day) {
  update((s) => ({ ...s, gtg: s.gtg.filter((g) => g.date !== day) }))
}

/* ------------------------------------------------------------------ */
/* Actions — exercises & settings                                      */
/* ------------------------------------------------------------------ */

export function upsertExercise(exercise) {
  const name = String(exercise.name || '').trim()
  if (!name) throw new Error('Exercise needs a name.')
  update((s) => {
    const existing = exercise.id && s.exercises.find((e) => e.id === exercise.id)
    if (existing) {
      return {
        ...s,
        exercises: s.exercises.map((e) => (e.id === exercise.id ? { ...e, ...exercise, name } : e)),
      }
    }
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || makeId('ex')
    while (s.exercises.some((e) => e.id === id)) id = `${id}-2`
    return {
      ...s,
      exercises: [
        ...s.exercises,
        {
          id,
          name,
          category: exercise.category || 'push',
          defaultWeight: Math.max(0, Number(exercise.defaultWeight) || 0),
          gtg: exercise.gtg === true,
        },
      ],
    }
  })
}

export function deleteExercise(exerciseId) {
  update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== exerciseId) }))
}

export function toggleGtgExercise(exerciseId) {
  update((s) => ({
    ...s,
    exercises: s.exercises.map((e) => (e.id === exerciseId ? { ...e, gtg: !e.gtg } : e)),
  }))
}

export function setSetting(key, value) {
  update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }))
}

/* ------------------------------------------------------------------ */
/* Actions — bulk data                                                 */
/* ------------------------------------------------------------------ */

export function replaceAll(data) {
  commit(data)
}

export function resetAll() {
  commit(emptyData())
}
