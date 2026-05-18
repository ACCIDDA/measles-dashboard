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

import App from './App.jsx';

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
