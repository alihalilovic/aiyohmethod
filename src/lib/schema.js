import exerciseConfig from '../config/exercises.json'
import { dayKey, isValidDayKey } from './date.js'

export const DATA_VERSION = 1
export const STORAGE_KEY = 'gtg-tracker:v1'

export const CATEGORIES = exerciseConfig.categories
export const UNIT = exerciseConfig.unit

export function defaultExercises() {
  return exerciseConfig.exercises.map((e) => ({ ...e }))
}

export function emptyData() {
  return {
    version: DATA_VERSION,
    exercises: defaultExercises(),
    sessions: [],
    gtg: [],
    settings: { theme: 'system' },
  }
}

export function makeId(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

const num = (v, fallback = 0) => {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : fallback
}

const str = (v, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback)

const iso = (v, fallback = null) => {
  if (typeof v !== 'string') return fallback
  const t = new Date(v)
  return Number.isNaN(t.getTime()) ? fallback : t.toISOString()
}

function normalizeExercise(raw, seenIds) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name)
  if (!name) return null
  let id = str(raw.id) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!id) return null
  while (seenIds.has(id)) id = `${id}-2`
  seenIds.add(id)
  const category = CATEGORIES.some((c) => c.id === raw.category) ? raw.category : 'push'
  return {
    id,
    name,
    category,
    defaultWeight: Math.max(0, num(raw.defaultWeight, 0)),
    gtg: raw.gtg === true,
  }
}

function normalizeSet(raw, exerciseIndex) {
  if (!raw || typeof raw !== 'object') return null
  const reps = Math.round(num(raw.reps, NaN))
  if (!Number.isFinite(reps) || reps <= 0) return null
  const exerciseId = str(raw.exerciseId)
  const known = exerciseIndex.get(exerciseId)
  return {
    id: str(raw.id) || makeId('set'),
    exerciseId,
    exerciseName: str(raw.exerciseName) || known?.name || exerciseId || 'Unknown',
    reps,
    weight: Math.max(0, num(raw.weight, 0)),
    at: iso(raw.at) || new Date().toISOString(),
  }
}

function normalizeSession(raw, exerciseIndex) {
  if (!raw || typeof raw !== 'object') return null
  const startedAt = iso(raw.startedAt)
  if (!startedAt) return null
  const date = isValidDayKey(raw.date) ? raw.date : dayKey(new Date(startedAt))
  const endedAt = iso(raw.endedAt)
  const sets = Array.isArray(raw.sets)
    ? raw.sets.map((s) => normalizeSet(s, exerciseIndex)).filter(Boolean)
    : []
  return {
    id: str(raw.id) || makeId('ses'),
    date,
    startedAt,
    endedAt: endedAt && new Date(endedAt) >= new Date(startedAt) ? endedAt : null,
    sets,
  }
}

function normalizeGtgEntry(raw, exerciseIndex) {
  if (!raw || typeof raw !== 'object') return null
  const reps = Math.round(num(raw.reps, NaN))
  if (!Number.isFinite(reps) || reps <= 0) return null
  const at = iso(raw.at) || new Date().toISOString()
  const exerciseId = str(raw.exerciseId)
  const known = exerciseIndex.get(exerciseId)
  return {
    id: str(raw.id) || makeId('gtg'),
    date: isValidDayKey(raw.date) ? raw.date : dayKey(new Date(at)),
    exerciseId,
    exerciseName: str(raw.exerciseName) || known?.name || exerciseId || 'Unknown',
    reps,
    weight: Math.max(0, num(raw.weight, 0)),
    at,
  }
}

/**
 * Coerce arbitrary parsed JSON into a valid data object.
 * Throws only when the payload is not an object at all; anything
 * else is repaired field by field and reported through `warnings`.
 */
export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('File does not contain a workout backup object.')
  }

  const warnings = []
  const base = emptyData()

  // Exercises: fall back to defaults if the list is missing or unusable.
  const seenIds = new Set()
  let exercises = Array.isArray(raw.exercises)
    ? raw.exercises.map((e) => normalizeExercise(e, seenIds)).filter(Boolean)
    : []
  if (exercises.length === 0) {
    exercises = base.exercises
    if (Array.isArray(raw.exercises) && raw.exercises.length > 0) {
      warnings.push('Exercise list was unreadable — restored the default exercises.')
    }
  }
  const exerciseIndex = new Map(exercises.map((e) => [e.id, e]))

  const rawSessions = Array.isArray(raw.sessions) ? raw.sessions : []
  const sessions = rawSessions.map((s) => normalizeSession(s, exerciseIndex)).filter(Boolean)
  if (sessions.length !== rawSessions.length) {
    warnings.push(`Skipped ${rawSessions.length - sessions.length} unreadable session(s).`)
  }

  const rawGtg = Array.isArray(raw.gtg) ? raw.gtg : []
  const gtg = rawGtg.map((g) => normalizeGtgEntry(g, exerciseIndex)).filter(Boolean)
  if (gtg.length !== rawGtg.length) {
    warnings.push(`Skipped ${rawGtg.length - gtg.length} unreadable GTG entr(ies).`)
  }

  const rawSettings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {}
  const settings = {
    theme: ['light', 'dark', 'system'].includes(rawSettings.theme)
      ? rawSettings.theme
      : base.settings.theme,
  }

  return {
    data: { version: DATA_VERSION, exercises, sessions, gtg, settings },
    warnings,
  }
}
