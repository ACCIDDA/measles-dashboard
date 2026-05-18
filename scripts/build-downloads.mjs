#!/usr/bin/env node
/**
 * Build-time CSV generation for downloadable datasets.
 *
 * Reads the source dashboard JSON (currently `public/{STATE}/json/dashboard.json`
 * for each configured state) and emits CSVs under `public/data/...` so that
 * after `vite build` they are served at predictable static URLs:
 *
 *   /data/states/{state}.csv
 *       One row per county (the values shown when viewing the state map).
 *
 *   /data/states/{state}/counties/{county}.csv
 *       One row per school in that county (the values shown in the school list
 *       and school detail panel of the sidebar).
 *
 * Slugs are lowercase and kebab-cased: e.g. "New Hanover" -> "new-hanover".
 *
 * Column choices follow the principle: surface what the UI surfaces, so a
 * downloaded CSV matches what the user just looked at. See per-section
 * comments below for details.
 *
 * No third-party dependencies; uses only Node's built-in `fs` / `path` /
 * `url` modules.
 *
 * Idempotent: running multiple times produces the same outputs.
 *
 * Most helpers are exported so they can be unit-tested directly
 * (`scripts/build-downloads.test.mjs`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// State manifest
// ---------------------------------------------------------------------------
// Loop-friendly: add additional states here when data lands. Each entry
// describes where to find that state's dashboard JSON and what slug to use
// for the output paths.
export const STATES = [
  {
    slug: 'nc',
    name: 'North Carolina',
    dashboardJson: path.join(REPO_ROOT, 'public', 'NC', 'json', 'dashboard.json'),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a display name into a lowercase, kebab-case slug suitable for use
 * in a URL path segment. Example: "New Hanover" -> "new-hanover".
 */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining diacritical marks (U+0300..U+036F).
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Escape a single cell value for CSV output following RFC 4180.
 * - null / undefined become empty
 * - Numbers and booleans stringify
 * - Values containing a comma, quote, or newline are wrapped in quotes,
 *   with internal quotes doubled.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (s === '') return '';
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize a 2D array of [header, ...rows] to CSV text.
 */
