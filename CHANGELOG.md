# Changelog

Every released edition is frozen in `releases/`. To roll back, copy one over
`Ironman Trainer.html`.

## v2.11 — 3 Sep 2026

`releases/ironman-trainer-v2.11.html`

- **Fixed: Import wrote your data but the app kept showing the old plan.** The
  plan is read from storage once at startup and then held in memory, so an
  imported plan did not take effect until the app was closed and reopened —
  and nothing said so. Import now reloads once the keys are written, which is
  what a full restore already did.
- **Import now also accepts a full backup file.** Two shapes reach that button:
  the flat export from the Import/Export row, and the wrapped file from
  Plan settings → Backup. Feeding it the wrapped one used to write `_app`,
  `data` and friends as literal keys, show "imported successfully", and restore
  nothing. Both shapes work, and a file with no usable keys now fails honestly.
- Added `tools/build-netlify.mjs`: copies the app to `index.html`, rewrites the
  service worker for that layout, and stamps `APP_VERSION` into its cache name —
  the step most easily missed by hand, and the one that strands people on a
  stale edition. Netlify is the deploy target now; Pages stays as a fallback.

## v2.10 — 3 Sep 2026

`releases/ironman-trainer-v2.10.html`

Visual pass, done by rendering the app in a real browser at iPhone size with a
season of logged training in it and reading the screenshots.

- **The days-to-go number was clipped.** `background-clip:text` paints only
  across the element's background box, and the negative letter-spacing pulled
  that box inside the glyph ink, slicing the leading digit off "182".
- **Day headings read "MON31 Aug".** The day name and date sat flush against
  each other with no gap.
- **The plan toolbar appeared on every tab.** "Tap a session to mark complete",
  Expand all and Collapse all act on the week list, but sat above the Stats,
  Race and Shifts content too, along with the intensity legend. The body now
  carries the active view and both are scoped to the plan tab.
- **The race timeline labels collided.** T1 and T2 are 0.7% of the bar, but a
  flex item will not shrink below its content, so "T1"/"T2" overflowed across
  SWIM, BIKE and RUN. The transitions now show as bar segments only — the
  splits table below lists both in full — and the legs can shrink properly.
- **The shifts calendar mis-columned any month that starts mid-week.** Rows
  padded only at the end, so 1–2 Aug (a Saturday and Sunday) sat in the Monday
  and Tuesday columns. Rows are now padded at the front to the first day's
  weekday, and the grid means what it looks like.
- **Strength sessions lost their colour.** The tracker and quick-log sheet build
  their class from the discipline key, giving `disc-strength` and
  `pill-strength`, while the stylesheet only defined `disc-str` and `pill-str`.
  Strength rows rendered with no tint, no left border and no label colour.
- **The training load chart floated.** No baseline, and weeks with no data drew
  a 2px speck. It now has a baseline rule, first/last week labels, and empty
  weeks read as a faint track.
- The tab bar leaned on `backdrop-filter` for legibility, so page content showed
  through wherever the blur is unavailable — including iOS "Reduce
  Transparency". Raised to 0.97 with a solid fallback.
- "1 rest days" now reads "1 rest day".

## v2.9 — 3 Sep 2026

`releases/ironman-trainer-v2.9.html`

- **Fixed: the race projection read 8:57 for an athlete targeting 11:30.** Two
  causes, both real. The model took the single *best* session in each
  discipline and applied a 2-3% fade, which is best-session pacing, not Ironman
  pacing. And it trusted a ride whose numbers contradicted themselves — 91.7 km
  logged with a 135-minute duration next to a logged average speed of 28.1 km/h,
  which implies 196 minutes. That one entry alone set the bike leg at 4:30.
  The projection now takes the **median** of the qualifying sessions in each
  discipline, so no single entry can decide a leg, and **discards sessions whose
  distance and time disagree with their own logged speed or pace by more than
  15%**. Race-day fade is now swim x1.06, bike x0.95, run x1.20 — the marathon
  is run off six hours of riding, and the projection now says so. On the same
  training data the projection reads 11:22, and each leg names how many sessions
  it came from.
- Session sampling falls back to shorter sessions early in a plan, when no
  90 km rides or 18 km runs exist yet, instead of silently reverting to the
  single fastest session of any length.
- `tools/check.mjs` now fails on a projection that trusts a self-contradictory
  entry, seeded with the exact entry error that caused this.

## v2.8 — 2 Sep 2026

`releases/ironman-trainer-v2.8.html`

Review pass over the whole app. Four fixes, all verified against the previous edition.

- **Fixed: the app would have shown the wrong day from 28 Sep 2026 to race day.**
  Date-to-plan-slot lookups subtracted two local `Date` objects, which is an hour short
  across the NZDT changeover on 27 Sep 2026 — enough for `Math.floor` to drop a day.
  From that morning on, the Today card, the current week, the streak, missed-session
  flags, the shift callout and the quick-log default date were all one day behind, and
  race day landed on offset 221 instead of 222. Day arithmetic now goes through a
  UTC-normalised `dayDiff()`, and `tools/check.mjs` fails if the drift returns.
- **Fixed: no "today" highlight for the whole of September.** The calendar highlighted
  today by comparing the plan's date label against `toLocaleDateString('en-GB')`, which
  renders September as `Sept` on current browsers while the plan says `Sep`. Nothing
  matched. Today is now found by plan offset, so no string formatting is involved.
- **Fixed: offline never worked.** The service worker was registered from a `blob:` URL,
  which browsers reject outright — so the "Works offline" promise on the install banner
  was never true. There is now a real `sw.js`: network-first with a cache fallback, so
  the app stays current online and still opens at the pool with no signal.
- **Fixed: `<` or `</textarea>` typed into a session broke the week editor.** Session
  text is now escaped before it goes into the edit modal, instead of being truncated.
- Week progress bars no longer count sessions parked on a shift-2 day. Those days are
  hidden and untickable, so counting them made the bar unable to reach 100%. Every other
  counter in the app already skipped them.
- Added `tools/check.mjs` — a dependency-free integrity check covering plan shape, the
  calendar, the DST regression, session parsing, inline handlers, duplicate ids and the
  service worker wiring.
- Added `README.md` (structure, data model, edit and release process) and this changelog.

## v2.7 — baseline

`releases/ironman-trainer-v2.7.html`

The app as it stood before the v2.8 review: 32-week plan, week/stats/race/shifts tabs,
Today card, quick-log sheet with activity feed, progress rings, training load, race-time
projection, session move/reschedule, plan import/export, full-data backup and restore,
PDF export, PWA install and notifications.
