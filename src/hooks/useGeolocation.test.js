import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from './useGeolocation.js';

describe('useGeolocation', () => {
  let originalGeolocation;

  beforeEach(() => {
    localStorage.clear();
    originalGeolocation = navigator.geolocation;
    // Force the fallback branch (deny geolocation) so we can verify the
    // state-keyed localStorage read.
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success, error) => error && error()),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
    localStorage.clear();
  });

  it('reads the previously stored county from a state-keyed localStorage entry', () => {
    localStorage.setItem('geo_county_nc', 'Wake County');
    const { result } = renderHook(() => useGeolocation('nc'));
    expect(result.current.userCountyName).toBe('Wake County');
  });

  it('does not mix counties stored for a different state', () => {
    localStorage.setItem('geo_county_nc', 'Wake County');
    const { result } = renderHook(() => useGeolocation('tx'));
    expect(result.current.userCountyName).toBeNull();
  });

  it('setGeoCounty persists under the per-state key', () => {
    const { result } = renderHook(() => useGeolocation('nc'));
    act(() => result.current.setGeoCounty('Durham County'));
    expect(localStorage.getItem('geo_county_nc')).toBe('Durham County');
  });
});
