// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkRegistryConflicts,
  discoverDataset,
  normalizeBaseUrl,
  parseRepositoryUrl,
  validateEndpoint,
  validateDataset,
} from './registration-core.mjs';

const columns = 'state,state_fips,state_name,n_schools,pct_schools_below_95,coverage,coverage_ci_low,coverage_ci_high,coverage_K,coverage_1,coverage_2,coverage_3,coverage_4,coverage_5,coverage_ci_low_K,coverage_ci_low_1,coverage_ci_low_2,coverage_ci_low_3,coverage_ci_low_4,coverage_ci_low_5,coverage_ci_high_K,coverage_ci_high_1,coverage_ci_high_2,coverage_ci_high_3,coverage_ci_high_4,coverage_ci_high_5,prob_below_95,tier';
const countyColumns = 'county,county_fips,n_schools,pct_schools_below_95,coverage,coverage_ci_low,coverage_ci_high,coverage_K,coverage_1,coverage_2,coverage_3,coverage_4,coverage_5,coverage_ci_low_K,coverage_ci_low_1,coverage_ci_low_2,coverage_ci_low_3,coverage_ci_low_4,coverage_ci_low_5,coverage_ci_high_K,coverage_ci_high_1,coverage_ci_high_2,coverage_ci_high_3,coverage_ci_high_4,coverage_ci_high_5,prob_below_95,tier';
const schoolColumns = 'school_id,school_name,county,enrollment,lon,lat,no_data,coverage,coverage_ci_low,coverage_ci_high,coverage_K,coverage_1,coverage_2,coverage_3,coverage_4,coverage_5,coverage_ci_low_K,coverage_ci_low_1,coverage_ci_low_2,coverage_ci_low_3,coverage_ci_low_4,coverage_ci_low_5,coverage_ci_high_K,coverage_ci_high_1,coverage_ci_high_2,coverage_ci_high_3,coverage_ci_high_4,coverage_ci_high_5,prob_below_95,tier';
const valid = [
  `${columns}\nnc,37,North Carolina,1,0,0.95,,,,,,,,,,,,,,,,,,,,,,H\n`,
  `${countyColumns}\nWake,,1,0,0.95,,,,,,,,,,,,,,,,,,,,,,H\n`,
  `${schoolColumns}\n1,School,Wake,10,,,0,0.95,,,,,,,,,,,,,,,,,,,,,,H\n`,
];

describe('registration core', () => {
  it('accepts and canonicalizes GitHub repository URLs', () => {
    expect(parseRepositoryUrl('https://github.com/ACCIDDA/measles-NC.git')).toMatchObject({
      owner: 'ACCIDDA', repo: 'measles-NC', canonicalUrl: 'https://github.com/ACCIDDA/measles-NC',
    });
  });
  it('rejects invalid URLs', () => {
    expect(() => parseRepositoryUrl('https://example.com/data')).toThrow(/github.com/);
    expect(() => parseRepositoryUrl('https://github.com/a/b/../../secret')).toThrow(/exactly one/);
  });
  it('normalizes and validates public endpoint URLs', () => {
    expect(normalizeBaseUrl('https://example.org/measles/nc')).toBe('https://example.org/measles/nc/');
    expect(() => normalizeBaseUrl('http://example.org/data')).toThrow(/HTTPS/);
    expect(() => normalizeBaseUrl('https://user:pass@example.org/data')).toThrow(/credentials/);
  });
  it('discovers the template dataset under data/', () => {
    expect(discoverDataset(['data/state.csv', 'data/counties.csv', 'data/schools.csv'], 'nc').root).toBe('data/');
    expect(() => discoverDataset(['data/state.csv'], 'nc')).toThrow(/required dataset files/);
  });
  it('validates a complete public/private-compatible bundle', () => {
    expect(validateDataset({
      stateCode: 'nc',
      files: ['data/state.csv', 'data/counties.csv', 'data/schools.csv'],
      contents: valid,
    })).toMatchObject({ stateName: 'North Carolina' });
  });
  it('validates datasets fetched from an endpoint without repository metadata', async () => {
    const calls = [];
    const files = {
      'data/state.csv': valid[0].split('\n').slice(0, -1).join('\n'),
      'data/counties.csv': valid[1].split('\n').slice(0, -1).join('\n'),
      'data/schools.csv': valid[2].split('\n').slice(0, -1).join('\n'),
    };
    const result = await validateEndpoint({
      stateCode: 'nc',
      baseUrl: 'https://example.org/measles/nc',
      fetchImpl: async (url) => {
        calls.push(url);
        const path = new URL(url).pathname.replace('/measles/nc/', '');
        return { ok: true, text: async () => files[path] };
      },
    });
    expect(result).toMatchObject({ stateName: 'North Carolina', baseUrl: 'https://example.org/measles/nc/' });
    expect(result.dataHashes['schools.csv']).toBe(createHash('sha256').update(files['data/schools.csv']).digest('hex'));
    expect(calls).toEqual([
      'https://example.org/measles/nc/data/state.csv',
      'https://example.org/measles/nc/data/counties.csv',
      'https://example.org/measles/nc/data/schools.csv',
    ]);
  });
  it('reports an unavailable endpoint file', async () => {
    await expect(validateEndpoint({
      stateCode: 'nc',
      baseUrl: 'https://example.org/measles/nc/',
      fetchImpl: async (url) => ({
        ok: !url.endsWith('schools.csv'),
        status: 404,
        text: async () => '',
      }),
    })).rejects.toThrow(/schools\.csv/);
  });
  it('accepts unlabeled modeled schools while still requiring stable IDs', () => {
    const contents = [...valid];
    contents[2] = contents[2].replace('1,School,Wake', '1,,Wake');
    expect(() => validateDataset({ stateCode: 'nc', files: ['state.csv', 'counties.csv', 'schools.csv'], contents })).not.toThrow();
    contents[2] = contents[2].replace('1,,Wake', ',,Wake');
    expect(() => validateDataset({ stateCode: 'nc', files: ['state.csv', 'counties.csv', 'schools.csv'], contents })).toThrow(/school_id is required/);
  });
  it('updates endpoint-only entries without treating missing repository IDs as duplicates', () => {
    const registry = { nc: { base_url: 'https://example.org/nc/', repository_id: null }, ca: { repository_id: null } };
    expect(() => checkRegistryConflicts(registry, 'nc', null, null)).not.toThrow();
  });
  it('rejects a wrong state and duplicate registrations across states', () => {
    expect(() => validateDataset({
      stateCode: 'va',
      files: ['state.csv', 'counties.csv', 'schools.csv'],
      contents: valid,
    })).toThrow(/state must be va/);
    expect(() => checkRegistryConflicts({
      nc: { repository_id: '123', repository_url: 'https://github.com/a/nc' },
    }, 'va', '123', 'https://github.com/a/nc')).toThrow(/already registered/);
    expect(() => checkRegistryConflicts({
      nc: { repository_id: '123', repository_url: 'https://github.com/a/nc' },
    }, 'nc', '456', 'https://github.com/a/other')).not.toThrow();
  });
  it('rejects invalid dataset values', () => {
    const invalid = [...valid];
    invalid[2] = invalid[2].replace(',0.95,', ',1.5,');
    expect(() => validateDataset({
      stateCode: 'nc',
      files: ['state.csv', 'counties.csv', 'schools.csv'],
      contents: invalid,
    })).toThrow(/above maximum|in range/);
  });
  it('rejects an unknown state code before repository access', async () => {
    const { isStateCode } = await import('./registration-core.mjs');
    expect(isStateCode('zz')).toBe(false);
    expect(isStateCode('nc')).toBe(true);
  });
});

