#!/usr/bin/env node
// Flip a state to "ready" once its data has landed (#82). The dashboard hides a
// state until public/data/states.json marks it ready, so a contributor's last
// step after adding states/<code>/schools.csv and states/<code>.csv is to
// register it. This script validates those files against the schema first, then
// sets the status, so you can't accidentally publish a nonconforming state.
//
//   npm run register-state -- <code>      e.g. npm run register-state -- ny
//
// It does NOT invent attribution (source links live in src/config/states.js and
// require a human); it prints the remaining manual steps instead.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvParse } from 'd3-dsv';
import { columnNames } from '../src/data/schema.js';
import { validateRows } from '../src/data/validate.js';
import { uspsToFips, STATES } from '../src/config/states.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');

function fail(msg) {
  console.error(`register-state: ${msg}`);
  process.exit(1);
}

const code = (process.argv[2] || '').toLowerCase();
if (!code) fail('usage: npm run register-state -- <state-code>   (e.g. ny)');

const fips = uspsToFips(code);
if (!fips) fail(`"${code}" is not a known USPS state code.`);

// Both per-state files must exist and conform before we mark the state ready.
const checks = [
  { shape: 'data/states/{state}/schools.csv', path: join(DATA, 'states', code, 'schools.csv') },
  { shape: 'data/states/{state}.csv', path: join(DATA, 'states', `${code}.csv`) },
];
for (const { shape, path } of checks) {
  if (!existsSync(path)) fail(`missing ${path.slice(ROOT.length + 1)} - add the state's data first.`);
  const text = readFileSync(path, 'utf8');
  const header = text.split('\n', 1)[0].trim().split(',');
  const expected = columnNames(shape);
  if (header.length !== expected.length || header.some((h, i) => h !== expected[i])) {
    fail(`${path.slice(ROOT.length + 1)} header does not match the schema. Run \`npm run validate-data\` for details.`);
  }
  const errs = validateRows(shape, csvParse(text));
  if (errs.length) fail(`${path.slice(ROOT.length + 1)} has ${errs.length} value problem(s). Run \`npm run validate-data\` for details.`);
}

// Mark ready in states.json (preserving 2-space formatting + trailing newline).
const statesJsonPath = join(DATA, 'states.json');
const registry = JSON.parse(readFileSync(statesJsonPath, 'utf8'));
const before = registry[code]?.status;
registry[code] = { ...(registry[code] || {}), fips, name: registry[code]?.name || code.toUpperCase(), status: 'ready' };
writeFileSync(statesJsonPath, JSON.stringify(registry, null, 2) + '\n');

console.log(`register-state: ${code} validated and set to "ready"${before && before !== 'ready' ? ` (was "${before}")` : ''}.`);

// Remaining manual steps that need a human.
const needsAttribution = !STATES[code];
console.log('\nNext steps:');
if (needsAttribution) {
  console.log(`  - Add a "${code}" entry to STATES in src/config/states.js (name, fullName, fips: "${fips}", sourceUrl, sourceLabel) so the data-source link renders.`);
}
console.log('  - Ensure public/data/states.csv has the national-summary row for this state.');
console.log('  - Commit states.json, states.csv, src/config/states.js, and public/data/states/' + code + '/**.');
