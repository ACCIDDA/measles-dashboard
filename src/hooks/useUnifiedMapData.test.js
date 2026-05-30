import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUnifiedMapData } from './useUnifiedMapData.js';

// Tiny us-atlas fixture: two synthetic states (37 = NC, 99 = "Other") with
// one county apiece so we can verify the per-state filter works.
function mockUsAtlas() {
  return {
    type: 'Topology',
    arcs: [
      [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
      [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]],
    ],
    transform: { scale: [1, 1], translate: [0, 0] },
    objects: {
      counties: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Polygon', id: '37001', arcs: [[0]], properties: { name: 'Wake' } },
          { type: 'Polygon', id: '99001', arcs: [[1]], properties: { name: 'Other' } },
        ],
      },
      states: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Polygon', id: '37', arcs: [[0]], properties: { name: 'North Carolina' } },
          { type: 'Polygon', id: '99', arcs: [[1]], properties: { name: 'Otherland' } },
        ],
      },
    },
  };
}

function mockWorldAtlas() {
  return {
    type: 'Topology',
    arcs: [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]],
    transform: { scale: [1, 1], translate: [0, 0] },
    objects: {
      countries: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Polygon', id: '124', arcs: [[0]], properties: { name: 'Canada' } },
          { type: 'Polygon', id: '840', arcs: [[0]], properties: { name: 'United States of America' } },
        ],
      },
    },
  };
}

// #20 CSV bundle fixtures. Coverage is a proportion in [0,1]; the loader
// converts to percent. One county (Wake) with one school.
const COV_COLS =
  'coverage,coverage_ci_low,coverage_ci_high,' +
  'coverage_K,coverage_1,coverage_2,coverage_3,coverage_4,coverage_5,' +
  'coverage_ci_low_K,coverage_ci_low_1,coverage_ci_low_2,coverage_ci_low_3,coverage_ci_low_4,coverage_ci_low_5,' +
  'coverage_ci_high_K,coverage_ci_high_1,coverage_ci_high_2,coverage_ci_high_3,coverage_ci_high_4,coverage_ci_high_5,' +
  'is_estimated_K,is_estimated_1,is_estimated_2,is_estimated_3,is_estimated_4,is_estimated_5,prob_below_95,tier';
const COV_VALS =
  '0.94,0.93,0.95,' +
  '0.95,0.94,0.96,0.93,0.97,0.95,' +
  '0.93,0.92,0.94,0.91,0.95,0.93,' +
  '0.97,0.96,0.98,0.95,0.99,0.97,' +
  '0,0,0,0,0,0,0.1,M';
function mockCountyCsv() {
  return 'county,county_fips,n_schools,pct_schools_below_95,' + COV_COLS + '\n' +
    'Wake,37183,1,0.0,' + COV_VALS + '\n';
}
function mockSchoolCsv() {
  // combined per-state schools.csv carries a `county` column
  return 'school_id,school_name,county,enrollment,' + COV_COLS + '\n' +
    '1,Test Elementary,Wake,100,' + COV_VALS + '\n';
}

function mockManifest() {
  return {
    nc: { fips: '37', name: 'North Carolina', status: 'ready', data_url: '/data/states/nc.csv' },
    tx: { fips: '48', name: 'Texas', status: 'coming_soon' },
  };
}

function buildFetchMock(captured, { dashboardOk = true } = {}) {
  return vi.fn((url) => {
    captured.push(url);
    if (url.includes('counties-10m.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsAtlas()) });
    }
    if (url.includes('countries-110m.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWorldAtlas()) });
    }
    if (url.endsWith('data/national.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ states: { '37': { coverage: 0.951, status: 'ready' } } }),
      });
    }
    if (url.endsWith('data/states.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManifest()) });
    }
    // #20 per-state CSV bundle: county summary + combined schools file.
    if (url.endsWith('data/states/nc.csv')) {
      if (!dashboardOk) return Promise.resolve({ ok: false, text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, text: () => Promise.resolve(mockCountyCsv()) });
    }
    if (url.endsWith('data/states/nc/schools.csv')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(mockSchoolCsv()) });
    }
    return Promise.resolve({ ok: false, text: () => Promise.resolve('') });
  });
}

