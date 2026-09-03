#!/usr/bin/env node
/**
 * Ironman Trainer integrity check.
 *
 *   node tools/check.mjs            # check the working file
 *   node tools/check.mjs releases/ironman-trainer-v2.8.html
 *
 * The app is one hand-edited HTML file with no build step, so nothing else
 * catches a stray comma in the plan data or a day that drifted off the
 * calendar. Run this before committing an edition. Exit code 1 = something
 * is wrong.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// The calendar assertions below are about New Zealand local time, where the
// app is used and where DST bit us once already.
process.env.TZ = 'Pacific/Auckland';

const target = process.argv[2] || 'Ironman Trainer.html';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = path.resolve(root, target);
const src = fs.readFileSync(file, 'utf8');

const problems = [];
const notes = [];
const fail = m => problems.push(m);
const note = m => notes.push(m);

// ── plan anchors (must match the constants in the app) ───────────────
const START = { y: 2026, m: 6, d: 27 };      // Mon 27 Jul 2026, month 0-indexed
const RACE = { y: 2027, m: 2, d: 6 };        // Sat 6 Mar 2027
const WEEKS = 32;

// ── 1. inline scripts parse ──────────────────────────────────────────
const scripts = [...src.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]);
if (!scripts.length) fail('no inline <script> blocks found — file structure changed');
scripts.forEach((code, i) => {
  try { new vm.Script(code); }
  catch (e) { fail(`script block ${i + 1} has a syntax error: ${e.message}`); }
});

// ── 2. inline JSON manifest parses ───────────────────────────────────
const manifest = src.match(/<script type="application\/json" id="pwa-manifest">([\s\S]*?)<\/script>/);
if (!manifest) fail('inline PWA manifest is missing');
else {
  try { JSON.parse(manifest[1]); }
  catch (e) { fail(`inline PWA manifest is not valid JSON: ${e.message}`); }
}

// ── 3. pull the real plan data and date helpers out of the file ──────
const planStart = src.indexOf('const BUILTIN_PLAN = [');
const planEnd = src.indexOf('const PLAN_STORAGE_KEY');
if (planStart < 0 || planEnd < 0) fail('could not locate BUILTIN_PLAN in the file');

let PLAN = [];
let helpers = {};
if (planStart >= 0 && planEnd > planStart) {
  const ctx = { PLAN: null, Math, Date, console };
  vm.createContext(ctx);
  try {
    PLAN = vm.runInContext(
      src.slice(planStart, planEnd).replace('const BUILTIN_PLAN', 'var BUILTIN_PLAN') + '; BUILTIN_PLAN',
      ctx
    );
  } catch (e) { fail(`BUILTIN_PLAN does not evaluate: ${e.message}`); }

  // Run the shipped date helpers rather than a copy of them, so this test
  // fails if someone reintroduces naive local-time subtraction.
  const hStart = src.indexOf('function localMidnight(');
  const hEnd = src.indexOf('function currentPlanWeek(');
  if (hStart < 0 || hEnd < 0) fail('could not locate the date helpers');
  else {
    const hCtx = { Math, Date, PLAN };
    vm.createContext(hCtx);
    vm.runInContext(
      `var PLAN_START_Y=${START.y}, PLAN_START_M=${START.m}, PLAN_START_D=${START.d};
       function planStartDate(){ return new Date(PLAN_START_Y, PLAN_START_M, PLAN_START_D); }
       ${src.slice(hStart, hEnd)}`,
      hCtx
    );
    helpers = hCtx;
  }
}

// ── 4. plan shape and calendar ───────────────────────────────────────
if (PLAN.length !== WEEKS) fail(`expected ${WEEKS} weeks, found ${PLAN.length}`);

const dayLabel = off => {
  const d = new Date(START.y, START.m, START.d + off);
  // Built by hand: toLocaleDateString('en-GB') renders September as both "Sep"
  // and "Sept" depending on the ICU version, so it cannot be trusted here.
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return String(d.getDate()).padStart(2, '0') + ' ' + M[d.getMonth()];
};

let totalHrs = 0;
PLAN.forEach((w, wi) => {
  if (w.wk !== wi + 1) fail(`week at index ${wi} is numbered ${w.wk}`);
  if (typeof w.hrs !== 'number' || !(w.hrs >= 0)) fail(`week ${w.wk} has a non-numeric hrs`);
  totalHrs += w.hrs || 0;
  if (!Array.isArray(w.days) || w.days.length !== 7) {
    fail(`week ${w.wk} has ${w.days ? w.days.length : 0} days, expected 7`);
    return;
  }
  w.days.forEach((d, di) => {
    const off = wi * 7 + di;
    if (d.date !== dayLabel(off)) fail(`week ${w.wk} day ${di}: date "${d.date}", expected "${dayLabel(off)}"`);
    if (typeof d.session !== 'string') fail(`week ${w.wk} day ${di}: session is not a string`);
    if (![0, 1, 2].includes(d.sd)) fail(`week ${w.wk} day ${di}: shift flag sd=${d.sd}`);
  });
});

// ── 5. race day sits where the countdown says it does ────────────────
const raceOffset = (WEEKS - 1) * 7 + 5;                       // week 32, Saturday
const raceCell = PLAN[WEEKS - 1]?.days?.[5];
const raceDate = new Date(RACE.y, RACE.m, RACE.d);
if (dayLabel(raceOffset) !== `0${RACE.d} Mar`) fail(`week ${WEEKS} Saturday is ${dayLabel(raceOffset)}, not 06 Mar`);
if (raceCell && !/RACE DAY/i.test(raceCell.session)) fail('week 32 Saturday is not marked RACE DAY');
if (raceDate.getDay() !== 6) fail('race date is not a Saturday');

// ── 6. date -> plan slot survives the NZDT changeover ────────────────
// The plan spans 27 Sep 2026 (clocks forward), so this is the regression that
// silently shifted the whole app back by one day for 167 days.
if (helpers.planDayOffset) {
  let drift = 0, firstDrift = null;
  for (let off = 0; off < WEEKS * 7; off++) {
    const d = new Date(START.y, START.m, START.d + off);
    if (helpers.planDayOffset(d) !== off) {
      drift++;
      if (!firstDrift) firstDrift = d.toDateString();
    }
  }
  if (drift) fail(`planDayOffset drifts on ${drift} day(s) in Pacific/Auckland, first: ${firstDrift}`);
}

// ── 7. every session line the app renders is one it can also count ───
const HEADS = ['swim', 'bike', 'long ride', 'ride', 'run', 'brick run', 'long run', 'strength', 'rest'];
const isHead = l => HEADS.some(k => l.toLowerCase().trim().startsWith(k));
const ALLOWED_ORPHANS = [/^RACE DAY/i];
PLAN.forEach(w => (w.days || []).forEach((d, di) => {
  const lines = String(d.session || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return;
  if (!isHead(lines[0]) && !ALLOWED_ORPHANS.some(re => re.test(lines[0]))) {
    fail(`week ${w.wk} day ${di}: first line "${lines[0]}" is not a session heading, so the day renders as one untickable block`);
  }
  if (d.sd === 2 && lines.some(isHead) && !/^rest/i.test(lines[0])) {
    note(`week ${w.wk} day ${di} is a shift-2 day but carries a session — it will be hidden in the week view`);
  }
}));

// ── 7b. the race projection stays sane when a logged session is wrong ─
// A single mistyped duration (91.7 km entered as 135 min, next to a logged
// average speed of 28.1 km/h) once pulled the whole projection to 8:57 for an
// athlete targeting 11:30. The projection must read the median of a discipline
// and ignore entries that contradict their own speed/pace field.
{
  const grab = name => {
    const i = src.indexOf(`function ${name}(`);
    if (i < 0) return null;
    // functions here are top-level and end at the first column-0 brace
    const end = src.indexOf('\n}', i);
    return end < 0 ? null : src.slice(i, end + 2);
  };
  const parts = ['getTrackerKey', 'getTrackerVal', 'computeProjection'].map(grab);
  if (parts.some(p => !p)) fail('could not extract the projection functions to test them');
  else {
    const store = {};
    const day = { date: '01 Jan', sd: 0, session: 'Swim 60min\nBike 120min\nRun 60min' };
    const PLAN = Array.from({ length: 6 }, (_, i) => ({ wk: i + 1, ph: 'IM Build', hrs: 12, note: '', days: Array.from({ length: 7 }, () => ({ ...day })) }));
    const set = (wk, di, disc, f, v) => { store[`trk_${wk}_${di}_${disc}_${f}`] = String(v); };
    // five honest rides at ~28 km/h, plus one whose duration contradicts its
    // own logged speed (the real-world entry error this test exists for)
    [1, 2, 3, 4, 5].forEach(wk => { set(wk, 1, 'bike', 'dist', 95); set(wk, 1, 'bike', 'time', 204); set(wk, 1, 'bike', 'speed', 28); });
    set(6, 1, 'bike', 'dist', 91.7); set(6, 1, 'bike', 'time', 135); set(6, 1, 'bike', 'speed', 28.1);
    [1, 2, 3, 4, 5].forEach(wk => { set(wk, 2, 'run', 'dist', 22); set(wk, 2, 'run', 'time', 110); });
    [1, 2, 3, 4, 5].forEach(wk => { set(wk, 0, 'swim', 'dist', 3); set(wk, 0, 'swim', 'time', 47); });

    const ctx = { PLAN, Math, Date, localStorage: { getItem: k => (k in store ? store[k] : null) } };
    vm.createContext(ctx);
    try {
      vm.runInContext(parts.join('\n'), ctx);
      const P = vm.runInContext('computeProjection()', ctx);
      const hrs = P.totalMins / 60;
      // 28 km/h rides cannot yield a sub-6h bike split, whatever else changes
      if (P.bike.mins < 330) fail(`projection's bike leg is ${(P.bike.mins / 60).toFixed(2)}h off 28 km/h rides — an outlier entry is being trusted`);
      if (hrs < 9.5 || hrs > 15) fail(`projected finish ${hrs.toFixed(2)}h is outside any plausible range for the seeded athlete`);
      if (!/median/.test(P.bike.src || '')) note(`projection bike source reads "${P.bike.src}" — expected a median of several rides`);
    } catch (e) { fail(`computeProjection threw: ${e.message}`); }
  }
}

// ── 8. inline handlers point at functions that exist ─────────────────
const defined = new Set([
  ...[...src.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]),
  ...[...src.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function|\()/g)].map(m => m[1]),
  ...[...src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1])
]);
const METHODS = /\.\s*$/;
for (const m of src.matchAll(/on(?:click|change|input|pointerdown)\s*=\s*(["'])([\s\S]*?)\1/g)) {
  for (const c of m[2].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = c[1];
    const before = m[2].slice(0, c.index);
    if (METHODS.test(before)) continue;                       // a method call, not a global
    if (['if', 'for', 'while', 'switch', 'return', 'typeof'].includes(name)) continue;
    if (name in globalThis || defined.has(name)) continue;
    fail(`inline handler calls ${name}(), which is not defined in the file`);
  }
}

// ── 9. no duplicate ids in the static markup ─────────────────────────
const staticMarkup = src.slice(src.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const seen = new Map();
for (const m of staticMarkup.matchAll(/\sid="([^"{]+)"/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
[...seen].filter(([, n]) => n > 1).forEach(([id]) => fail(`duplicate element id "${id}"`));

// ── 10. service worker precache points at files that exist ───────────
const swPath = path.join(root, 'sw.js');
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8');
  const list = sw.match(/const PRECACHE = \[([\s\S]*?)\]/);
  if (list) {
    for (const m of list[1].matchAll(/'([^']+)'/g)) {
      const rel = m[1].replace(/^\.\//, '');
      if (rel === '' || rel === '/') continue;
      if (!fs.existsSync(path.join(root, rel))) fail(`sw.js precaches "${m[1]}", which does not exist`);
    }
  }
  if (!/register\('\.\/sw\.js'\)/.test(src)) fail('sw.js exists but the app does not register it');
  if (/serviceWorker\.register\(\s*(swUrl|URL\.createObjectURL)/.test(src)) {
    fail('service worker is registered from a blob: URL — browsers reject those, so the app would never work offline');
  }
}

// ── report ───────────────────────────────────────────────────────────
const version = (src.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '?';
console.log(`Ironman Trainer — ${path.relative(root, file)}`);
console.log(`  version ${version} · ${PLAN.length} weeks · ${totalHrs.toFixed(1)} planned hours · ${(src.length / 1024).toFixed(0)} KB`);
notes.forEach(n => console.log(`  note: ${n}`));
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  problems.forEach(p => console.log(`  ✗ ${p}`));
  process.exit(1);
}
console.log('  ✓ all checks passed');
