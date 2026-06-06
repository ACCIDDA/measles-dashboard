import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { csvParse } from 'd3-dsv';
import { columnNames } from './schema.js';
import { validateRows, checkTierConsistency } from './validate.js';
import { renderApiMd } from '../../scripts/gen-api-schema.mjs';

// Contract test for the static dataset (#20 / #75). The loader
// (useUnifiedMapData) reads these CSVs by exact column name, and external
// consumers read them against the published schema, so a producer change
// (build_state.R / build_nc_from_estimates.R) that drops, renames, or reorders
// a column must fail here. Column expectations come from src/data/schema.js -
// the single source of truth that also generates schema.json and the API.md
// tables (#77).

const ROOT = resolve(__dirname, '../..');
const DATA = resolve(ROOT, 'public', 'data');

// Auto-discover ready states (#82): any directory under public/data/states that
// carries a schools.csv. Contributing a new state needs no edit here - its CSVs
// are validated automatically. Mirrors scripts/build-all-schools.mjs.
function discoverStates() {
  const dir = resolve(DATA, 'states');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((code) => existsSync(resolve(dir, code, 'schools.csv')))
    .sort();
}
const READY_STATES = discoverStates();

// all-schools.csv and the per-county files are generated at build time and not
// committed (#65/#75), so regenerate them before asserting (mirrors `prebuild`).
// schema.json and API.md ARE committed, so they are checked as-is for drift.
beforeAll(() => {
  for (const s of ['derive-county-csvs.mjs', 'build-all-schools.mjs']) {
    execFileSync('node', [resolve(ROOT, 'scripts', s)], { stdio: 'ignore' });
  }
});

const header = (path) => readFileSync(path, 'utf8').split('\n', 1)[0].trim().split(',');

describe('schema is the single source of truth (#77)', () => {
  // schema.json is a generated artifact (gitignored), built from SCHEMA by
  // build-schema-json.mjs; nothing to assert about a committed copy. The drift
  // guard that matters is the docs, which ARE committed.
  it('docs/API.md schema tables are in sync with schema.js (run gen-api-schema)', () => {
    const md = readFileSync(resolve(ROOT, 'docs', 'API.md'), 'utf8');
    expect(renderApiMd(md)).toBe(md);
  });
});

describe('public/data CSV headers match the schema', () => {
  it('states.csv', () => {
    expect(header(resolve(DATA, 'states.csv'))).toEqual(columnNames('data/states.csv'));
  });

  it('all-schools.csv', () => {
    expect(header(resolve(DATA, 'all-schools.csv'))).toEqual(columnNames('data/all-schools.csv'));
  });

  for (const code of READY_STATES) {
    describe(`state: ${code}`, () => {
      it('county summary CSV', () => {
        expect(header(resolve(DATA, `states/${code}.csv`)))
          .toEqual(columnNames('data/states/{state}.csv'));
      });

      it('schools.csv (app loads this)', () => {
        expect(header(resolve(DATA, `states/${code}/schools.csv`)))
          .toEqual(columnNames('data/states/{state}/schools.csv'));
      });

      it('a per-county file', () => {
        const summary = readFileSync(resolve(DATA, `states/${code}.csv`), 'utf8').trim().split('\n');
        const firstCounty = summary[1].split(',')[0];
        const slug = firstCounty.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const file = resolve(DATA, `states/${code}/counties/${slug}.csv`);
        expect(existsSync(file)).toBe(true);
        expect(header(file)).toEqual(columnNames('data/states/{state}/counties/{county}.csv'));
      });
    });
  }

  // Every county that actually has schools must have its own per-county file.
  // A county may appear in the summary with zero schools when all its schools
  // fell outside the model fit (an upstream coverage gap), and those
  // legitimately have no per-county file.
  it('every county with schools has a matching per-county file', () => {
    const countyIdx = columnNames('data/states/{state}/schools.csv').indexOf('county');
    for (const code of READY_STATES) {
      const schools = readFileSync(resolve(DATA, `states/${code}/schools.csv`), 'utf8').trim().split('\n').slice(1);
      const counties = new Set();
      for (const line of schools) {
        // minimal CSV field reader honoring double-quotes (school_name may have commas)
        const fields = []; let cur = '', q = false;
        for (const ch of line) {
          if (ch === '"') q = !q;
          else if (ch === ',' && !q) { fields.push(cur); cur = ''; }
          else cur += ch;
        }
        fields.push(cur);
        counties.add(fields[countyIdx]);
      }
      const missing = [...counties]
        .map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
        .filter((slug) => !existsSync(resolve(DATA, `states/${code}/counties/${slug}.csv`)));
      expect(missing, `${code}: counties with schools but no per-county file`).toEqual([]);
    }
  });
});

