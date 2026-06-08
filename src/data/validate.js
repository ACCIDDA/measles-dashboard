// Row-level conformance validation for the published CSVs (#78/#82).
//
// The header/column-set contract is enforced by csvSchema.test.js against
// columnNames(); this adds VALUE checks (types + the `constraints` declared in
// schema.js) so a contributed state's data cannot merge with out-of-range
// coverage, an unknown tier, malformed FIPS, etc. The same logic backs both the
// CI gate (csvSchema.test.js) and the contributor CLI (scripts/validate-data.mjs),
// so "passes locally" and "passes CI" mean the same thing.
//
// Blanks are always allowed: the data uses empty cells for "not available"
// (NC's per-grade and CI columns, county_fips, and lon/lat/coverage/tier for
// schools with a location but no model estimate). Constraints only apply to
// non-empty cells.
import { FILES } from './schema.js';
import { covTier } from '../config/index.js';

const isBlank = (v) => v === '' || v === null || v === undefined;

// Tier consistency (#82, prompted by pearsonca on #83): a row's `tier` should
// agree with the bucket its `coverage` falls into, using the dashboard's own
// covTier (>=95 H, >=90 M, else L). But `coverage` is published rounded to 4
// decimals while the producer tiers from the unrounded value, so a value that
// rounds to exactly a threshold (e.g. 0.95 that was really 0.9499 -> M) is
// genuinely ambiguous. We therefore only flag a tier that is wrong by more than
// a rounding band around the 0.90 / 0.95 boundaries - catching real mislabels
// without rejecting valid boundary rounding (which is itself the reason the
// marker is stored rather than always inferred).
const TIER_THRESHOLDS = [0.9, 0.95]; // proportions; mirror covTier's 90 / 95
const TIER_BOUNDARY_EPS = 0.0005; // absorbs 4-decimal rounding at the boundaries

export function checkTierConsistency(coverage, tier) {
  if (isBlank(coverage) || isBlank(tier)) return null; // need both to compare
  const c = Number(coverage);
  if (!Number.isFinite(c)) return null; // type check handles non-numbers
  const expected = covTier(c * 100);
  if (tier === expected) return null;
  // Near a threshold, rounding can flip the bucket; accept either side there.
  if (TIER_THRESHOLDS.some((t) => Math.abs(c - t) <= TIER_BOUNDARY_EPS)) return null;
  return `tier "${tier}" inconsistent with coverage ${c} (expected "${expected}")`;
}

// Validate a single cell against its column definition. Returns an error string
// (without row context) or null when the cell conforms.
export function checkCell(column, raw) {
  if (isBlank(raw)) return null; // blank = "not available", always allowed

  const { type, constraints } = column;

  // Type.
  if (type === 'integer' && !/^-?\d+$/.test(raw)) {
    return `expected integer, got "${raw}"`;
  }
  if (type === 'number' && !Number.isFinite(Number(raw))) {
    return `expected number, got "${raw}"`;
  }

  if (!constraints) return null;

  // Bounds (numeric).
  if (constraints.min !== undefined || constraints.max !== undefined) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return `expected a number in range, got "${raw}"`;
    if (constraints.min !== undefined && n < constraints.min) {
      return `value ${n} below minimum ${constraints.min}`;
    }
    if (constraints.max !== undefined && n > constraints.max) {
      return `value ${n} above maximum ${constraints.max}`;
    }
  }

  // Enumerated set (compared as strings, so [0, 1] matches "0"/"1").
  if (constraints.enum) {
    const allowed = constraints.enum.map(String);
    if (!allowed.includes(String(raw))) {
      return `value "${raw}" not one of [${allowed.join(', ')}]`;
    }
  }

  // Pattern.
  if (constraints.pattern && !new RegExp(constraints.pattern).test(raw)) {
    return `value "${raw}" does not match ${constraints.pattern}`;
  }

  return null;
}

