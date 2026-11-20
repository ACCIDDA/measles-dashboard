// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoLocalCsv } from './check-public-data.mjs';

describe('dashboard public assets', () => {
  it('contains no local CSV datasets', () => {
    expect(() => assertNoLocalCsv(fileURLToPath(new URL('../public', import.meta.url)))).not.toThrow();
  });

  it('allows metadata but rejects leftover CSVs at any depth', () => {
    const directory = mkdtempSync(join(tmpdir(), 'measles-public-'));
    try {
      mkdirSync(join(directory, 'data/states/nc/counties'), { recursive: true });
      writeFileSync(join(directory, 'data/stateRegistry.json'), '{}');
      expect(() => assertNoLocalCsv(directory)).not.toThrow();
      writeFileSync(join(directory, 'data/all-schools.csv'), 'state,school_id\n');
      writeFileSync(join(directory, 'data/states/nc/counties/wake.CSV'), 'school_id\n');
      expect(() => assertNoLocalCsv(directory)).toThrow(/all-schools\.csv[\s\S]*wake\.CSV/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
