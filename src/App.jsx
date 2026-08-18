import { useEffect, useState } from 'react'
import Logo from './components/Logo.jsx'
import TodayView from './components/TodayView.jsx'
import GtgView from './components/GtgView.jsx'
import SettingsView from './components/SettingsView.jsx'
import { useStore } from './lib/store.js'
import { dayKey, formatDayLong, shiftDay } from './lib/date.js'

const TABS = [
  { id: 'today', label: 'Workout', glyph: '▤' },
  { id: 'gtg', label: 'GTG', glyph: '⚡' },
  { id: 'data', label: 'Data', glyph: '⚙' },
]

/** Applies the theme preference to <html>, following the OS when set to "system". */
function useTheme(preference) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0d0d0d' : '#ffffff')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [preference])
}

/** Rolls the displayed day over at midnight while the app stays open. */
function useMidnightRollover(day, setDay) {
  useEffect(() => {
    const id = setInterval(() => {
      const today = dayKey()
      setDay((current) => (current === day && current !== today ? today : current))
    }, 30000)
    return () => clearInterval(id)
  }, [day, setDay])
}

export default function App() {
  const [tab, setTab] = useState('today')
  const [day, setDay] = useState(dayKey)
  const theme = useStore((s) => s.settings.theme)

  useTheme(theme)
  useMidnightRollover(day, setDay)

  const isToday = day === dayKey()
  const showDayNav = tab !== 'data'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span className="brand-name">AIYOHMETHOD</span>
        </div>

        <div className="topbar-row">
          <h1>{tab === 'gtg' ? 'Grease the Groove' : tab === 'data' ? 'Data' : 'Workout'}</h1>
          {showDayNav && <div className="sub">{formatDayLong(day)}</div>}
        </div>

        {showDayNav && (
          <div className="day-nav">
            <button type="button" aria-label="Previous day" onClick={() => setDay((d) => shiftDay(d, -1))}>
              ‹
            </button>
            <button
              type="button"
              className={isToday ? undefined : 'active'}
              onClick={() => setDay(dayKey())}
              disabled={isToday}
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => setDay((d) => shiftDay(d, 1))}
            >
              ›
            </button>
          </div>
        )}
      </header>

      <main className="main">
        {tab === 'today' && <TodayView day={day} />}
        {tab === 'gtg' && <GtgView day={day} />}
        {tab === 'data' && <SettingsView />}
      </main>

      <nav className="nav" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="glyph" aria-hidden="true">
              {t.glyph}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
