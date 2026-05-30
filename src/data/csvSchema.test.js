import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Contract test for the #20 CSV bundle under public/data. The loader
// (useUnifiedMapData) reads these by exact column name, so a producer change
// (build_state.R / build_nc_from_estimates.R) that drops, renames, or reorders
// a column must fail here rather than silently break the dashboard.

const DATA = resolve(__dirname, '../../public/data');
const READY_STATES = ['ca', 'nc'];

// Shared coverage block, in the order the producers emit it.
const COVERAGE_BLOCK = [
  'coverage', 'coverage_ci_low', 'coverage_ci_high',
  'coverage_K', 'coverage_1', 'coverage_2', 'coverage_3', 'coverage_4', 'coverage_5',
  'coverage_ci_low_K', 'coverage_ci_low_1', 'coverage_ci_low_2', 'coverage_ci_low_3', 'coverage_ci_low_4', 'coverage_ci_low_5',
  'coverage_ci_high_K', 'coverage_ci_high_1', 'coverage_ci_high_2', 'coverage_ci_high_3', 'coverage_ci_high_4', 'coverage_ci_high_5',
  'is_estimated_K', 'is_estimated_1', 'is_estimated_2', 'is_estimated_3', 'is_estimated_4', 'is_estimated_5',
  'prob_below_95', 'tier',
];

const STATE_COLS = ['state', 'state_fips', 'state_name', 'n_schools', 'pct_schools_below_95', ...COVERAGE_BLOCK];
const COUNTY_COLS = ['county', 'county_fips', 'n_schools', 'pct_schools_below_95', ...COVERAGE_BLOCK];
const SCHOOLS_COLS = ['school_id', 'school_name', 'county', 'enrollment', ...COVERAGE_BLOCK];
const PER_COUNTY_COLS = ['school_id', 'school_name', 'enrollment', ...COVERAGE_BLOCK];

const header = (path) => readFileSync(path, 'utf8').split('\n', 1)[0].trim().split(',');

describe('public/data CSV schema (#20 contract)', () => {
  it('states.csv has the state-level columns in order', () => {
    expect(header(resolve(DATA, 'states.csv'))).toEqual(STATE_COLS);
  });

  for (const code of READY_STATES) {
    describe(`state: ${code}`, () => {
      it('county summary CSV has the county columns in order', () => {
        expect(header(resolve(DATA, `states/${code}.csv`))).toEqual(COUNTY_COLS);
      });

      it('schools.csv (app loads this) has the school columns in order', () => {
        expect(header(resolve(DATA, `states/${code}/schools.csv`))).toEqual(SCHOOLS_COLS);
      });

      it('a per-county file has the per-county school columns in order', () => {
        // pick the first county listed in the summary CSV
        const summary = readFileSync(resolve(DATA, `states/${code}.csv`), 'utf8').trim().split('\n');
        const firstCounty = summary[1].split(',')[0];
        const slug = firstCounty.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const file = resolve(DATA, `states/${code}/counties/${slug}.csv`);
        expect(existsSync(file)).toBe(true);
        expect(header(file)).toEqual(PER_COUNTY_COLS);
      });
    });
  }

  // Every county that actually has schools (per schools.csv) must have its own
  // per-county file. A county may appear in the summary with zero schools when
  // all its schools fell outside the model fit (an upstream coverage gap the
  // producer warns about) — those legitimately have no per-county file.
  it('every county with schools has a matching per-county file', () => {
    for (const code of READY_STATES) {
      const schools = readFileSync(resolve(DATA, `states/${code}/schools.csv`), 'utf8').trim().split('\n').slice(1);
      const cols = SCHOOLS_COLS;
      const countyIdx = cols.indexOf('county');
      // school_name may contain commas; the county column is safer read from the
      // first quoted-aware split is overkill here — names without commas dominate,
      // and we only need the set of counties that have ≥1 school. Use a parser.
      const counties = new Set();
      for (const line of schools) {
        // minimal CSV field reader honoring double-quotes
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
        .map(name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
        .filter(slug => !existsSync(resolve(DATA, `states/${code}/counties/${slug}.csv`)));
      expect(missing, `${code}: counties with schools but no per-county file`).toEqual([]);
    }
  });
});
