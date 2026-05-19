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

function mockDashboard() {
  return {
    counties: [
      {
        name: 'Wake',
        coverage: 94,
        herd_immunity: 0.9,
        schools: [
          {
            name: 'Test Elementary',
            stats: {
              Coverage: 95,
              Size: 100,
              coverage_breakdown: ['95', '94', '96', '93', '97', '95'],
              Estimated: [false, false, false, false, false, false],
            },
          },
        ],
      },
    ],
  };
}

function mockManifest() {
  return {
    nc: { fips: '37', name: 'North Carolina', status: 'ready', data_url: '/NC/json/dashboard.json' },
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
    if (url.endsWith('dashboard.json')) {
      if (!dashboardOk) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDashboard()) });
    }
    if (url.endsWith('school_coords.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ 'Test Elementary|Wake County': [-78.6, 35.8] }) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
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
    expect(captured.some(u => u.endsWith('NC/json/dashboard.json'))).toBe(false);

    await act(async () => { await result.current.focusState('nc'); });

    expect(captured.some(u => u.endsWith('NC/json/dashboard.json'))).toBe(true);
    expect(captured.some(u => u.endsWith('NC/json/school_coords.json'))).toBe(true);

    const nc = result.current.stateData.nc;
    expect(nc).toBeDefined();
    expect(nc.stateFeatures).toHaveLength(1);
    expect(nc.stateFeatures[0].id).toBe('37001');
    expect(nc.countyData['Wake County']).toBeDefined();
    expect(nc.countyData['Wake County'].mean).toBe(94);
    expect(nc.allSchools).toHaveLength(1);
    expect(nc.allSchools[0].coords).toEqual([-78.6, 35.8]);
  });

  it('caches per-state data: refocusing the same state does not re-fetch', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.focusState('nc'); });
    const fetchesAfterFirst = captured.filter(u => u.endsWith('NC/json/dashboard.json')).length;
    expect(fetchesAfterFirst).toBe(1);

    await act(async () => { await result.current.focusState('nc'); });
    const fetchesAfterSecond = captured.filter(u => u.endsWith('NC/json/dashboard.json')).length;
    expect(fetchesAfterSecond).toBe(1);
  });

  it('focusing a coming_soon state surfaces an error and skips per-state fetches', async () => {
    const { result } = renderHook(() => useUnifiedMapData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.focusState('tx'); });

    expect(captured.some(u => u.endsWith('TX/json/dashboard.json'))).toBe(false);
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

    expect(result.current.stateError.nc).toMatch(/dashboard/i);
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
    const fetches = captured.filter(u => u.endsWith('NC/json/dashboard.json')).length;
    expect(fetches).toBe(1);
  });
});
