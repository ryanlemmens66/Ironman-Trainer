# Changelog

Every released edition is frozen in `releases/`. To roll back, copy one over
`Ironman Trainer.html`.

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
