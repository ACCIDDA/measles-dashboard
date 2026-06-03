#!/usr/bin/env node
// Generate public/data/national.json from public/data/states.csv.
//
// national.json drives the national-zoom choropleth + state hover tooltip
// (coverage keyed by 2-digit state FIPS). It used to be a hand-maintained stub,
// which drifted from the real producer output in states.csv (e.g. NC showed
// 95.1% on the national map but 94.7% in the state sidebar). Deriving it from
// states.csv keeps the two views in lockstep — one source of truth.
//
// Runs via the `predev` and `prebuild` npm hooks; also runnable directly:
//   node scripts/derive-national-json.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvParse } from 'd3-dsv';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATES_CSV = join(ROOT, 'public', 'data', 'states.csv');
const OUT = join(ROOT, 'public', 'data', 'national.json');

function main() {
  if (!existsSync(STATES_CSV)) {
    console.error(`derive-national-json: ${STATES_CSV} not found; nothing to do.`);
    return;
  }

  const rows = csvParse(readFileSync(STATES_CSV, 'utf8'));
  const states = {};
  for (const r of rows) {
    const fips = String(r.state_fips || '').padStart(2, '0');
    if (!fips || r.coverage == null || r.coverage === '') continue;
    // Coverage stays a proportion in [0,1] (the national view multiplies by 100).
    states[fips] = { coverage: Number(r.coverage), status: 'ready' };
  }

  const out = {
    description: 'Aggregate measles (MMR) vaccination coverage per state, keyed by '
      + '2-digit state FIPS. Generated from states.csv by '
      + 'scripts/derive-national-json.mjs (do not edit by hand). States missing '
      + "from this object render as 'no data' (greyed) in the national view.",
    states,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`derive-national-json: wrote ${Object.keys(states).length} states to national.json`);
}

main();
