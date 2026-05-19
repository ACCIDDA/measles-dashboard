import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// StateMap fires d3-zoom transitions on mount that crash inside jsdom (SVG
// width.baseVal isn't implemented). Routing tests only care about which
// top-level view renders, so a placeholder stub is sufficient.
vi.mock('./components/Map/StateMap.jsx', () => ({
  default: ({ stateName }) => (
    <div data-testid="state-map-stub">
      <svg role="application" aria-label={`${stateName || 'NC'} county map`}></svg>
    </div>
  ),
}));

// Tour pulls in localStorage/setTimeout side effects we don't need here.
vi.mock('./components/Tour.jsx', () => ({
  default: () => null,
}));

// Default the geolocation hook to a permanently-pending state so existing
// tests (which don't care about geolocation) keep their old behavior.
// Individual tests below override this with vi.mocked(...).mockReturnValue.
vi.mock('./hooks/useStateGeolocation.js', () => ({
  useStateGeolocation: vi.fn(() => ({ stateCode: null, loading: true, error: null })),
}));

import App from './App.jsx';
import { useStateGeolocation } from './hooks/useStateGeolocation.js';

// Same shim as NationalMap.test.jsx — jsdom doesn't ship ResizeObserver, and
// NationalMap relies on it for its layout responsiveness.
beforeAll(() => {
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// Minimal us-atlas-shaped fixture so both routes have something to render.
// One county (FIPS 37001) belongs to NC; one outside-NC county (99001)
// keeps the filtering branch honest in useDashboardData.
function mockUsAtlas() {
  return {
    type: 'Topology',
    arcs: [
      [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
      [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]],
      [[4, 4], [5, 4], [5, 5], [4, 5], [4, 4]],
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
          { type: 'Polygon', id: '48', arcs: [[2]], properties: { name: 'Texas' } },
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

function mockNational() {
  return { states: { '37': { coverage: 0.951, status: 'ready' } } };
}

function mockStateManifest() {
  return {
    nc: { fips: '37', name: 'North Carolina', status: 'ready', data_url: '/NC/json/dashboard.json' },
    tx: { fips: '48', name: 'Texas', status: 'coming_soon' },
    va: { fips: '51', name: 'Virginia', status: 'coming_soon' },
  };
}

function buildFetchMock() {
  return vi.fn((url) => {
    if (url.includes('counties-10m.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsAtlas()) });
    }
    if (url.endsWith('dashboard.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDashboard()) });
    }
    if (url.endsWith('school_coords.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url.endsWith('data/national.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockNational()) });
    }
    if (url.endsWith('data/states.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStateManifest()) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe('App routing', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = buildFetchMock();
    // Reset the geolocation mock to "still loading" so it never fires
    // during routing-only tests.
    vi.mocked(useStateGeolocation).mockReturnValue({ stateCode: null, loading: true, error: null });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    // Reset jsdom history between cases so prior pushState calls don't leak.
    window.history.replaceState({}, '', '/');
  });

  it('renders the national map at the root path', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    // Header copy is the cheap+stable signal for the national view.
    await waitFor(() => {
      expect(screen.getByText('Click a state to explore')).toBeInTheDocument();
    });
    // National map has its application-role svg.
    const svg = await screen.findByRole('application');
    expect(svg.getAttribute('aria-label')).toMatch(/National/);
  });

  it('renders the state map at /state/<code>', async () => {
    window.history.replaceState({}, '', '/state/nc');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Click a county to explore/)).toBeInTheDocument();
    });
    const svg = await screen.findByRole('application');
    expect(svg.getAttribute('aria-label')).toMatch(/NC county/);
  });

  it('hides the county search on the national view', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Click a state to explore')).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText(/Search.*counties/i)).not.toBeInTheDocument();
  });

  it('shows the county search on the state view', async () => {
    window.history.replaceState({}, '', '/state/nc');
    render(<App />);
    await waitFor(() => {
      expect(screen.queryAllByPlaceholderText('Search NC counties…').length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('App geolocation routing', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = buildFetchMock();
    vi.mocked(useStateGeolocation).mockReturnValue({ stateCode: null, loading: true, error: null });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.history.replaceState({}, '', '/');
  });

  it('transitions to /state/<code> when geolocation resolves to a manifest-ready state', async () => {
    window.history.replaceState({}, '', '/');
    vi.mocked(useStateGeolocation).mockReturnValue({ stateCode: 'nc', loading: false, error: null });
    render(<App />);

    // Once routing flips to the state view, the state-map stub appears.
    await waitFor(() => {
      expect(screen.getByTestId('state-map-stub')).toBeInTheDocument();
    });
    expect(window.location.pathname).toMatch(/\/state\/nc$/);
  });

  it('stays on the national view and highlights the user state when the state has no data', async () => {
    window.history.replaceState({}, '', '/');
    // TX is in the mock manifest as coming_soon — not ready.
    vi.mocked(useStateGeolocation).mockReturnValue({ stateCode: 'tx', loading: false, error: null });
    const { container } = render(<App />);

    // National view should still be rendered.
    await waitFor(() => {
      expect(screen.getByText('Click a state to explore')).toBeInTheDocument();
    });

    // Route stays on root.
    expect(window.location.pathname).toBe('/');

    // The TX state path (FIPS 48) picks up the user-location halo class.
    await waitFor(() => {
      const tx = container.querySelector('path.state-path.state-user-location');
      expect(tx).not.toBeNull();
      expect(tx.getAttribute('data-fips')).toBe('48');
    });
  });

  it('ignores the geolocation result when the user already deep-linked to a state', async () => {
    // The user landed on /state/nc directly (deep link / browser back).
    // Geolocation resolves to TX, but we should NOT navigate them away
    // from the page they intentionally opened.
    window.history.replaceState({}, '', '/state/nc');
    vi.mocked(useStateGeolocation).mockReturnValue({ stateCode: 'tx', loading: false, error: null });
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('state-map-stub')).toBeInTheDocument();
    });

    // URL stays on /state/nc; the TX resolution is dropped.
    expect(window.location.pathname).toMatch(/\/state\/nc$/);
  });
});
