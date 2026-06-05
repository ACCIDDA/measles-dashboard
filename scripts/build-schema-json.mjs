#!/usr/bin/env node
// Generate public/data/schema.json from the single-source schema definition
// (src/data/schema.js), so the published, machine-readable schema cannot drift
// from the contract test or the docs (#77).
//
// Consumers fetch schema.json and build a typed reader from it (e.g. an Arrow
// schema), then read the CSV with guaranteed types instead of inference. See
// docs/API.md.
//
// Runs via the `predev` and `prebuild` npm hooks; also runnable directly:
//   node scripts/build-schema-json.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA } from '../src/data/schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'schema.json');

writeFileSync(OUT, JSON.stringify(SCHEMA, null, 2) + '\n');
const n = Object.keys(SCHEMA.files).length;
console.log(`build-schema-json: wrote schema.json (${n} file shapes)`);
