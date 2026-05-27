import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// UnifiedMap does heavy d3 work at mount; for routing/orchestration tests we
// only care about which zoom level the app reports and the navigation
// callbacks the URL syncs against. Stub it to a lightweight surface that
// preserves the headline visual signals e2e specs and assertions key off.
vi.mock('./components/Map/UnifiedMap.jsx', () => ({
  default: ({ zoomLevel, focusedStateCode, focusedStateName, focusedCounty, onStateSelect, onCountySelect }) => (
    <div data-testid="unified-map-stub">
      <span data-testid="zoom-level">{zoomLevel}</span>
      <span data-testid="focused-state">{focusedStateCode || ''}</span>
      <span data-testid="focused-county">{focusedCounty || ''}</span>
      <svg
        id="map-svg"
        role="application"
        aria-label={zoomLevel === 'national' ? 'National state-level measles coverage map' : `${focusedStateName || 'state'} county map`}
      />
      <button data-testid="trigger-state-nc" onClick={() => onStateSelect && onStateSelect('nc')}>Pick NC</button>
      <button data-testid="trigger-state-tx" onClick={() => onStateSelect && onStateSelect('tx')}>Pick TX</button>
      <button data-testid="trigger-county-wake" onClick={() => onCountySelect && onCountySelect('Wake County')}>Pick Wake</button>
    </div>
  ),
}));

vi.mock('./components/Tour.jsx', () => ({ default: () => null }));

import App, { parseRoute, slugify, unslugify } from './App.jsx';

beforeAll(() => {
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

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
          { type: 'Polygon', id: '51', arcs: [[1]], properties: { name: 'Virginia' } },
        ],
      },
    },
  };
}

function mockDashboard() {
  return {
    counties: [
      {
        name: 'Wake', coverage: 94, herd_immunity: 0.9,
        schools: [{ name: 'Test Elementary', stats: { Coverage: 95, Size: 100, coverage_breakdown: ['95'], Estimated: [false] } }],
      },
    ],
  };
}

function mockManifest() {
  return {
    nc: { fips: '37', name: 'North Carolina', status: 'ready', data_url: '/NC/json/dashboard.json' },
    tx: { fips: '48', name: 'Texas', status: 'coming_soon' },
    va: { fips: '51', name: 'Virginia', status: 'coming_soon' },
  };
}

function buildFetchMock() {
  return vi.fn((url) => {
    if (url.includes('counties-10m.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsAtlas()) });
    if (url.includes('countries-110m.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ type: 'Topology', arcs: [], transform: { scale: [1, 1], translate: [0, 0] }, objects: { countries: { type: 'GeometryCollection', geometries: [] } } }) });
    if (url.endsWith('data/national.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ states: { '37': { coverage: 0.951, status: 'ready' } } }) });
    if (url.endsWith('data/states.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockManifest()) });
    if (url.endsWith('dashboard.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDashboard()) });
    if (url.endsWith('school_coords.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe('parseRoute', () => {
  afterEach(() => { window.history.replaceState({}, '', '/'); });

  it('parses national at /', () => {
    window.history.replaceState({}, '', '/');
    expect(parseRoute()).toEqual({ zoomLevel: 'national' });
  });

  it('parses state at /state/nc', () => {
    window.history.replaceState({}, '', '/state/nc');
    expect(parseRoute()).toEqual({ zoomLevel: 'state', stateCode: 'nc' });
  });

  it('parses county at /state/nc/wake', () => {
    window.history.replaceState({}, '', '/state/nc/wake');
    expect(parseRoute()).toEqual({ zoomLevel: 'county', stateCode: 'nc', countySlug: 'wake' });
  });
});

describe('slugify / unslugify', () => {
  it('slugifies county names', () => {
    expect(slugify('Wake County')).toBe('wake');
    expect(slugify('New Hanover County')).toBe('new-hanover');
    expect(slugify(null)).toBe('');
  });
  it('roundtrips county names through slug + unslug', () => {
    const counties = ['Wake County', 'New Hanover County', 'Pasquotank County'];
    expect(unslugify('wake', counties)).toBe('Wake County');
    expect(unslugify('new-hanover', counties)).toBe('New Hanover County');
    expect(unslugify('missing', counties)).toBeNull();
  });
});

describe('App orchestration', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = buildFetchMock();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.history.replaceState({}, '', '/');
  });

  it('renders the national zoom at the root path', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByText('Click a state to explore')).toBeInTheDocument());
    expect(screen.getByTestId('zoom-level').textContent).toBe('national');
    const svg = await screen.findByRole('application');
    expect(svg.getAttribute('aria-label')).toMatch(/National/);
  });

  it('renders state zoom at /state/nc', async () => {
    window.history.replaceState({}, '', '/state/nc');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('state'));
    expect(screen.getByTestId('focused-state').textContent).toBe('nc');
    expect(screen.getByText(/Click a county to explore/)).toBeInTheDocument();
  });

  it('hides county search on national zoom', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByText('Click a state to explore')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText(/Search.*counties/i)).not.toBeInTheDocument();
  });

  it('shows county search on state zoom', async () => {
    window.history.replaceState({}, '', '/state/nc');
    render(<App />);
    await waitFor(() => expect(screen.queryAllByPlaceholderText('Search NC counties…').length).toBeGreaterThanOrEqual(1));
  });

  it('clicking NC updates URL and zoom level', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('national'));

    fireEvent.click(screen.getByTestId('trigger-state-nc'));
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('state'));
    expect(window.location.pathname).toMatch(/\/state\/nc/);
  });

  it('clicking a coming_soon state surfaces the no-data toast and does not zoom', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('national'));

    fireEvent.click(screen.getByTestId('trigger-state-tx'));
    await waitFor(() => expect(screen.getByTestId('no-data-toast')).toBeInTheDocument());
    expect(screen.getByTestId('zoom-level').textContent).toBe('national');
  });

  it('clicking a county at state zoom drills into county zoom and updates URL', async () => {
    window.history.replaceState({}, '', '/state/nc');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('state'));

    fireEvent.click(screen.getByTestId('trigger-county-wake'));
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('county'));
    expect(window.location.pathname).toMatch(/\/state\/nc\/wake/);
  });

  it('Escape zooms out one level (county → state → national)', async () => {
    window.history.replaceState({}, '', '/state/nc/wake');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('county'));

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('state'));

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('national'));
  });

  it('popstate (back button) restores the previous zoom level', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('national'));

    fireEvent.click(screen.getByTestId('trigger-state-nc'));
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('state'));

    await act(async () => {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(screen.getByTestId('zoom-level').textContent).toBe('national'));
  });
});
