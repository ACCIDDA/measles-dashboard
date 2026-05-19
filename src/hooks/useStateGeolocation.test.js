import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStateGeolocation } from './useStateGeolocation.js';

// Synthetic state geometries that exercise the point-in-polygon path.
// NC and TX bounding boxes are sized so that the canonical Raleigh /
// Austin coords land inside the right state and a coord in the middle of
// the Atlantic ocean lands inside neither.
//
// Note: d3.geoContains works on spherical geometry. Rings are wound
// clockwise so the "interior" is the small rectangle (left-of-edge rule
// applied to spherical edges). With counterclockwise winding the polygon
// is interpreted as the *outside* of the rectangle and matches almost
// everywhere on the globe.
function makeStateFeatures() {
  return [
    {
      type: 'Feature',
      id: '37',
      properties: { name: 'North Carolina' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-84.3, 33.8],
          [-84.3, 36.6],
          [-75.4, 36.6],
          [-75.4, 33.8],
          [-84.3, 33.8],
        ]],
      },
    },
    {
      type: 'Feature',
      id: '48',
      properties: { name: 'Texas' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-106.6, 25.8],
          [-106.6, 36.5],
          [-93.5, 36.5],
          [-93.5, 25.8],
          [-106.6, 25.8],
        ]],
      },
    },
  ];
}

describe('useStateGeolocation', () => {
  let originalGeolocation;

  beforeEach(() => {
    originalGeolocation = navigator.geolocation;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  });

  function stubGeolocation(impl) {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: impl },
    });
  }

  it('resolves to the lowercase USPS code for a coordinate inside NC', async () => {
    stubGeolocation((success) => {
      // Raleigh, NC.
      success({ coords: { latitude: 35.78, longitude: -78.65 } });
    });
    const { result } = renderHook(() => useStateGeolocation(makeStateFeatures()));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.stateCode).toBe('nc');
    expect(result.current.error).toBeNull();
  });

  it('resolves to null when the coordinate is outside every US state polygon', async () => {
    stubGeolocation((success) => {
      // Middle of the Atlantic Ocean — outside both synthetic polygons.
      success({ coords: { latitude: 30.0, longitude: -45.0 } });
    });
    const { result } = renderHook(() => useStateGeolocation(makeStateFeatures()));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.stateCode).toBeNull();
    expect(result.current.error).toBe('out_of_us');
  });

  it('returns a "denied" error and a null stateCode when the user denies permission', async () => {
    stubGeolocation((_success, error) => {
      error({ code: 1, message: 'User denied geolocation' });
    });
    const { result } = renderHook(() => useStateGeolocation(makeStateFeatures()));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.stateCode).toBeNull();
    expect(result.current.error).toBe('denied');
  });

  it('returns "unavailable" gracefully when navigator.geolocation is missing', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useStateGeolocation(makeStateFeatures()));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.stateCode).toBeNull();
    expect(result.current.error).toBe('unavailable');
  });

  it('idles in loading state while stateFeatures is null/empty', () => {
    const getCurrentPosition = vi.fn();
    stubGeolocation(getCurrentPosition);
    const { result, rerender } = renderHook(
      ({ features }) => useStateGeolocation(features),
      { initialProps: { features: null } }
    );
    expect(result.current.loading).toBe(true);
    expect(getCurrentPosition).not.toHaveBeenCalled();

    rerender({ features: [] });
    expect(result.current.loading).toBe(true);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('maps a "timeout" PositionError code to the timeout error string', async () => {
    stubGeolocation((_success, error) => {
      error({ code: 3, message: 'timeout' });
    });
    const { result } = renderHook(() => useStateGeolocation(makeStateFeatures()));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('timeout');
    expect(result.current.stateCode).toBeNull();
  });
});
