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

const isBlank = (v) => v === '' || v === null || v === undefined;

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

// Validate parsed rows (array of objects keyed by column name, e.g. from
// d3-dsv csvParse) for a given file shape key (a key of FILES). Returns an
// array of human-readable error strings; empty means conformant.
export function validateRows(fileKey, rows) {
  const def = FILES[fileKey];
  if (!def) return [`unknown file shape "${fileKey}"`];

  const errors = [];
  rows.forEach((row, i) => {
    for (const column of def.columns) {
      const err = checkCell(column, row[column.name]);
      // Row 1 = first data row (header is not a row here).
      if (err) errors.push(`row ${i + 1}, column "${column.name}": ${err}`);
    }
  });
  return errors;
}
