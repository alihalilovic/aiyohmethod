import { DATA_VERSION, normalizeData } from './schema.js'
import { dayKey } from './date.js'
import { getState, replaceAll } from './store.js'

const MAX_IMPORT_BYTES = 20 * 1024 * 1024 // 20 MB — far beyond any real log

export function buildBackup() {
  const s = getState()
  return {
    app: 'gtg-tracker',
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    exercises: s.exercises,
    sessions: s.sessions,
    gtg: s.gtg,
    settings: s.settings,
  }
}

/** Triggers a .json download. Returns the filename used. */
export function exportBackup() {
  const payload = buildBackup()
  const json = JSON.stringify(payload, null, 2)
  const filename = `gtg-backup-${dayKey()}.json`

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Safari needs the URL alive until the download has been picked up.
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
  return filename
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsText(file)
  })
}

const byId = (arr) => new Map(arr.map((x) => [x.id, x]))

/** Union of two lists by id; `incoming` wins on conflict. */
function mergeById(current, incoming) {
  const map = byId(current)
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}

function mergeSessions(current, incoming) {
  const map = byId(current)
  for (const session of incoming) {
    const existing = map.get(session.id)
    if (!existing) {
      map.set(session.id, session)
      continue
    }
    map.set(session.id, {
      ...existing,
      ...session,
      sets: mergeById(existing.sets, session.sets).sort((a, b) => a.at.localeCompare(b.at)),
    })
  }
  return [...map.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/**
 * Import a backup file.
 * @param {File} file
 * @param {'replace'|'merge'} mode
 * @returns {Promise<{mode:string, warnings:string[], added:{sessions:number,gtg:number,exercises:number}}>}
 */
export async function importBackup(file, mode = 'merge') {
  if (!file) throw new Error('No file selected.')
  if (file.size === 0) throw new Error('That file is empty.')
  if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is too large to be a backup.')

  const text = await readFileAsText(file)

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON. Pick a backup exported from this app.')
  }

  const { data: incoming, warnings } = normalizeData(parsed)

  if (incoming.sessions.length === 0 && incoming.gtg.length === 0) {
    warnings.push('The backup contained no sessions or GTG entries.')
  }

  const before = getState()

  if (mode === 'replace') {
    replaceAll(incoming)
  } else {
    replaceAll({
      version: DATA_VERSION,
      exercises: mergeById(before.exercises, incoming.exercises),
      sessions: mergeSessions(before.sessions, incoming.sessions),
      gtg: mergeById(before.gtg, incoming.gtg).sort((a, b) => a.at.localeCompare(b.at)),
      settings: { ...before.settings, ...incoming.settings },
    })
  }

  const after = getState()
  return {
    mode,
    warnings,
    added: {
      sessions: after.sessions.length - before.sessions.length,
      gtg: after.gtg.length - before.gtg.length,
      exercises: after.exercises.length - before.exercises.length,
    },
  }
}
