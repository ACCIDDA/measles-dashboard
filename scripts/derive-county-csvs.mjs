#!/usr/bin/env node
// Derive the per-county school CSVs from each state's combined schools.csv.
//
// The dashboard only loads `states/<code>.csv` + `states/<code>/schools.csv`.
// The per-county files (`states/<code>/counties/<county>.csv`) exist solely as
// the download/API unit (#21/#22). Rather than commit them (which made every
// data change a 150+ file / ~20k-line diff, #65), we generate them at build
// time from the committed schools.csv — a pure reshape, no R required.
//
// Run automatically via the `prebuild` npm hook; also runnable directly:
//   node scripts/derive-county-csvs.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvParse, csvFormat } from 'd3-dsv';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATES_DIR = join(ROOT, 'public', 'data', 'states');

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function deriveState(code) {
  const schoolsPath = join(STATES_DIR, code, 'schools.csv');
  if (!existsSync(schoolsPath)) return 0;

  const rows = csvParse(readFileSync(schoolsPath, 'utf8'));
  // Per-county files carry every column except `county`.
  const cols = rows.columns.filter((c) => c !== 'county');

  const byCounty = new Map();
  for (const r of rows) {
    if (!byCounty.has(r.county)) byCounty.set(r.county, []);
    byCounty.get(r.county).push(r);
  }

  const outDir = join(STATES_DIR, code, 'counties');
  mkdirSync(outDir, { recursive: true });
  for (const [county, schools] of byCounty) {
    const csv = csvFormat(schools, cols);
    writeFileSync(join(outDir, `${slugify(county)}.csv`), csv + '\n');
  }
  return byCounty.size;
}

function main() {
  if (!existsSync(STATES_DIR)) {
    console.error(`derive-county-csvs: ${STATES_DIR} not found; nothing to do.`);
    return;
  }
  // Each state is a directory under states/ that has a schools.csv.
  const codes = readdirSync(STATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  let total = 0;
  for (const code of codes) {
    const n = deriveState(code);
    if (n) console.log(`derive-county-csvs: ${code} -> ${n} county files`);
    total += n;
  }
  console.log(`derive-county-csvs: wrote ${total} per-county files`);
}

main();
