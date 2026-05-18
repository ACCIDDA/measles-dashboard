import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData, useNationalData } from './useDashboardData.js';

// A minimal us-atlas-shaped topology with two synthetic states (FIPS "37"
// and "99") and one county per state, so we can verify that the hook
// filters counties by the FIPS prefix derived from the state code arg.
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
          { type: 'Polygon', id: '37', arcs: [[0]], properties: { name: 'NC' } },
          { type: 'Polygon', id: '99', arcs: [[1]], properties: { name: 'Other' } },
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

function mockSchoolCoords() {
  return { 'Test Elementary|Wake County': [-78.6, 35.8] };
}

function buildFetchMock(captured) {
  return vi.fn((url) => {
    captured.push(url);
    if (url.includes('counties-10m.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsAtlas()) });
    }
    if (url.endsWith('dashboard.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDashboard()) });
    }
    if (url.endsWith('school_coords.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSchoolCoords()) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe('useDashboardData', () => {
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

  it('fetches NC paths when called with "nc"', async () => {
    const { result } = renderHook(() => useDashboardData('nc'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();

    // Both NC data files are requested at the NC path prefix.
    expect(captured.some(u => u.endsWith('NC/json/dashboard.json'))).toBe(true);
    expect(captured.some(u => u.endsWith('NC/json/school_coords.json'))).toBe(true);
  });

  it('defaults to NC when no state code is passed', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(captured.some(u => u.endsWith('NC/json/dashboard.json'))).toBe(true);
  });

  it('filters counties to the requested state by FIPS prefix', async () => {
    const { result } = renderHook(() => useDashboardData('nc'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Only the NC county (FIPS prefix 37) survives the filter; the
    // synthetic "99001" county is excluded.
    expect(result.current.stateFeatures).toHaveLength(1);
    expect(result.current.stateFeatures[0].id).toBe('37001');
    expect(result.current.stateFeatures[0].properties.name).toBe('Wake');
  });

  it('exposes the new stateFeatures key (not the old ncFeatures)', async () => {
    const { result } = renderHook(() => useDashboardData('nc'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toHaveProperty('stateFeatures');
    expect(result.current).not.toHaveProperty('ncFeatures');
  });

  it('falls back to the default state for unknown codes', async () => {
    const { result } = renderHook(() => useDashboardData('zz'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Unknown code → defaults to NC config, so NC paths are still fetched.
    expect(captured.some(u => u.endsWith('NC/json/dashboard.json'))).toBe(true);
  });

  it('builds countyData keyed by "<name> County" with mean coverage', async () => {
    const { result } = renderHook(() => useDashboardData('nc'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.countyData['Wake County']).toBeDefined();
    expect(result.current.countyData['Wake County'].mean).toBe(94);
    expect(result.current.countyData['Wake County'].fips).toBe('37001');
  });

  it('builds allSchools from the dashboard payload', async () => {
    const { result } = renderHook(() => useDashboardData('nc'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.allSchools).toHaveLength(1);
    const school = result.current.allSchools[0];
    expect(school.name).toBe('Test Elementary');
    expect(school.county).toBe('Wake County');
    expect(school.coverage).toBe(95);
    expect(school.tier).toBe('H');
    expect(school.coords).toEqual([-78.6, 35.8]);
  });
});

function buildNationalFetchMock(captured, { nationalOk = true } = {}) {
  return vi.fn((url) => {
    captured.push(url);
    if (url.includes('counties-10m.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsAtlas()) });
    }
    if (url.endsWith('data/national.json')) {
      if (!nationalOk) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          states: {
            // Test both zero-padded and non-padded key handling.
            '37': { coverage: 0.951, status: 'ready' },
            '6': { coverage: 0.88, status: 'ready' },
          },
        }),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe('useNationalData', () => {
  let originalFetch;
  let captured;

  beforeEach(() => {
    captured = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = buildNationalFetchMock(captured);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads the US topology and exposes all state features', async () => {
    const { result } = renderHook(() => useNationalData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(captured.some(u => u.includes('counties-10m.json'))).toBe(true);
    expect(captured.some(u => u.endsWith('data/national.json'))).toBe(true);

    expect(Array.isArray(result.current.stateFeatures)).toBe(true);
    // Both synthetic states (37, 99) survive — the national view renders
    // every state feature regardless of coverage availability.
    expect(result.current.stateFeatures).toHaveLength(2);
    const ids = result.current.stateFeatures.map(f => String(f.id));
    expect(ids).toContain('37');
    expect(ids).toContain('99');
  });

  it('builds coverageByFips keyed by zero-padded FIPS', async () => {
    const { result } = renderHook(() => useNationalData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.coverageByFips['37']).toEqual({
      coverage: 0.951,
      status: 'ready',
    });
    // Single-digit "6" in the stub should normalize to "06".
    expect(result.current.coverageByFips['06']).toEqual({
      coverage: 0.88,
      status: 'ready',
    });
  });

  it('still resolves when the coverage stub is missing', async () => {
    captured = [];
    globalThis.fetch = buildNationalFetchMock(captured, { nationalOk: false });
    const { result } = renderHook(() => useNationalData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.stateFeatures).toHaveLength(2);
    expect(result.current.coverageByFips).toEqual({});
  });
});
