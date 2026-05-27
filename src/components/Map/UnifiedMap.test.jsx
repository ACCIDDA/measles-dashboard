import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnifiedMap from './UnifiedMap.jsx';

// jsdom lacks ResizeObserver — provide a no-op shim so the layout watcher
// inside UnifiedMap doesn't blow up at render time. jsdom also doesn't
// implement SVGSVGElement.width.baseVal, which d3-zoom touches the first
// time a programmatic zoom transition resolves; patch it to a fixed size
// so deferred transitions in unmounted trees don't throw.
beforeAll(() => {
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof SVGSVGElement !== 'undefined' && !('width' in SVGSVGElement.prototype)) {
    Object.defineProperty(SVGSVGElement.prototype, 'width', { get() { return { baseVal: { value: 800 } }; } });
    Object.defineProperty(SVGSVGElement.prototype, 'height', { get() { return { baseVal: { value: 600 } }; } });
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

function makeStateFeatures() {
  return [
    {
      type: 'Feature',
      id: '37',
      properties: { name: 'North Carolina' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
      },
    },
    {
      type: 'Feature',
      id: '51',
      properties: { name: 'Virginia' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]]],
      },
    },
  ];
}

function makeCountyFeatures() {
  return [
    {
      type: 'Feature',
      id: '37001',
      properties: { name: 'Wake' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]],
      },
    },
    {
      type: 'Feature',
      id: '37002',
      properties: { name: 'Durham' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[5, 0], [10, 0], [10, 5], [5, 5], [5, 0]]],
      },
    },
  ];
}

function makeStateData() {
  const features = makeCountyFeatures();
  return {
    stateFeatures: features,
    neighborStates: [],
    stateMesh: null,
    countyData: {
      'Wake County': { mean: 94, herd_immunity: 0.9, fips: '37001' },
      'Durham County': { mean: 91, herd_immunity: 0.85, fips: '37002' },
    },
    allSchools: [
      {
        county: 'Wake County', coords: [-78.6, 35.8], feature: features[0],
        coverage: 95, tier: 'H', name: 'Test Elementary', size: 100,
        grades: { estimated: [], reported: [] },
      },
      {
        county: 'Durham County', coords: [-78.9, 35.9], feature: features[1],
        coverage: 88, tier: 'L', name: 'Durham Elem', size: 80,
        grades: { estimated: [], reported: [] },
      },
    ],
    adjacencyMap: { '37001': ['37002'], '37002': ['37001'] },
  };
}

const sharedProps = {
  stateFeatures: makeStateFeatures(),
  coverageByFips: { '37': { coverage: 0.951, status: 'ready' } },
  countriesFeatures: [],
  stateData: null,
  selectedSchool: null,
  onStateSelect: () => {},
  onCountySelect: () => {},
  onSchoolSelect: () => {},
  onBack: () => {},
  onViewChange: () => {},
  currentView: 'coverage',
};

