#!/usr/bin/env node
/**
 * Build the Netlify upload bundle.
 *
 *   node tools/build-netlify.mjs
 *
 * Netlify serves the site root, so the app is copied to index.html — the bare
 * URL then loads it with no redirect hop and no space in a filename. The
 * service worker is rewritten to match that layout and to carry the current
 * APP_VERSION as its cache name, which is the step most easily forgotten by
 * hand and the one that leaves people on a stale edition.
 *
 * Output: dist/netlify/  (drag the folder onto app.netlify.com/drop, or zip it)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const appFile = path.join(root, 'Ironman Trainer.html');
const outDir = path.join(root, 'dist', 'netlify');

const app = fs.readFileSync(appFile, 'utf8');
const version = (app.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
if (!version) {
  console.error('Could not read APP_VERSION from the app — refusing to build an unversioned bundle.');
  process.exit(1);
}

// The app must register a worker for the bundled sw.js to do anything.
if (!/register\('\.\/sw\.js'\)/.test(app)) {
  console.error('The app does not register ./sw.js — the bundle would ship a worker nothing loads.');
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), app);

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8')
  .replace(/const CACHE = '[^']*';/, `const CACHE = 'im-trainer-v${version}';`)
  .replace(/const PRECACHE = \[[\s\S]*?\];/, "const PRECACHE = ['./', './index.html'];")
  .replace(/caches\.match\('\.\/Ironman Trainer\.html'\)/g, "caches.match('./index.html')");

if (/Ironman Trainer\.html/.test(sw)) {
  console.error('sw.js still refers to the Pages filename after rewriting — check tools/build-netlify.mjs.');
  process.exit(1);
}
fs.writeFileSync(path.join(outDir, 'sw.js'), sw);

const zipName = `ironman-trainer-v${version}-netlify.zip`;
const zipPath = path.join(root, 'dist', zipName);
let zipped = false;
try {
  fs.rmSync(zipPath, { force: true });
  execSync(`cd ${JSON.stringify(outDir)} && zip -q -r ${JSON.stringify(zipPath)} index.html sw.js`);
  zipped = true;
} catch { /* zip is optional — the folder alone uploads fine */ }

const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log(`Ironman Trainer v${version} → dist/netlify/`);
console.log(`  index.html  ${kb(path.join(outDir, 'index.html'))}`);
console.log(`  sw.js       ${kb(path.join(outDir, 'sw.js'))}  (cache im-trainer-v${version})`);
console.log(zipped
  ? `  dist/${zipName}  ${kb(zipPath)}\n\nDrag the zip onto app.netlify.com/drop, or the dist/netlify folder.`
  : `\nDrag the dist/netlify folder onto app.netlify.com/drop (zip not available to bundle it).`);
