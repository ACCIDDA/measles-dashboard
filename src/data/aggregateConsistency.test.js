import { describe, it, expect } from 'vitest';
import { checkAggregateConsistency } from './validate.js';

// Aggregate-consistency warnings (#85). These are advisory, rounding-tolerant
// checks: a county's coverage should fall within its schools' coverage range,
// and a state's within its counties'. Pre-aggregated states (NC) can legitimately
// violate the invariant, so the function only WARNS and never fails - hence we
// test the warning logic on synthetic data, not the real public/data values.

const county = (name, coverage) => ({ county: name, coverage });
const school = (countyName, coverage) => ({ county: countyName, coverage });

describe('checkAggregateConsistency (#85)', () => {
  it('produces no warning when the county coverage is within its schools range', () => {
    const counties = [county('Alpha', '0.90')];
    const schools = [school('Alpha', '0.80'), school('Alpha', '0.95')];
    expect(checkAggregateConsistency('xx', null, counties, schools)).toEqual([]);
  });

  it('warns when the county coverage is outside its schools range', () => {
    const counties = [county('Alpha', '0.97')];
    const schools = [school('Alpha', '0.80'), school('Alpha', '0.95')];
    const warnings = checkAggregateConsistency('ca', null, counties, schools);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/state ca county Alpha: coverage 0.97 outside schools range \[0.8, 0.95\]/);
  });

  it('skips a county whose coverage is blank (censored / not available)', () => {
    const counties = [county('Alpha', '')];
    const schools = [school('Alpha', '0.10'), school('Alpha', '0.20')];
    expect(checkAggregateConsistency('xx', null, counties, schools)).toEqual([]);
  });

  it('skips a county whose schools all have blank coverage', () => {
    const counties = [county('Alpha', '0.50')];
    const schools = [school('Alpha', ''), school('Alpha', '')];
    expect(checkAggregateConsistency('xx', null, counties, schools)).toEqual([]);
  });

  it('allows a boundary case within the rounding tolerance', () => {
    // 0.9504 sits just above the max 0.95; inside AGG_BOUNDARY_EPS (0.0005).
    const counties = [county('Alpha', '0.9504')];
    const schools = [school('Alpha', '0.80'), school('Alpha', '0.95')];
    expect(checkAggregateConsistency('xx', null, counties, schools)).toEqual([]);
  });

  it('warns when the state coverage is outside its counties range', () => {
    const counties = [county('Alpha', '0.80'), county('Beta', '0.90')];
    const schools = [];
    const stateRow = { coverage: '0.99' };
    const warnings = checkAggregateConsistency('ca', stateRow, counties, schools);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/state ca: coverage 0.99 outside counties range \[0.8, 0.9\]/);
  });

  it('skips the state check when the state coverage is blank', () => {
    const counties = [county('Alpha', '0.80'), county('Beta', '0.90')];
    const stateRow = { coverage: '' };
    expect(checkAggregateConsistency('xx', stateRow, counties, [])).toEqual([]);
  });
});
