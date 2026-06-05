#!/usr/bin/env node
// Validate the published CSVs against the schema (#78/#82): both the column
// contract (header set/order from schema.js) and per-row VALUES (types +
// constraints). This is the check a state-data contributor runs before opening
// a PR; CI runs the same logic via csvSchema.test.js, so green here = green
// there. Exits non-zero on any nonconformance.
//
//   npm run validate-data
//
// States are auto-discovered from public/data/states/ (any directory with a
// schools.csv), so contributing a new state needs no edit here.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvParse } from 'd3-dsv';
import { columnNames } from '../src/data/schema.js';
import { validateRows } from '../src/data/validate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');
const STATES_DIR = join(DATA, 'states');

const MAX_SHOWN = 10; // don't bury the contributor in thousands of lines

// Discover ready states: a directory under states/ that carries a schools.csv.
function discoverStates() {
  if (!existsSync(STATES_DIR)) return [];
  return readdirSync(STATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((code) => existsSync(join(STATES_DIR, code, 'schools.csv')))
    .sort();
}

// Build the list of {shape, path} to validate from what actually exists, so it
// works before or after the per-county / all-schools build step.
function targets() {
  const list = [];
  const add = (shape, path) => existsSync(path) && list.push({ shape, path });

  add('data/states.csv', join(DATA, 'states.csv'));
  add('data/all-schools.csv', join(DATA, 'all-schools.csv'));
  for (const code of discoverStates()) {
    add('data/states/{state}.csv', join(STATES_DIR, `${code}.csv`));
    add('data/states/{state}/schools.csv', join(STATES_DIR, code, 'schools.csv'));
    const countyDir = join(STATES_DIR, code, 'counties');
    if (existsSync(countyDir)) {
      for (const f of readdirSync(countyDir).filter((f) => f.endsWith('.csv'))) {
        add('data/states/{state}/counties/{county}.csv', join(countyDir, f));
      }
    }
  }
  return list;
}

function validateFile({ shape, path }) {
  const text = readFileSync(path, 'utf8');
  const errors = [];

  // Column contract: header must equal the schema's ordered column names.
  const header = text.split('\n', 1)[0].trim().split(',');
  const expected = columnNames(shape);
  if (header.length !== expected.length || header.some((h, i) => h !== expected[i])) {
    errors.push(`header mismatch:\n    expected: ${expected.join(',')}\n    got:      ${header.join(',')}`);
    return errors; // value checks are meaningless if columns don't line up
  }

  // Value contract: types + constraints, per row.
  errors.push(...validateRows(shape, csvParse(text)));
  return errors;
}

function main() {
  const files = targets();
  if (!files.length) {
    console.error('validate-data: no data files found under public/data. Did you run the build?');
    process.exit(1);
  }

  let failed = 0;
  const rel = (p) => p.slice(ROOT.length + 1);
  for (const target of files) {
    const errors = validateFile(target);
    if (errors.length === 0) {
      console.log(`OK    ${rel(target.path)}`);
    } else {
      failed += 1;
      console.log(`FAIL  ${rel(target.path)}  (${errors.length} problem${errors.length === 1 ? '' : 's'})`);
      for (const e of errors.slice(0, MAX_SHOWN)) console.log(`        ${e}`);
      if (errors.length > MAX_SHOWN) console.log(`        ... and ${errors.length - MAX_SHOWN} more`);
    }
  }

  console.log('');
  if (failed) {
    console.error(`validate-data: ${failed} file(s) did not conform to the schema (src/data/schema.js).`);
    process.exit(1);
  }
  console.log(`validate-data: all ${files.length} file(s) conform to the schema.`);
}

main();
