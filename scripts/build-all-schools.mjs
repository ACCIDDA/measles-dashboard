#!/usr/bin/env node
// Build public/data/all-schools.csv: every state's schools.csv concatenated,
// with a leading `state` column (#75). This is the national-level download and
// the "all the data" entry point for the static data API. The per-state
// (states/<code>/schools.csv) and per-county school CSVs already exist; this is
// just their union. Generated at build time (prebuild), not committed.
//   node scripts/build-all-schools.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvParse, csvFormat } from 'd3-dsv';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATES_DIR = join(ROOT, 'public', 'data', 'states');
const OUT = join(ROOT, 'public', 'data', 'all-schools.csv');

function main() {
  if (!existsSync(STATES_DIR)) {
    console.error(`build-all-schools: ${STATES_DIR} not found; nothing to do.`);
    return;
  }

  // Each state is a directory under states/ that carries a schools.csv.
  const codes = readdirSync(STATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((code) => existsSync(join(STATES_DIR, code, 'schools.csv')))
    .sort();

  const rows = [];
  let cols = null;
  for (const code of codes) {
    const parsed = csvParse(readFileSync(join(STATES_DIR, code, 'schools.csv'), 'utf8'));
    // `state` is prepended so rows stay identifiable once concatenated (the
    // state is otherwise only implied by the file path).
    if (!cols) cols = ['state', ...parsed.columns];
    for (const r of parsed) rows.push({ state: code, ...r });
  }

  if (!cols) {
    console.error('build-all-schools: no state schools.csv found; nothing to do.');
    return;
  }

  writeFileSync(OUT, csvFormat(rows, cols) + '\n');
  console.log(`build-all-schools: wrote ${rows.length} schools from ${codes.length} states`);
}

main();