describe('useUnifiedMapData', () => {
  let originalFetch;
  let captured;

  beforeEach(() => {
    captured = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = buildFetchMock(captured);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads shared topology + manifest on mount', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(captured.some(u => u.includes('counties-10m.json'))).toBe(true);
    expect(captured.some(u => u.includes('countries-110m.json'))).toBe(true);
    expect(captured.some(u => u.endsWith('data/national.json'))).toBe(true);
    expect(captured.some(u => u.endsWith('data/states.json'))).toBe(true);

    expect(Array.isArray(result.current.stateFeatures)).toBe(true);
    expect(result.current.stateFeatures).toHaveLength(2);
    expect(result.current.coverageByFips['37']).toEqual({ coverage: 0.951, status: 'ready' });
    expect(result.current.manifest.nc).toBeDefined();
  });

  it('filters the US out of the world countries layer', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const names = result.current.countriesFeatures.map(f => f.properties && f.properties.name);
    expect(names).toContain('Canada');
    expect(names).not.toContain('United States of America');
  });

  it('lazy-loads NC on focusState("nc") and builds derived payload', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // No per-state fetch yet.
    expect(captured.some(u => u.endsWith('data/states/nc.csv'))).toBe(false);

    await act(async () => { await result.current.focusState('nc'); });

    expect(captured.some(u => u.endsWith('data/states/nc.csv'))).toBe(true);
    expect(captured.some(u => u.endsWith('data/states/nc/schools.csv'))).toBe(true);

    const nc = result.current.stateData.nc;
    expect(nc).toBeDefined();
    expect(nc.stateFeatures).toHaveLength(1);
    expect(nc.stateFeatures[0].id).toBe('37001');
    expect(nc.countyData['Wake County']).toBeDefined();
    expect(nc.countyData['Wake County'].mean).toBe(94);
    expect(nc.allSchools).toHaveLength(1);
    // CSV overall coverage 0.94 (proportion) → 94 (percent) in-memory.
    expect(nc.allSchools[0].coverage).toBe(94);
    expect(nc.allSchools[0].size).toBe(100);
    // coverage_K = 0.95 → 95; reported grades (is_estimated_*=0) populate reported[].
    expect(nc.allSchools[0].grades.reported[0]).toBe(95);
    // No lon/lat columns in the fixture → coords null (map uses fallback).
    expect(nc.allSchools[0].coords).toBeNull();
  });

  it('caches per-state data: refocusing the same state does not re-fetch', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.focusState('nc'); });
    const fetchesAfterFirst = captured.filter(u => u.endsWith('data/states/nc.csv')).length;
    expect(fetchesAfterFirst).toBe(1);

    await act(async () => { await result.current.focusState('nc'); });
    const fetchesAfterSecond = captured.filter(u => u.endsWith('data/states/nc.csv')).length;
    expect(fetchesAfterSecond).toBe(1);
  });

  it('focusing a coming_soon state surfaces an error and skips per-state fetches', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.focusState('tx'); });

    expect(captured.some(u => u.endsWith('data/states/tx.csv'))).toBe(false);
    expect(result.current.stateData.tx).toBeUndefined();
    expect(result.current.stateError.tx).toBe('not_ready');
  });

  it('focusing an unknown state code is a no-op', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.focusState('zz'); });
    expect(result.current.stateData.zz).toBeUndefined();
  });

  it('surfaces a per-state error when the dashboard fetch fails', async () => {
    captured = [];
    globalThis.fetch = buildFetchMock(captured, { dashboardOk: false });

    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.focusState('nc'); });

    expect(result.current.stateError.nc).toMatch(/failed to load/i);
    expect(result.current.stateData.nc).toBeUndefined();
  });

  it('deduplicates in-flight focusState calls', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const a = result.current.focusState('nc');
      const b = result.current.focusState('nc');
      await Promise.all([a, b]);
    });
    const fetches = captured.filter(u => u.endsWith('data/states/nc.csv')).length;
    expect(fetches).toBe(1);
  });
});
