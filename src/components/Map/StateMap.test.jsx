import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';
import StateMap from './StateMap.jsx';
import { TIER_COLORS } from '../../config/index.js';

// jsdom does not implement ResizeObserver, and the StateMap effect uses it
// to keep the projection in sync with the wrap div's size. Provide a no-op
// shim so the component's resize listener doesn't crash during render.
beforeAll(() => {
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom returns 0 for clientWidth/clientHeight. Stub a sensible default
  // on the wrap div so d3.geoMercator().fitExtent() has a positive extent
  // and projects coordinates to finite pixels.
  Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return 800; },
  });
  Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
    configurable: true,
    get() { return 600; },
  });
  // jsdom's SVGSVGElement does not implement the SVGAnimatedLength `width`
  // / `height` properties d3-zoom reads in defaultExtent(). Provide a minimal
  // shim so the deferred zoom transitions triggered by selectedCounty don't
  // throw an unhandled exception when the timer flushes after the test.
  if (typeof SVGSVGElement !== 'undefined') {
    const stubLength = (val) => ({ baseVal: { value: val } });
    if (!Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'width')) {
      Object.defineProperty(SVGSVGElement.prototype, 'width', {
        configurable: true,
        get() { return stubLength(800); },
      });
    }
    if (!Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'height')) {
      Object.defineProperty(SVGSVGElement.prototype, 'height', {
        configurable: true,
        get() { return stubLength(600); },
      });
    }
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Two adjacent square counties with deterministic geometry. Wake is the
// focal county; Durham is a non-focal neighbor we use to verify focal-vs-
// non-focal fill treatment (issue #29).
function makeStateFeatures() {
  return [
    {
      type: 'Feature',
      id: '37183',
      properties: { name: 'Wake' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-78.9, 35.6], [-78.4, 35.6], [-78.4, 36.0], [-78.9, 36.0], [-78.9, 35.6],
        ]],
      },
    },
    {
      type: 'Feature',
      id: '37063',
      properties: { name: 'Durham' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-79.1, 35.9], [-78.9, 35.9], [-78.9, 36.2], [-79.1, 36.2], [-79.1, 35.9],
        ]],
      },
    },
  ];
}

// One school per tier inside Wake County (the focal county). Coords are
// inside the Wake polygon so scatterCoord uses them directly.
function makeAllSchools() {
  return [
    {
      name: 'High Tier Elementary',
      county: 'Wake County',
      coverage: 97,
      tier: 'H',
      coords: [-78.7, 35.8],
    },
    {
      name: 'Medium Tier Middle',
      county: 'Wake County',
      coverage: 92,
      tier: 'M',
      coords: [-78.65, 35.78],
    },
    {
      name: 'Low Tier High',
      county: 'Wake County',
      coverage: 85,
      tier: 'L',
      coords: [-78.55, 35.75],
    },
  ];
}

function makeCountyData() {
  // Wake: high tier (≥95); Durham: high tier (≥95) so we can verify the
  // focal-vs-non-focal fill distinction is from class/opacity, not color.
  return {
    'Wake County': { mean: 96.5 },
    'Durham County': { mean: 95.2 },
  };
}

function renderStateMap(props = {}) {
  return render(
    <StateMap
      countyData={makeCountyData()}
      allSchools={makeAllSchools()}
      stateFeatures={makeStateFeatures()}
      stateCode="nc"
      stateName="North Carolina"
      selectedCounty={null}
      selectedSchool={null}
      onCountySelect={() => {}}
      onSchoolSelect={() => {}}
      onBack={() => {}}
      onViewChange={() => {}}
      currentView="coverage"
      neighborStates={[]}
      stateMesh={null}
      adjacencyMap={{}}
      {...props}
    />
  );
}

describe('StateMap', () => {
  it('renders one county path per state feature', () => {
    const { container } = renderStateMap();
    expect(container.querySelectorAll('path.county-path').length).toBe(2);
  });

  it('renders no school dots until a county is selected', () => {
    const { container } = renderStateMap();
    expect(container.querySelectorAll('g.school-dot').length).toBe(0);
  });

  it('renders one <g class="school-dot"> per school in the selected county', () => {
    const { container } = renderStateMap({ selectedCounty: 'Wake County' });
    expect(container.querySelectorAll('g.school-dot').length).toBe(3);
  });

  it('renders the matching SVG shape per tier (H=circle, M=rect, L=polygon)', () => {
    const { container } = renderStateMap({ selectedCounty: 'Wake County' });

    const high = container.querySelector('g.school-dot[data-tier="H"]');
    const med = container.querySelector('g.school-dot[data-tier="M"]');
    const low = container.querySelector('g.school-dot[data-tier="L"]');

    expect(high).not.toBeNull();
    expect(med).not.toBeNull();
    expect(low).not.toBeNull();

    expect(high.querySelector('circle.school-shape')).not.toBeNull();
    expect(med.querySelector('rect.school-shape')).not.toBeNull();
    expect(low.querySelector('polygon.school-shape')).not.toBeNull();
  });

  it('paints each school shape with the tier color', () => {
    const { container } = renderStateMap({ selectedCounty: 'Wake County' });
    expect(
      container.querySelector('g.school-dot[data-tier="H"] .school-shape').getAttribute('fill')
    ).toBe(TIER_COLORS.H);
    expect(
      container.querySelector('g.school-dot[data-tier="M"] .school-shape').getAttribute('fill')
    ).toBe(TIER_COLORS.M);
    expect(
      container.querySelector('g.school-dot[data-tier="L"] .school-shape').getAttribute('fill')
    ).toBe(TIER_COLORS.L);
  });

  it('marks the selected county with the "county-focal" class and a muted fill-opacity (#29)', () => {
    const { container } = renderStateMap({ selectedCounty: 'Wake County' });

    const focal = container.querySelector('path.county-path.county-focal');
    expect(focal).not.toBeNull();

    // Verify exactly one focal county (the selected one).
    expect(container.querySelectorAll('path.county-path.county-focal').length).toBe(1);

    // Focal county has a reduced fill-opacity so school dots stand out.
    const focalOpacity = parseFloat(focal.getAttribute('fill-opacity'));
    expect(focalOpacity).toBeLessThan(1);
    expect(focalOpacity).toBeGreaterThan(0);

    // Non-focal counties keep their full-strength fill (no fill-opacity attr).
    const nonFocal = container.querySelector(
      'path.county-path:not(.county-focal)'
    );
    expect(nonFocal).not.toBeNull();
    expect(nonFocal.getAttribute('fill-opacity')).toBeNull();
  });

  it('clears focal-county class and school dots when the selection is cleared', () => {
    const { container, rerender } = renderStateMap({ selectedCounty: 'Wake County' });
    expect(container.querySelectorAll('g.school-dot').length).toBe(3);
    expect(container.querySelectorAll('path.county-path.county-focal').length).toBe(1);

    act(() => {
      rerender(
        <StateMap
          countyData={makeCountyData()}
          allSchools={makeAllSchools()}
          stateFeatures={makeStateFeatures()}
          stateCode="nc"
          stateName="North Carolina"
          selectedCounty={null}
          selectedSchool={null}
          onCountySelect={() => {}}
          onSchoolSelect={() => {}}
          onBack={() => {}}
          onViewChange={() => {}}
          currentView="coverage"
          neighborStates={[]}
          stateMesh={null}
          adjacencyMap={{}}
        />
      );
    });

    expect(container.querySelectorAll('path.county-path.county-focal').length).toBe(0);
  });
});