describe('registration command', () => {
  it.each([
    { withRepository: false, baseUrl: 'https://example.org/nc', expectedBase: 'https://example.org/nc/' },
    { withRepository: true, baseUrl: 'https://example.org/nc', expectedBase: 'https://example.org/nc/' },
    { withRepository: true, baseUrl: '', expectedBase: 'https://team.github.io/nc/' },
  ])('stores validated endpoint hashes for %j', ({ withRepository, baseUrl, expectedBase }) => {
    const directory = mkdtempSync(join(tmpdir(), 'measles-registration-'));
    try {
      mkdirSync(join(directory, 'public/data'), { recursive: true });
      writeFileSync(join(directory, 'public/data/stateRegistry.json'), '{}');
      writeFileSync(join(directory, 'public/data/states.json'), '{}');
      // Exercise the actual command entry point: imports, optional repository
      // inputs, hash wiring, and JSON output. No requests leave the process.
      const mock = `
        const csvs = ${JSON.stringify(valid)};
        globalThis.fetch = async url => {
          if (url === 'https://api.github.com/repos/team/nc') return { ok: true, json: async () => ({ id: 123, default_branch: 'main' }) };
          if (url === 'https://api.github.com/repos/team/nc/branches/main') return { ok: true, json: async () => ({ commit: { sha: 'abc123' } }) };
          const index = ['state.csv', 'counties.csv', 'schools.csv'].findIndex(file => url === ${JSON.stringify(expectedBase)} + 'data/' + file);
          if (index < 0) throw new Error('Unexpected request: ' + url);
          return { ok: true, text: async () => csvs[index] };
        };
      `;
      const output = execFileSync(process.execPath, [
        '--import', `data:text/javascript,${encodeURIComponent(mock)}`,
        fileURLToPath(new URL('./register-state-repository.mjs', import.meta.url)),
      ], {
        cwd: directory, encoding: 'utf8',
        env: { ...process.env, STATE_CODE: 'NC', BASE_URL: baseUrl,
          REPOSITORY_URL: withRepository ? 'https://github.com/team/nc' : '',
          GITHUB_REPOSITORY: 'test/dashboard', GITHUB_TOKEN: withRepository ? 'test-token' : '' },
      });
      const result = JSON.parse(output);
      const registered = JSON.parse(result.registry).nc;
      expect(registered.base_url).toBe(expectedBase);
      expect(registered.dataset_path).toBe('data/');
      expect(registered.repository_id).toBe(withRepository ? '123' : null);
      expect(registered.source_commit_sha).toBe(withRepository ? 'abc123' : null);
      expect(registered.data_sha256['schools.csv']).toBe(createHash('sha256').update(valid[2]).digest('hex'));
      expect(Object.keys(registered.data_sha256)).toHaveLength(3);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
