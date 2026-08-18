# AIYOHMETHOD

Minimal, mobile-first workout logger + "Grease the Groove" rep counter.
React + Vite, no backend, no accounts. Everything lives in your browser's LocalStorage.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 — also served on your LAN IP for phone testing
npm run build    # production build into dist/
npm run preview  # serve dist/ locally
```

`npm run dev` prints a `Network:` URL. Open that on your iPhone (same Wi-Fi) to test on device.

## Install on iPhone (PWA)

The app must be served over **HTTPS or localhost** for the service worker to register — over a plain
LAN IP it still works, just without offline caching.

1. Build and host `dist/` anywhere static (Netlify, Vercel, GitHub Pages, `npx serve dist`).
2. Open the URL in **Safari** (not Chrome — only Safari can install on iOS).
3. Tap **Share → Add to Home Screen**.
4. Launch from the home screen: full screen, no browser chrome, works offline.

## Sections

| Tab | What it does |
| --- | --- |
| **Workout** | Start a session (start time recorded), log sets, finish it (end time + total duration). Multiple sessions per day are fine. Arrows in the header move between days. |
| **GTG** | Running daily tally per exercise. `+1 / +3 / +5 / +10` one-tap buttons plus a custom amount. Every entry is listed and individually deletable. |
| **Data** | Export/import JSON, manage the exercise list, theme, erase everything. |

Every delete goes through a confirmation modal. Weights are in **kg** throughout.

## Exercises

Defaults live in [`src/config/exercises.json`](src/config/exercises.json):

```json
{
  "id": "pull-ups",
  "name": "Pull ups",
  "category": "pull",
  "defaultWeight": 0,
  "gtg": true
}
```

- Every exercise can carry weight (vest, dumbbells) — there is no bodyweight-only flag.
  `defaultWeight` pre-fills the weight box; you can override it per set. Leave it at `0` for
  moves you normally do unloaded.
- `gtg: true` — shows the exercise on the GTG tab. Default: Push ups and Pull ups. Toggle any
  exercise on or off under **Data → Exercises**.
- `category` — one of the ids in the `categories` list at the top of the file.

Edits to this file only affect **new** installs — once data exists in LocalStorage, the stored
exercise list wins. Manage exercises in-app, or erase all data to pick up new defaults.

## Backup format

`Export JSON` downloads `gtg-backup-YYYY-MM-DD.json`:

```json
{
  "app": "gtg-tracker",
  "version": 1,
  "exportedAt": "2026-08-18T09:00:00.000Z",
  "exercises": [ ... ],
  "sessions": [ { "id": "...", "date": "2026-08-18", "startedAt": "...", "endedAt": "...", "sets": [ ... ] } ],
  "gtg": [ { "id": "...", "date": "2026-08-18", "exerciseId": "push-ups", "reps": 10, "at": "..." } ],
  "settings": { "theme": "system" }
}
```

Import has two modes:

- **Merge** (default) — union by record id; the file wins on conflicts. Re-importing the same
  backup changes nothing.
- **Replace** — wipes what's stored and restores the file exactly. Asks for confirmation first.

Malformed input is handled rather than trusted: non-JSON, empty, oversized, or wrong-shaped files
are rejected with a readable message, and individual unreadable records are skipped and reported
instead of aborting the whole import.

## Structure

```
src/
  config/exercises.json   default exercise list + categories
  lib/date.js             day keys, clock and duration formatting
  lib/schema.js           data shape, defaults, normalizer/repair
  lib/store.js            LocalStorage-backed store, actions, selectors
  lib/backup.js           export + import (merge/replace)
  components/             TodayView, GtgView, SettingsView, ConfirmModal, RepStepper
  App.jsx                 tabs, day navigation, theme
public/
  manifest.webmanifest    PWA manifest
  sw.js                   app-shell cache for offline use
  icons/                  generated PNG icons
```
