// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderApiMd } from '../../scripts/gen-api-schema.mjs';
import { validateRows, checkTierConsistency } from './validate.js';

// Unit tests are independent of datasets in a developer's working directory.
// Registration and check-state-data validate the actual remote CSV responses.
describe('published schema contract', () => {
  it('keeps docs/API.md tables in sync with schema.js', () => {
    const md = readFileSync(new URL('../../docs/API.md', import.meta.url), 'utf8');
    expect(renderApiMd(md).replace(/\r\n/g, '\n')).toBe(md.replace(/\r\n/g, '\n'));
  });

  it('accepts missing optional school measurements', () => {
    expect(validateRows('data/states/{state}/schools.csv', [{
      school_id: '1', school_name: '', county: 'Wake', no_data: '1',
      coverage: '', lon: '', lat: '',
    }])).toEqual([]);
  });

  it.each([
    [{ coverage: '1.5' }, /above maximum/],
    [{ no_data: '2' }, /not one of/],
    [{ enrollment: '1.5' }, /expected integer/],
    [{ lon: '-181' }, /below minimum/],
  ])('rejects invalid school values: %j', (row, expected) => {
    expect(validateRows('data/states/{state}/schools.csv', [row]).join('\n')).toMatch(expected);
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