describe('UnifiedMap — national zoom', () => {
  it('renders one path per state feature', () => {
    const { container } = render(<UnifiedMap {...sharedProps} zoomLevel="national" />);
    expect(container.querySelectorAll('path.state-path').length).toBe(2);
  });

  it('flags states without coverage as no-data', () => {
    const { container } = render(<UnifiedMap {...sharedProps} zoomLevel="national" />);
    const va = container.querySelector('path.state-path.no-data');
    expect(va).not.toBeNull();
    expect(va.getAttribute('aria-label')).toContain('no data');
  });

  it('clicking a state fires onStateSelect with the lowercase code', () => {
    const onStateSelect = vi.fn();
    const { container } = render(
      <UnifiedMap {...sharedProps} zoomLevel="national" onStateSelect={onStateSelect} />
    );
    const nc = container.querySelector('path.state-path:not(.no-data)');
    fireEvent.click(nc);
    expect(onStateSelect).toHaveBeenCalledWith('nc');

    onStateSelect.mockClear();
    const va = container.querySelector('path.state-path.no-data');
    fireEvent.click(va);
    expect(onStateSelect).toHaveBeenCalledWith('va');
  });

  it('renders the national-variant legend (with no-data swatch)', () => {
    render(<UnifiedMap {...sharedProps} zoomLevel="national" />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText('Coverage Level')).toBeInTheDocument();
  });

  it('renders world-atlas countries when provided', () => {
    const countries = [{
      type: 'Feature', id: '124', properties: { name: 'Canada' },
      geometry: { type: 'Polygon', coordinates: [[[-120, 50], [-100, 50], [-100, 60], [-120, 60], [-120, 50]]] },
    }];
    const { container } = render(
      <UnifiedMap {...sharedProps} zoomLevel="national" countriesFeatures={countries} />
    );
    expect(container.querySelectorAll('path.world-path').length).toBeGreaterThanOrEqual(1);
  });

  it('suppresses state clicks at state zoom (no zoom-to-state from already-zoomed)', () => {
    const onStateSelect = vi.fn();
    const { container } = render(
      <UnifiedMap
        {...sharedProps}
        zoomLevel="state"
        focusedStateCode="nc"
        stateData={makeStateData()}
        onStateSelect={onStateSelect}
      />
    );
    const nc = container.querySelector('path.state-path');
    fireEvent.click(nc);
    expect(onStateSelect).not.toHaveBeenCalled();
  });
});

describe('UnifiedMap — state zoom', () => {
  it('renders county paths for the focused state', () => {
    const { container } = render(
      <UnifiedMap
        {...sharedProps}
        zoomLevel="state"
        focusedStateCode="nc"
        focusedStateName="NC"
        stateData={makeStateData()}
      />
    );
    expect(container.querySelectorAll('path.county-path').length).toBe(2);
  });

  it('clicking a county fires onCountySelect with the "<name> County" key', () => {
    const onCountySelect = vi.fn();
    const { container } = render(
      <UnifiedMap
        {...sharedProps}
        zoomLevel="state"
        focusedStateCode="nc"
        stateData={makeStateData()}
        onCountySelect={onCountySelect}
      />
    );
    const county = container.querySelector('path.county-path');
    fireEvent.click(county);
    expect(onCountySelect).toHaveBeenCalledWith(expect.stringMatching(/County$/));
  });

  it('shows the back button at state zoom', () => {
    const { container } = render(
      <UnifiedMap
        {...sharedProps}
        zoomLevel="state"
        focusedStateCode="nc"
        stateData={makeStateData()}
      />
    );
    expect(container.querySelector('#back-btn.visible')).not.toBeNull();
  });

  it('SVG aria-label reflects the focused state name', () => {
    const { container } = render(
      <UnifiedMap
        {...sharedProps}
        zoomLevel="state"
        focusedStateCode="nc"
        focusedStateName="NC"
        stateData={makeStateData()}
      />
    );
    expect(container.querySelector('#map-svg').getAttribute('aria-label')).toMatch(/NC county/);
  });
});

describe('UnifiedMap — county zoom', () => {
  it('renders school dots for the focused county', () => {
    const { container } = render(
      <UnifiedMap
        {...sharedProps}
        zoomLevel="county"
        focusedStateCode="nc"
        focusedCounty="Wake County"
        stateData={makeStateData()}
      />
    );
    const schoolDots = container.querySelectorAll('circle.school-dot');
    expect(schoolDots.length).toBe(1);
  });

  it('back button shows the "All Counties" label at county zoom', () => {
    const { container } = render(
      <UnifiedMap
        {...sharedProps}
        zoomLevel="county"
        focusedStateCode="nc"
        focusedCounty="Wake County"
        stateData={makeStateData()}
      />
    );
    expect(container.querySelector('#back-btn').textContent).toMatch(/All Counties/);
  });
});

describe('UnifiedMap — missing inputs', () => {
  it('does not crash when stateFeatures is null', () => {
    const { container } = render(
      <UnifiedMap {...sharedProps} zoomLevel="national" stateFeatures={null} />
    );
    expect(container.querySelectorAll('path.state-path').length).toBe(0);
  });
});