describe('public/data CSV values conform to schema constraints (#82)', () => {
  // Beyond headers, every cell must pass the types + value constraints declared
  // in schema.js (coverage in [0,1], tier in {H,M,L}, FIPS format, no_data in
  // {0,1}, ...). This is the gate that makes a federated state-data PR (#78)
  // safe to ingest: a nonconforming contribution fails CI here. Blanks are
  // allowed (validate.js treats empty cells as "not available").

  // Concrete files to check, built at run time so the per-county and
  // all-schools files regenerated in beforeAll are included.
  const targets = () => {
    const list = [];
    const add = (shape, path) => existsSync(path) && list.push({ shape, path });
    add('data/states.csv', resolve(DATA, 'states.csv'));
    add('data/all-schools.csv', resolve(DATA, 'all-schools.csv'));
    for (const code of READY_STATES) {
      add('data/states/{state}.csv', resolve(DATA, 'states', `${code}.csv`));
      add('data/states/{state}/schools.csv', resolve(DATA, 'states', code, 'schools.csv'));
      const cdir = resolve(DATA, 'states', code, 'counties');
      if (existsSync(cdir)) {
        for (const f of readdirSync(cdir).filter((name) => name.endsWith('.csv'))) {
          add('data/states/{state}/counties/{county}.csv', resolve(cdir, f));
        }
      }
    }
    return list;
  };

  it('discovers the published states', () => {
    expect(READY_STATES).toEqual(expect.arrayContaining(['ca', 'nc']));
  });

  it('every published file passes type + constraint checks', () => {
    const problems = [];
    for (const { shape, path } of targets()) {
      const errs = validateRows(shape, csvParse(readFileSync(path, 'utf8')));
      if (errs.length) {
        problems.push(`${path.slice(ROOT.length + 1)}:\n  ${errs.slice(0, 5).join('\n  ')}`);
      }
    }
    expect(problems, `\n${problems.join('\n\n')}`).toEqual([]);
  });
});

describe('tier is consistent with coverage (#82, pearsonca on #83)', () => {
  // The marker is validated against the numbers, but tolerantly: coverage is
  // published rounded to 4 decimals while the producer tiers from the unrounded
  // value, so a value rounding to exactly a 0.90/0.95 boundary may legitimately
  // carry either adjacent tier. Gross mislabels are still caught.
  it('allows boundary rounding either way', () => {
    expect(checkTierConsistency('0.95', 'M')).toBeNull(); // really 0.9499 -> M
    expect(checkTierConsistency('0.95', 'H')).toBeNull();
    expect(checkTierConsistency('0.90', 'L')).toBeNull();
    expect(checkTierConsistency('0.90', 'M')).toBeNull();
  });

  it('flags a tier that is clearly wrong for the coverage', () => {
    expect(checkTierConsistency('0.92', 'H')).toMatch(/inconsistent/);
    expect(checkTierConsistency('0.80', 'M')).toMatch(/inconsistent/);
    expect(checkTierConsistency('0.99', 'L')).toMatch(/inconsistent/);
  });

  it('skips rows missing either value', () => {
    expect(checkTierConsistency('', 'H')).toBeNull();
    expect(checkTierConsistency('0.5', '')).toBeNull();
  });
});
