#!/usr/bin/env node
// Build the downloadable zip bundles (#21) from the static CSVs.
//
// The per-level download buttons hand back "all the data at that level":
//   national -> data/all-states.zip          one folder per ready state,
//                                             each with its county summary,
//                                             schools.csv, and counties/*.csv;
//                                             states.csv sits at the root.
//   state    -> data/states/<code>-counties.zip
//                                             flat (no folders): the state's
//                                             county-summary CSV + every
//                                             per-county school CSV.
//   county   -> data/states/<code>/counties/<county>.csv   (plain CSV, no zip)
//
// We pre-build the zips at deploy time (rather than zipping in the browser) so
// a national download is a single static request, not ~160 fetches. Run after
// derive-county-csvs (it needs the per-county files); both run in `prebuild`.
//   node scripts/build-data-zips.mjs
import {
  existsSync, readdirSync, mkdirSync, rmSync, cpSync, copyFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const STATES_DIR = join(DATA_DIR, 'states');
const STAGING = join(ROOT, '.zip-staging'); // outside public/ so Vite ignores it

function haveZip() {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// zip from inside `cwd` so entry paths are relative to it. Recreates the
// archive each run (-FS would leave stale entries when a county is removed).
function zipDir(cwd, archivePath, entries) {
  if (existsSync(archivePath)) rmSync(archivePath);
  execFileSync('zip', ['-rq', archivePath, ...entries], { cwd });
}

// States are the directories under states/ that carry a schools.csv.
function readyStates() {
  if (!existsSync(STATES_DIR)) return [];
  return readdirSync(STATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((code) => existsSync(join(STATES_DIR, code, 'schools.csv')));
}

// state zip: flat county-summary + per-county school CSVs, no folders.
function buildStateZip(code) {
  const summary = join(STATES_DIR, `${code}.csv`);
  const countiesDir = join(STATES_DIR, code, 'counties');
  if (!existsSync(countiesDir)) return false;

  const stage = join(STAGING, `${code}-counties`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  if (existsSync(summary)) copyFileSync(summary, join(stage, `${code}.csv`));
  for (const f of readdirSync(countiesDir)) {
    if (f.endsWith('.csv')) copyFileSync(join(countiesDir, f), join(stage, f));
  }

  zipDir(stage, join(STATES_DIR, `${code}-counties.zip`), ['.']);
  return true;
}

// national zip: states.csv at root + one folder per state with its full set.
function buildNationalZip(codes) {
  const stage = join(STAGING, 'all-states');
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  const statesCsv = join(DATA_DIR, 'states.csv');
  if (existsSync(statesCsv)) copyFileSync(statesCsv, join(stage, 'states.csv'));

  for (const code of codes) {
    const dest = join(stage, code);
    mkdirSync(dest, { recursive: true });
    const summary = join(STATES_DIR, `${code}.csv`);
    const schools = join(STATES_DIR, code, 'schools.csv');
    const countiesDir = join(STATES_DIR, code, 'counties');
    if (existsSync(summary)) copyFileSync(summary, join(dest, `${code}.csv`));
    if (existsSync(schools)) copyFileSync(schools, join(dest, 'schools.csv'));
    if (existsSync(countiesDir)) {
      cpSync(countiesDir, join(dest, 'counties'), { recursive: true });
    }
  }

  zipDir(stage, join(DATA_DIR, 'all-states.zip'), ['.']);
}

function main() {
  if (!existsSync(STATES_DIR)) {
    console.error(`build-data-zips: ${STATES_DIR} not found; nothing to do.`);
    return;
  }
  if (!haveZip()) {
    console.error('build-data-zips: `zip` not found on PATH; cannot build bundles.');
    process.exit(1);
  }

  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(STAGING, { recursive: true });

  const codes = readyStates();
  let stateZips = 0;
  for (const code of codes) {
    if (buildStateZip(code)) {
      stateZips += 1;
      console.log(`build-data-zips: states/${code}-counties.zip`);
    }
  }
  buildNationalZip(codes);
  console.log(`build-data-zips: all-states.zip (${codes.length} states)`);

  rmSync(STAGING, { recursive: true, force: true });
  console.log(`build-data-zips: wrote ${stateZips} state zips + 1 national zip`);
}

main();
