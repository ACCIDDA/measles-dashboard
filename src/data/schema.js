// Single source of truth for the published dataset schema (#77).
//
// The CSV contract test (csvSchema.test.js), the generated machine-readable
// schema (public/data/schema.json), and the API.md column tables all derive
// from this one definition, so they cannot drift from each other. The R
// producers (build_state.R / build_nc_from_estimates.R) are the *ultimate*
// source of truth for what the CSVs contain; the contract test validates the
// real CSVs against this definition, so a producer change that diverges fails
// CI until this file is updated to match.
//
// Types are a small language-agnostic vocabulary so the JSON is easy to map
// into any reader:
//   "string"  -> e.g. Arrow string / pandas object
//   "integer" -> e.g. Arrow int64
//   "number"  -> e.g. Arrow float64 (coverage values are proportions in [0, 1])

const GRADES = ['K', '1', '2', '3', '4', '5'];

// Shared coverage block, in the exact order the producers emit it.
export const COVERAGE_BLOCK = [
  { name: 'coverage', type: 'number', description: 'Overall MMR coverage (proportion, 0-1)' },
  { name: 'coverage_ci_low', type: 'number', description: 'Lower bound, 95% credible interval for coverage' },
  { name: 'coverage_ci_high', type: 'number', description: 'Upper bound, 95% credible interval for coverage' },
  ...GRADES.map((g) => ({ name: `coverage_${g}`, type: 'number', description: `Per-grade coverage (grade ${g})` })),
  ...GRADES.map((g) => ({ name: `coverage_ci_low_${g}`, type: 'number', description: `Per-grade CI lower bound (grade ${g})` })),
  ...GRADES.map((g) => ({ name: `coverage_ci_high_${g}`, type: 'number', description: `Per-grade CI upper bound (grade ${g})` })),
  { name: 'prob_below_95', type: 'number', description: 'Posterior probability that coverage is below 95%' },
  { name: 'tier', type: 'string', description: 'Coverage tier: H (>=95%), M (90-95%), L (<90%)' },
];

// Leading identity columns, per file shape.
const STATE_ID = [
  { name: 'state', type: 'string', description: 'Two-letter USPS state code' },
  { name: 'state_fips', type: 'string', description: '2-digit state FIPS code' },
  { name: 'state_name', type: 'string', description: 'State name' },
  { name: 'n_schools', type: 'integer', description: 'Number of schools in the state' },
  { name: 'pct_schools_below_95', type: 'number', description: 'Fraction of schools below 95% coverage (0-1)' },
];
const COUNTY_ID = [
  { name: 'county', type: 'string', description: 'County name' },
  { name: 'county_fips', type: 'string', description: '5-digit county FIPS code' },
  { name: 'n_schools', type: 'integer', description: 'Number of schools in the county' },
  { name: 'pct_schools_below_95', type: 'number', description: 'Fraction of schools below 95% coverage (0-1)' },
];
const SCHOOL_ID = [
  { name: 'school_id', type: 'string', description: 'School identifier' },
  { name: 'school_name', type: 'string', description: 'School name' },
  { name: 'county', type: 'string', description: 'County name' },
  { name: 'enrollment', type: 'integer', description: 'K-5 enrollment' },
  { name: 'lon', type: 'number', description: 'Longitude (may be blank)' },
  { name: 'lat', type: 'number', description: 'Latitude (may be blank)' },
  { name: 'no_data', type: 'integer', description: '1 if the school has a location but no model estimate, else 0' },
];

// Each published file's full, ordered column list = identity + coverage block.
export const FILES = {
  'data/states.csv': {
    description: 'One row per state (national summary).',
    columns: [...STATE_ID, ...COVERAGE_BLOCK],
  },
  'data/states/{state}.csv': {
    description: 'One row per county in a state.',
    columns: [...COUNTY_ID, ...COVERAGE_BLOCK],
  },
  'data/all-schools.csv': {
    description: 'One row per school nationwide, with a leading state column.',
    columns: [{ name: 'state', type: 'string', description: 'Two-letter USPS state code' }, ...SCHOOL_ID, ...COVERAGE_BLOCK],
  },
  'data/states/{state}/schools.csv': {
    description: 'One row per school in a state.',
    columns: [...SCHOOL_ID, ...COVERAGE_BLOCK],
  },
  'data/states/{state}/counties/{county}.csv': {
    description: 'One row per school in a county (the county column is dropped; the path identifies the county).',
    columns: [...SCHOOL_ID.filter((c) => c.name !== 'county'), ...COVERAGE_BLOCK],
  },
};

// Convenience: the ordered column names for a file shape.
export function columnNames(file) {
  return FILES[file].columns.map((c) => c.name);
}

// The object serialized to public/data/schema.json.
export const SCHEMA = {
  description: 'Column schema for the measles-dashboard static dataset API. '
    + 'Coverage values are proportions in [0, 1]. Types: string, integer, number. '
    + 'Generated from src/data/schema.js by scripts/build-schema-json.mjs; do not edit by hand.',
  files: FILES,
};
