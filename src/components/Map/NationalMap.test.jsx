import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NationalMap from './NationalMap.jsx';

// jsdom doesn't implement ResizeObserver. Provide a no-op shim so the
// component's resize listener doesn't crash during render.
beforeAll(() => {
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Two synthetic states (NC=37, VA=51) so we can verify both the shaded and
// the "no data" code paths without pulling in the real us-atlas topology.
function makeFeatures() {
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

describe('NationalMap', () => {
  it('renders one path per state feature', () => {
    const features = makeFeatures();
    const { container } = render(
      <NationalMap
        stateFeatures={features}
        coverageByFips={{ '37': { coverage: 0.951, status: 'ready' } }}
        onStateSelect={() => {}}
        currentView="coverage"
      />
    );
    const paths = container.querySelectorAll('path.state-path');
    expect(paths.length).toBe(2);
  });

  it('marks states without coverage data with the "no-data" class', () => {
    const features = makeFeatures();
    const { container } = render(
      <NationalMap
        stateFeatures={features}
        coverageByFips={{ '37': { coverage: 0.951, status: 'ready' } }}
        onStateSelect={() => {}}
        currentView="coverage"
      />
    );
    // VA (FIPS 51) has no entry → "no-data" class.
    const va = container.querySelector('path.state-path.no-data');
    expect(va).not.toBeNull();
    expect(va.getAttribute('aria-label')).toContain('no data');

    // NC (FIPS 37) has data → no "no-data" class.
    const allPaths = container.querySelectorAll('path.state-path');
    const dataPaths = Array.from(allPaths).filter(p => !p.classList.contains('no-data'));
    expect(dataPaths.length).toBe(1);
    expect(dataPaths[0].getAttribute('aria-label')).toContain('95.1');
  });

  it('invokes onStateSelect with the lowercase USPS code when a state is clicked', () => {
    const features = makeFeatures();
    const onSelect = vi.fn();
    const { container } = render(
      <NationalMap
        stateFeatures={features}
        coverageByFips={{ '37': { coverage: 0.951, status: 'ready' } }}
        onStateSelect={onSelect}
        currentView="coverage"
      />
    );
    // Click NC.
    const ncPath = container.querySelector('path.state-path:not(.no-data)');
    fireEvent.click(ncPath);
    expect(onSelect).toHaveBeenCalledWith('nc');

    // Click VA (still navigable — every 50+1 entry has a USPS code, only
    // missing coverage shades it grey).
    onSelect.mockClear();
    const vaPath = container.querySelector('path.state-path.no-data');
    fireEvent.click(vaPath);
    expect(onSelect).toHaveBeenCalledWith('va');
  });

  it('exposes the map legend with a "No data yet" swatch', () => {
    const features = makeFeatures();
    render(
      <NationalMap
        stateFeatures={features}
        coverageByFips={{ '37': { coverage: 0.951, status: 'ready' } }}
        onStateSelect={() => {}}
        currentView="coverage"
      />
    );
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText('Coverage Level')).toBeInTheDocument();
  });

  it('renders nothing in the map group when stateFeatures is missing', () => {
    const { container } = render(
      <NationalMap
        stateFeatures={null}
        coverageByFips={{}}
        onStateSelect={() => {}}
        currentView="coverage"
      />
    );
    expect(container.querySelectorAll('path.state-path').length).toBe(0);
  });
});