// Aggregate consistency (#85, decided non-blocking per the issue thread): a
// county's `coverage` should fall within the [min, max] of its schools'
// `coverage`, and a state's within [min, max] of its counties'. For a fully
// modeled state this is a true invariant, but pre-aggregated states (NC) compute
// their county/state values upstream rather than from the published child rows,
// so they can legitimately violate it. We therefore surface these as advisory
// WARNINGS for the human reviewer rather than hard failures - the conformance
// check (validateRows) stays the only gate.
//
// Tolerance mirrors checkTierConsistency: coverage is published rounded to 4
// decimals, so an aggregate sitting a hair outside the children's rounded range
// is just rounding, not a real discrepancy.
const AGG_BOUNDARY_EPS = 0.0005; // absorbs 4-decimal rounding at the range edges

// Min/max of the non-blank, finite `coverage` values among `rows`. Returns null
// when none qualify (all censored / "not available"), so the caller can skip.
function coverageRange(rows) {
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const c = row.coverage;
    if (isBlank(c)) continue;
    const n = Number(c);
    if (!Number.isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  if (min === Infinity) return null;
  return { min, max };
}

// Group `rows` (parsed objects) by the value of `key`, preserving row order.
function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const k = row[key];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(row);
  }
  return groups;
}

// Compute aggregate-consistency warnings for one state. `counties` and `schools`
// are parsed rows (from d3-dsv csvParse) of states/<code>.csv and
// states/<code>/schools.csv respectively; `stateRow` is this state's row from
// states.csv (or null/undefined to skip the state-vs-counties check). `code` is
// the two-letter state code, used only for readable messages. Returns an array
// of human-readable warning strings; empty means consistent (or all censored).
//
// A row is skipped when its own `coverage` is blank, or when its children have
// no usable coverage values at all - in both cases there is nothing to compare.
export function checkAggregateConsistency(code, stateRow, counties, schools) {
  const warnings = [];

  // County coverage vs its schools' coverage range.
  const schoolsByCounty = groupBy(schools, 'county');
  for (const county of counties) {
    if (isBlank(county.coverage)) continue;
    const c = Number(county.coverage);
    if (!Number.isFinite(c)) continue;
    const range = coverageRange(schoolsByCounty.get(county.county) || []);
    if (!range) continue; // no school coverage to compare against
    if (c < range.min - AGG_BOUNDARY_EPS || c > range.max + AGG_BOUNDARY_EPS) {
      warnings.push(
        `state ${code} county ${county.county}: coverage ${c} outside schools range `
          + `[${range.min}, ${range.max}]`,
      );
    }
  }

  // State coverage vs its counties' coverage range.
  if (stateRow && !isBlank(stateRow.coverage)) {
    const s = Number(stateRow.coverage);
    if (Number.isFinite(s)) {
      const range = coverageRange(counties);
      if (range && (s < range.min - AGG_BOUNDARY_EPS || s > range.max + AGG_BOUNDARY_EPS)) {
        warnings.push(
          `state ${code}: coverage ${s} outside counties range [${range.min}, ${range.max}]`,
        );
      }
    }
  }

  return warnings;
}

// Validate parsed rows (array of objects keyed by column name, e.g. from
// d3-dsv csvParse) for a given file shape key (a key of FILES). Returns an
// array of human-readable error strings; empty means conformant.
export function validateRows(fileKey, rows) {
  const def = FILES[fileKey];
  if (!def) return [`unknown file shape "${fileKey}"`];

  const names = def.columns.map((c) => c.name);
  const hasTierCheck = names.includes('coverage') && names.includes('tier');

  const errors = [];
  rows.forEach((row, i) => {
    for (const column of def.columns) {
      const err = checkCell(column, row[column.name]);
      // Row 1 = first data row (header is not a row here).
      if (err) errors.push(`row ${i + 1}, column "${column.name}": ${err}`);
    }
    if (hasTierCheck) {
      const tierErr = checkTierConsistency(row.coverage, row.tier);
      if (tierErr) errors.push(`row ${i + 1}: ${tierErr}`);
    }
  });
  return errors;
}
