/** Local-timezone date helpers. All day keys are 'YYYY-MM-DD' in the user's own timezone. */

export function dayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isValidDayKey(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

export function shiftDay(key, deltaDays) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return dayKey(dt)
}

export function formatDayLong(key) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = dayKey()
  if (key === today) return 'Today'
  if (key === shiftDay(today, -1)) return 'Yesterday'
  if (key === shiftDay(today, 1)) return 'Tomorrow'
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatClock(iso) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** ms -> "1h 04m" / "12m 30s" / "45s" */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function sessionDurationMs(session, now = Date.now()) {
  if (!session?.startedAt) return 0
  const start = new Date(session.startedAt).getTime()
  if (Number.isNaN(start)) return 0
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now
  if (Number.isNaN(end)) return 0
  return Math.max(0, end - start)
}