export function toCsv(rows) {
  return rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

/**
 * Coverage tier classification matching `src/config/index.js`:
 *   >=95 -> High, >=90 -> Medium, else Low.
 */
export function covTierLabel(coverage) {
  if (coverage == null || Number.isNaN(coverage)) return '';
  if (coverage >= 95) return 'High';
  if (coverage >= 90) return 'Medium';
  return 'Low';
}

/**
 * Parse a coverage_breakdown cell. The source data uses strings, with "-"
 * (or other non-numeric) representing missing values. Returns a number or
 * null.
 */
export function parseBreakdownCell(raw) {
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Write `content` to `outPath`, creating parent directories as needed.
 * Skips the write if the file already exists with identical bytes (keeps
 * mtimes stable across re-runs).
 */
export function writeFileIfChanged(outPath, content) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (fs.existsSync(outPath)) {
    try {
      const existing = fs.readFileSync(outPath, 'utf8');
      if (existing === content) return false;
    } catch {
      // fall through to write
    }
  }
  fs.writeFileSync(outPath, content, 'utf8');
  return true;
}

// ---------------------------------------------------------------------------
// CSV builders
// ---------------------------------------------------------------------------

/**
 * Build the state-level summary CSV: one row per county, mirroring the
 * stats the UI surfaces when the state map is in its default view.
 *
 * Columns chosen from what the dashboard displays:
 *   - county: the county name (without " County" suffix)
 *   - schools: total number of schools in that county
 *     (matches the "Schools" stat in the county tooltip / sidebar)
 *   - avg_coverage_pct: aggregate vaccination coverage
 *     (matches `coverage` in source JSON, the "Avg coverage" tooltip
 *     value and "Avg Coverage" sidebar stat)
 *   - coverage_low_pct / coverage_high_pct: the confidence interval
 *     present in the source data (`cov_low` / `cov_high`)
 *   - undervaccinated_pct: percent of schools with coverage < 95%
 *     (matches the "Below 95%" sidebar stat; also drives the "Below 95%"
 *     map view)
 *   - tier: High / Medium / Low classification matching `covTier`
 *     in src/config/index.js (used for the coverage-view map color)
 *   - herd_immunity_schools: number of schools in the county estimated
 *     to be above herd immunity threshold (from source `herd_immunity`)
 */
export const STATE_CSV_HEADER = [
  'county',
  'schools',
  'avg_coverage_pct',
  'coverage_low_pct',
  'coverage_high_pct',
  'undervaccinated_pct',
  'tier',
  'herd_immunity_schools',
];

export function buildStateCsv(dashboard) {
  const rows = (dashboard.counties || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => {
      const schools = Array.isArray(c.schools) ? c.schools : [];
      const totalSchools = schools.length;
      const below95 = schools.filter(s => s.stats && s.stats.Coverage < 95).length;
      const undervaxPct = totalSchools > 0 ? (below95 / totalSchools) * 100 : null;
      return [
        c.name,
        totalSchools,
        c.coverage != null ? Number(c.coverage).toFixed(1) : '',
        c.cov_low != null ? Number(c.cov_low).toFixed(1) : '',
        c.cov_high != null ? Number(c.cov_high).toFixed(1) : '',
        undervaxPct != null ? undervaxPct.toFixed(1) : '',
        covTierLabel(c.coverage),
        c.herd_immunity != null ? c.herd_immunity : '',
      ];
    });

  return toCsv([STATE_CSV_HEADER, ...rows]);
}

/**
 * Build the per-county CSV: one row per school in that county, mirroring
 * what's visible in the sidebar's school list and the school-detail panel.
 *
 * Columns:
 *   - school: school name (as displayed)
 *   - enrollment: number of students (source `Size`, surfaced indirectly
 *     in the school detail context and useful for downstream analysis)
 *   - coverage_pct: overall vaccination coverage shown next to the school
 *     in the list and as the headline value in the detail panel
 *   - tier: High / Medium / Low (matches the color/badge in the UI)
 *   - estimated_K_pct ... estimated_5th_pct: per-grade estimated coverage
 *     from the detail-panel "Estimated" tab
 *   - reported_K_pct ... reported_5th_pct: per-grade reported coverage
 *     from the detail-panel "Reported" tab (blank where source flags it
 *     as model-estimated rather than reported)
 *
 * Grade labels match src/config/index.js (GRADES = K, 1st, 2nd, 3rd, 4th, 5th).
 * Source uses `coverage_grades = ["5_6","6_7","7_8","8_9","9_10","10_11"]`
 * (age bands); index i maps to GRADES[i].
 */
export const GRADE_LABELS = ['K', '1st', '2nd', '3rd', '4th', '5th'];

export const COUNTY_CSV_HEADER = (() => {
  const h = ['school', 'enrollment', 'coverage_pct', 'tier'];
  for (const g of GRADE_LABELS) h.push(`estimated_${g}_pct`);
  for (const g of GRADE_LABELS) h.push(`reported_${g}_pct`);
  return h;
})();

export function buildCountyCsv(county) {
  const schools = (Array.isArray(county.schools) ? county.schools : [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = schools.map(school => {
    const stats = school.stats || {};
    const breakdown = Array.isArray(stats.coverage_breakdown) ? stats.coverage_breakdown : [];
    const estimatedFlags = Array.isArray(stats.Estimated) ? stats.Estimated : [];
    const coverage = stats.Coverage;

    const row = [
      school.name,
      stats.Size != null ? stats.Size : '',
      coverage != null ? Number(coverage).toFixed(1) : '',
      covTierLabel(coverage),
    ];

    // Per-grade estimated values: every breakdown value as a number (or null).
    for (let i = 0; i < GRADE_LABELS.length; i++) {
      const v = parseBreakdownCell(breakdown[i]);
      row.push(v != null ? v.toFixed(1) : '');
    }
    // Per-grade reported values: same data, but blank where Estimated[i]
    // is true (those cells are model-estimated, not reported).
    for (let i = 0; i < GRADE_LABELS.length; i++) {
      if (estimatedFlags[i] === true) {
        row.push('');
      } else {
        const v = parseBreakdownCell(breakdown[i]);
        row.push(v != null ? v.toFixed(1) : '');
      }
    }
    return row;
  });

  return toCsv([COUNTY_CSV_HEADER, ...rows]);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Process a single state: read its dashboard JSON and emit one state-level
 * CSV plus a per-county CSV for each county.
 *
 * Pure with respect to its inputs: takes the full `stateCfg` and the output
 * directory explicitly so tests can drive it against a temp directory.
 *
 * @returns {{ stateFiles: number, countyFiles: number, stateChanged: boolean, countyChanged: number, skipped: boolean, stateCsvPath?: string, countyCsvPaths?: string[] }}
 */
export function processState(stateCfg, outDir, { logger = console } = {}) {
  if (!fs.existsSync(stateCfg.dashboardJson)) {
    logger.warn(`[build-downloads] skipping ${stateCfg.slug}: missing source ${stateCfg.dashboardJson}`);
    return { stateFiles: 0, countyFiles: 0, stateChanged: false, countyChanged: 0, skipped: true };
  }

  const dashboard = JSON.parse(fs.readFileSync(stateCfg.dashboardJson, 'utf8'));

  // 1. State-level CSV: public/data/states/{state}.csv
  const stateCsvPath = path.join(outDir, 'states', `${stateCfg.slug}.csv`);
  const stateCsv = buildStateCsv(dashboard);
  const stateChanged = writeFileIfChanged(stateCsvPath, stateCsv);

  // 2. Per-county CSVs: public/data/states/{state}/counties/{county}.csv
  const countiesDir = path.join(outDir, 'states', stateCfg.slug, 'counties');
  let countyChanged = 0;
  const wantedSlugs = new Set();
  const countyCsvPaths = [];
  const counties = Array.isArray(dashboard.counties) ? dashboard.counties : [];
  for (const county of counties) {
    const slug = slugify(county.name);
    if (!slug) continue;
    wantedSlugs.add(`${slug}.csv`);
    const countyCsv = buildCountyCsv(county);
    const countyPath = path.join(countiesDir, `${slug}.csv`);
    countyCsvPaths.push(countyPath);
    if (writeFileIfChanged(countyPath, countyCsv)) countyChanged++;
  }

  // 3. Clean up stale county CSVs that no longer correspond to a county in
  //    the source. Keeps the output directory in sync rather than just
  //    additive (still idempotent: a stable input -> stable on-disk set).
  if (fs.existsSync(countiesDir)) {
    for (const entry of fs.readdirSync(countiesDir)) {
      if (entry.endsWith('.csv') && !wantedSlugs.has(entry)) {
        fs.unlinkSync(path.join(countiesDir, entry));
      }
    }
  }

  logger.log(
    `[build-downloads] ${stateCfg.slug}: ${stateChanged ? 'wrote' : 'unchanged'} ` +
    `${path.relative(REPO_ROOT, stateCsvPath)} ` +
    `+ ${counties.length} county CSVs (${countyChanged} updated)`
  );

  return {
    stateFiles: 1,
    countyFiles: counties.length,
    stateChanged,
    countyChanged,
    skipped: false,
    stateCsvPath,
    countyCsvPaths,
  };
}

/**
 * Run the full build for a list of states into a given output directory.
 *
 * Defaults reproduce the production CLI behavior (the configured `STATES`
 * manifest writing into `public/data`). Tests can override both arguments
 * to drive the build with synthetic data in a temp directory.
 */
export function runBuild({ states = STATES, outDir = path.join(REPO_ROOT, 'public', 'data'), logger = console } = {}) {
  fs.mkdirSync(outDir, { recursive: true });

  let totalState = 0;
  let totalCounty = 0;
  const results = [];
  for (const stateCfg of states) {
    const r = processState(stateCfg, outDir, { logger });
    results.push({ stateCfg, ...r });
    if (!r.skipped) {
      totalState += r.stateFiles;
      totalCounty += r.countyFiles;
    }
  }
  logger.log(`[build-downloads] done. ${totalState} state CSV(s), ${totalCounty} county CSV(s).`);
  return { totalState, totalCounty, results };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
// Only runs when invoked directly (e.g. `node scripts/build-downloads.mjs`).
// When imported by tests this block is skipped.
const isDirectInvocation = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isDirectInvocation) {
  runBuild();
}
