// @vitest-environment node
/**
 * Tests for scripts/build-downloads.mjs
 *
 * Two layers of coverage:
 *   1. Pure-function unit tests for the small helpers (slug/CSV/tier).
 *   2. An end-to-end test that drives `runBuild()` against a synthetic
 *      dashboard JSON written into a temp directory, then re-runs it to
 *      confirm idempotency.
 *
 * No reliance on the real `public/NC/json/dashboard.json` — the temp-dir
 * fixture means this test passes even if that file is missing or changes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  slugify,
  csvCell,
  toCsv,
  covTierLabel,
  parseBreakdownCell,
  buildStateCsv,
  buildCountyCsv,
  processState,
  runBuild,
  STATE_CSV_HEADER,
  COUNTY_CSV_HEADER,
  GRADE_LABELS,
} from './build-downloads.mjs';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

/**
 * Minimal synthetic dashboard JSON that exercises every output path:
 *  - Multi-word county name -> kebab-case slug
 *  - Single-word county name
 *  - Schools with mix of <95% and >=95% coverage
 *  - One school with name containing a comma (CSV escaping)
 *  - Estimated[] flags that cause the reported_K_pct cell to be blank
 *  - A "-" entry in coverage_breakdown to verify missing-cell handling
 */
const FIXTURE_DASHBOARD = {
  counties: [
    {
      name: 'New Hanover',
      coverage: 92.5,
      cov_low: 90.1,
      cov_high: 94.0,
      herd_immunity: 12,
      schools: [
        {
          name: 'Acme Elementary',
          stats: {
            Coverage: 97.4,
            Size: 500,
            Estimated: [true, false, false, false, false, false],
            coverage_grades: ['5_6', '6_7', '7_8', '8_9', '9_10', '10_11'],
            coverage_breakdown: ['96', '97', '99', '98', '97', '100'],
            coverage_risk: ['lorisk', 'lorisk', 'lorisk', 'lorisk', 'lorisk', 'lorisk'],
          },
        },
        {
          name: 'Bayside Charter, Inc.',
          stats: {
            Coverage: 88.0,
            Size: 220,
            Estimated: [false, false, false, false, false, false],
            coverage_grades: ['5_6', '6_7', '7_8', '8_9', '9_10', '10_11'],
            coverage_breakdown: ['85', '90', '-', '88', '92', '85'],
            coverage_risk: ['hirisk', 'mdrisk', 'hirisk', 'hirisk', 'mdrisk', 'hirisk'],
          },
        },
      ],
    },
    {
      name: 'Wake',
      coverage: 95.6,
      cov_low: 94.2,
      cov_high: 96.9,
      herd_immunity: 30,
      schools: [
        {
          name: 'Cardinal Academy',
          stats: {
            Coverage: 96.1,
            Size: 800,
            Estimated: [true, false, false, false, false, false],
            coverage_grades: ['5_6', '6_7', '7_8', '8_9', '9_10', '10_11'],
            coverage_breakdown: ['95', '96', '96', '97', '95', '98'],
            coverage_risk: ['lorisk', 'lorisk', 'lorisk', 'lorisk', 'lorisk', 'lorisk'],
          },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Pure-function tests
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('lowercases simple names', () => {
    expect(slugify('Wake')).toBe('wake');
  });
  it('kebab-cases multi-word names', () => {
    expect(slugify('New Hanover')).toBe('new-hanover');
  });
  it('handles punctuation and trims dashes', () => {
    expect(slugify("St. Mary's")).toBe('st-mary-s');
    expect(slugify('  Spaces  ')).toBe('spaces');
  });
});

describe('csvCell', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('')).toBe('');
  });
  it('stringifies numbers and booleans', () => {
    expect(csvCell(42)).toBe('42');
    expect(csvCell(3.14)).toBe('3.14');
    expect(csvCell(true)).toBe('true');
  });
  it('quotes values containing commas, quotes, or newlines', () => {
    expect(csvCell('hello, world')).toBe('"hello, world"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });
  it('leaves clean strings unquoted', () => {
    expect(csvCell('plain')).toBe('plain');
  });
});

describe('toCsv', () => {
  it('joins rows with newlines and ends with a trailing newline', () => {
    const out = toCsv([['a', 'b'], ['1', '2']]);
    expect(out).toBe('a,b\n1,2\n');
  });
});

describe('covTierLabel', () => {
  it.each([
    [100, 'High'],
    [95, 'High'],
    [94.9, 'Medium'],
    [90, 'Medium'],
    [89.9, 'Low'],
    [0, 'Low'],
  ])('classifies %s as %s', (v, label) => {
    expect(covTierLabel(v)).toBe(label);
  });
  it('returns empty for missing input', () => {
    expect(covTierLabel(null)).toBe('');
    expect(covTierLabel(undefined)).toBe('');
    expect(covTierLabel(NaN)).toBe('');
  });
});

describe('parseBreakdownCell', () => {
  it('parses numeric strings', () => {
    expect(parseBreakdownCell('96')).toBe(96);
    expect(parseBreakdownCell('88.5')).toBe(88.5);
  });
  it('returns null for non-numeric placeholders', () => {
    expect(parseBreakdownCell('-')).toBe(null);
    expect(parseBreakdownCell('')).toBe(null);
    expect(parseBreakdownCell(null)).toBe(null);
    expect(parseBreakdownCell(undefined)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// CSV builders
// ---------------------------------------------------------------------------

describe('buildStateCsv', () => {
  const csv = buildStateCsv(FIXTURE_DASHBOARD);
  const lines = csv.trimEnd().split('\n');

  it('has the documented header', () => {
    expect(lines[0]).toBe(STATE_CSV_HEADER.join(','));
  });

  it('emits one row per county', () => {
    // 1 header + 2 counties = 3 lines
    expect(lines).toHaveLength(3);
  });

  it('sorts counties alphabetically', () => {
    // New Hanover < Wake
    expect(lines[1].startsWith('New Hanover,')).toBe(true);
    expect(lines[2].startsWith('Wake,')).toBe(true);
  });

  it('computes undervaccinated_pct as the share of schools below 95%', () => {
    // New Hanover: Acme 97.4 (>=95), Bayside 88.0 (<95) -> 1/2 = 50.0
    const cols = lines[1].split(',');
    const headerIdx = STATE_CSV_HEADER.indexOf('undervaccinated_pct');
    expect(cols[headerIdx]).toBe('50.0');
  });

  it('emits the correct tier for each county', () => {
    // New Hanover coverage 92.5 -> Medium; Wake 95.6 -> High
    const tierIdx = STATE_CSV_HEADER.indexOf('tier');
    expect(lines[1].split(',')[tierIdx]).toBe('Medium');
    expect(lines[2].split(',')[tierIdx]).toBe('High');
  });
});

describe('buildCountyCsv', () => {
  const wake = FIXTURE_DASHBOARD.counties.find(c => c.name === 'Wake');
  const newHanover = FIXTURE_DASHBOARD.counties.find(c => c.name === 'New Hanover');

  it('has school + enrollment + coverage + tier + 12 grade columns', () => {
    const csv = buildCountyCsv(wake);
    const header = csv.split('\n')[0].split(',');
    // 4 leading + 6 estimated + 6 reported = 16 columns
    expect(header).toHaveLength(4 + 2 * GRADE_LABELS.length);
    expect(header).toEqual(COUNTY_CSV_HEADER);
  });

  it('produces one row per school', () => {
    const lines = buildCountyCsv(newHanover).trimEnd().split('\n');
    // header + 2 schools
    expect(lines).toHaveLength(3);
  });

  it('escapes school names containing commas', () => {
    const csv = buildCountyCsv(newHanover);
    expect(csv).toContain('"Bayside Charter, Inc."');
  });

  it('leaves reported_K_pct blank when Estimated[0] is true', () => {
    const csv = buildCountyCsv(newHanover);
    const lines = csv.trimEnd().split('\n');
    const header = lines[0].split(',');
    const reportedKIdx = header.indexOf('reported_K_pct');
    // Acme has Estimated[0]=true -> blank reported_K_pct.
    const acmeRow = lines.find(l => l.startsWith('Acme Elementary,'));
    expect(acmeRow.split(',')[reportedKIdx]).toBe('');
  });

  it('preserves reported values when Estimated[i] is false', () => {
    const csv = buildCountyCsv(newHanover);
    const lines = csv.trimEnd().split('\n');
    const header = lines[0].split(',');
    const reportedKIdx = header.indexOf('reported_K_pct');
    // Bayside has all Estimated=false -> reported_K_pct present.
    const baysideRow = lines.find(l => l.startsWith('"Bayside Charter, Inc."'));
    // Index lookup against the escaped row needs awareness of the quote-grouped
    // first cell. Split on ',' is fine here because the only quoted field is the
    // first column.
    const cells = baysideRow.split(',');
    // The quoted name takes columns 0..1 ("Bayside Charter -> "" Inc.""")
    // when naively split. Reconstruct: find the first un-escaped column by
    // popping the prefix that ends on the closing quote.
    const closeIdx = baysideRow.indexOf('"', 1) + 1;
    const rest = baysideRow.slice(closeIdx + 1).split(',');
    expect(rest[reportedKIdx - 1]).toBe('85.0'); // -1 because we stripped the name
    // sanity: cells exists (lint friendliness)
    expect(cells.length).toBeGreaterThan(0);
  });

  it('represents missing breakdown ("-") cells as empty string', () => {
    const csv = buildCountyCsv(newHanover);
    const lines = csv.trimEnd().split('\n');
    const header = lines[0].split(',');
    // Bayside coverage_breakdown[2] = '-' -> estimated_2nd_pct should be blank.
    const estimated2ndIdx = header.indexOf('estimated_2nd_pct');
    const baysideRow = lines.find(l => l.startsWith('"Bayside Charter, Inc."'));
    const closeIdx = baysideRow.indexOf('"', 1) + 1;
    const rest = baysideRow.slice(closeIdx + 1).split(',');
    expect(rest[estimated2ndIdx - 1]).toBe('');
  });
});

// ---------------------------------------------------------------------------
// End-to-end: runBuild() with a temp dir
// ---------------------------------------------------------------------------

describe('runBuild end-to-end', () => {
  let tmpRoot;
  let dashboardPath;
  let outDir;
  let stateCfg;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'build-downloads-test-'));
    const inputDir = path.join(tmpRoot, 'input');
    outDir = path.join(tmpRoot, 'out');
    fs.mkdirSync(inputDir, { recursive: true });
    dashboardPath = path.join(inputDir, 'dashboard.json');
    fs.writeFileSync(dashboardPath, JSON.stringify(FIXTURE_DASHBOARD), 'utf8');
    stateCfg = { slug: 'nc', name: 'North Carolina', dashboardJson: dashboardPath };
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  // Silence the build's logger output during the test run.
  const silentLogger = { log: () => {}, warn: () => {} };

  it('emits the documented file paths', () => {
    const result = runBuild({ states: [stateCfg], outDir, logger: silentLogger });
    expect(result.totalState).toBe(1);
    expect(result.totalCounty).toBe(2);

    const stateCsv = path.join(outDir, 'states', 'nc.csv');
    const newHanoverCsv = path.join(outDir, 'states', 'nc', 'counties', 'new-hanover.csv');
    const wakeCsv = path.join(outDir, 'states', 'nc', 'counties', 'wake.csv');

    expect(fs.existsSync(stateCsv)).toBe(true);
    expect(fs.existsSync(newHanoverCsv)).toBe(true);
    expect(fs.existsSync(wakeCsv)).toBe(true);
  });

  it('writes a state CSV with the expected header and at least one data row', () => {
    const stateCsv = fs.readFileSync(path.join(outDir, 'states', 'nc.csv'), 'utf8');
    const lines = stateCsv.trimEnd().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toBe(STATE_CSV_HEADER.join(','));
    // Confirm at least one data row corresponds to a county in the fixture.
    expect(stateCsv).toMatch(/^New Hanover,/m);
  });

  it('writes a county CSV with the expected header and at least one data row', () => {
    const countyCsv = fs.readFileSync(path.join(outDir, 'states', 'nc', 'counties', 'new-hanover.csv'), 'utf8');
    const lines = countyCsv.trimEnd().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toBe(COUNTY_CSV_HEADER.join(','));
    // Both fixture schools should appear.
    expect(countyCsv).toContain('Acme Elementary,');
    expect(countyCsv).toContain('"Bayside Charter, Inc."');
  });

  it('is idempotent on re-run', () => {
    // Snapshot every output file's bytes...
    const allFiles = [
      path.join(outDir, 'states', 'nc.csv'),
      path.join(outDir, 'states', 'nc', 'counties', 'new-hanover.csv'),
      path.join(outDir, 'states', 'nc', 'counties', 'wake.csv'),
    ];
    const before = Object.fromEntries(allFiles.map(p => [p, fs.readFileSync(p)]));

    // ...run the build again...
    const result = runBuild({ states: [stateCfg], outDir, logger: silentLogger });

    // ...everything should match byte-for-byte.
    expect(result.results).toHaveLength(1);
    const r = result.results[0];
    expect(r.skipped).toBe(false);
    expect(r.stateChanged).toBe(false);
    expect(r.countyChanged).toBe(0);

    for (const p of allFiles) {
      const after = fs.readFileSync(p);
      expect(after.equals(before[p])).toBe(true);
    }
  });

  it('skips a state whose dashboardJson is missing (with a warning)', () => {
    const warnings = [];
    const logger = { log: () => {}, warn: msg => warnings.push(msg) };
    const result = runBuild({
      states: [{ slug: 'zz', name: 'No Such State', dashboardJson: path.join(tmpRoot, 'missing.json') }],
      outDir,
      logger,
    });
    expect(result.totalState).toBe(0);
    expect(result.totalCounty).toBe(0);
    expect(warnings.some(w => w.includes('skipping zz'))).toBe(true);
  });

  it('cleans up stale county CSVs no longer in source', () => {
    // Drop a stray file into the counties dir; the next build should remove it.
    const staleCsv = path.join(outDir, 'states', 'nc', 'counties', 'stale-county.csv');
    fs.writeFileSync(staleCsv, 'stub\n', 'utf8');
    expect(fs.existsSync(staleCsv)).toBe(true);

    processState(stateCfg, outDir, { logger: silentLogger });
    expect(fs.existsSync(staleCsv)).toBe(false);
  });
});
