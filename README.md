# Ironman Trainer

A 32-week Ironman training plan for **Ironman New Zealand, Taupō — Saturday 6 March 2027**,
built as a single self-contained HTML file. No build step, no dependencies, no server:
open the file and it runs. All training data lives in the browser's `localStorage`
on the device it was logged on.

Live site: <https://ryanlemmens66.github.io/Ironman-Trainer/>

---

## Files

| File | What it is |
| --- | --- |
| `Ironman Trainer.html` | **The app.** The single source of truth — everything is edited here. |
| `index.html` | Redirect so the bare Pages URL opens the app (the app filename contains a space). |
| `sw.js` | Service worker. Network-first, cache fallback, so the app opens with no signal. |
| `releases/` | Frozen, verified copies of each edition. Never edited after release. |
| `tools/check.mjs` | Integrity checker. Run it before every release. |
| `.nojekyll` | Stops GitHub Pages from running Jekyll over the files. |

## Editing an edition

1. Edit `Ironman Trainer.html` only. Do not edit anything in `releases/` — those are the
   fallbacks you restore from if an edit goes wrong.
2. Run the checker: `node tools/check.mjs`
3. Bump `APP_VERSION` (search for `var APP_VERSION`) and the `CACHE` name in `sw.js`.
   The cache name must change or returning devices can sit on the old copy longer than
   they should.
4. Add a line to `CHANGELOG.md`.
5. Freeze the snapshot: `cp "Ironman Trainer.html" releases/ironman-trainer-vX.Y.html`
6. Commit both, push to `main`. GitHub Pages publishes within a minute or so.

Rolling back is a file copy: `cp releases/ironman-trainer-v2.8.html "Ironman Trainer.html"`.

## What the checker verifies

`node tools/check.mjs` (no dependencies, needs Node 18+) fails the build on:

- a syntax error in any inline `<script>`, or invalid JSON in the inline PWA manifest
- the plan not being 32 weeks of 7 days, or week numbering being out of order
- **any day whose `date` label has drifted off the calendar** — dates must run
  consecutively from Mon 27 Jul 2026, and race day must land on week 32, Saturday, 06 Mar
- **`planDayOffset()` returning the wrong day for any date in the plan, in NZ time** —
  this is the daylight-saving regression test; see below
- a session whose first line is not a discipline heading (it would render as one
  untickable grey block)
- a race projection that trusts a session whose distance and time contradict
  its own logged speed or pace, or that lets one outlier decide a leg
- an inline `onclick` calling a function that does not exist
- duplicate element ids in the static markup
- `sw.js` precaching a file that isn't there, or the app registering a `blob:` worker

Point it at an archived edition too: `node tools/check.mjs releases/ironman-trainer-v2.8.html`

## How the app is laid out

One file, in this order. Search for the banner comments to navigate.

| Section | Marker to search for |
| --- | --- |
| Inline PWA manifest + icons | `id="pwa-manifest"` |
| All CSS | `<style>` |
| Static markup: splash, header, tabs, modals | `<body>` |
| **The plan data — 32 weeks of sessions** | `const BUILTIN_PLAN` |
| Plan storage, import/export, normalisation | `Loadable / editable plan layer` |
| Calendar maths (`dayDiff`, `planDayOffset`) | `function dayDiff` |
| Stable session ids, move/reschedule | `Stage 2: stable session IDs` |
| Backup nudge, onboarding, settings modal | `Data-safety backup nudge` |
| Week cards, session rendering, progress | `function renderWeeks` |
| Tracker (logged distance/time/HR/RPE) | `// TRACKER` |
| Progress rings, countdown, phase bar | `// PROGRESS RINGS` |
| Stats tab: zones, paces, PRs, projection | `// STATS TAB` |
| Race tab: splits, nutrition, gear, taper | `function renderRaceTab` |
| Today card | `// TODAY CARD` |
| Quick-log sheet + activity feed | `// QUICK LOG SHEET` |
| Shifts view | `function renderShifts` |
| Boot sequence, PWA shortcuts, clock, splash | `Handle PWA shortcuts` |

### Plan data shape

```js
{ wk: 11, ph: 'IM Build', hrs: 14, note: '14 hrs · ...', days: [
    { date: '05 Oct', sd: 0, session: 'Bike 90min\n3x8min @ 95%/5min\nRun 45min\nEasy' },
    ...seven of these, Monday first
]}
```

- `sd` is the work-shift flag: `0` normal, `1` shift 1 (train around it), `2` shift 2
  (no training — the day renders empty and is excluded from every count).
- `session` is plain text with real newlines. **A line that starts with a discipline
  word** — `swim`, `bike`, `long ride`, `ride`, `run`, `brick run`, `long run`,
  `strength`, `rest` — starts a new tickable block; every line after it is a detail
  bullet for that block. This rule drives rendering, tick state, counting and the rings,
  so a session that opens with anything else becomes one inert block.
- `date` labels are hand-written and must match the calendar exactly. Never generate them
  with `toLocaleDateString` — ICU renders September as both `Sep` and `Sept` depending on
  the browser version.

### Calendar

Week 1 Monday is **27 Jul 2026**; race day is offset 222, week 32 Saturday. Everything
that maps a date to a plan slot goes through `planDayOffset()`, which is built on
`dayDiff()` — a UTC-normalised whole-day difference.

Do not subtract two local `Date` objects and divide by `86400000` to get a day count.
New Zealand moves to NZDT on 27 Sep 2026, mid-plan; across that boundary the subtraction
is one hour short and `Math.floor` drops a whole day. That is exactly what happened before
v2.8: every date lookup was one day behind for the 167 days from 28 Sep 2026 to race day.
`tools/check.mjs` now fails if it comes back.

### Stored data (per device, `localStorage`)

| Key | Holds |
| --- | --- |
| `im_plan_v2` | The plan itself once edited or imported (falls back to `BUILTIN_PLAN`) |
| `done_<blockId>` | Session ticked complete |
| `trk_<wk>_<di>_<disc>_<field>` | Logged distance / time / HR / RPE |
| `extra_<wk>_<di>` | Unplanned sessions added on a day |
| `gear_<section>` | Race-day gear checklist |
| `wk-celebrated-<wk>` | Week-complete celebration already shown |
| `maxHR`, `ftp`, `swimT100`, `runMax`, `runEasy` | Training zone inputs |

Nothing leaves the device. Two ways out, both in the app: **Export** (action row) writes
every key to JSON; **Plan settings → Backup** does the same with a restore path. Tell the
phone to keep it — iOS will evict site data from a browser tab that hasn't been opened in
a while, which is why the app asks for persistent storage and nags for a backup.

## Known limitations

- Data is per device and per browser. Installing to the home screen and logging there,
  then opening the same page in Safari, gives you two separate logs.
- Offline needs the app to have been opened online once, over `https://`. Opened straight
  from a `file://` path there is no service worker at all, by browser design.
- The PDF export opens a print window; some mobile browsers block it as a popup.
- The plan editor writes free text. Anything that doesn't start with a discipline word
  stops being a tickable session — `tools/check.mjs` catches this for the built-in plan
  but cannot see a plan stored in someone's browser.
