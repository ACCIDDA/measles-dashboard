import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStateManifest, STATE_MANIFEST_PATH } from './useStateManifest.js';

function mockManifest() {
  return {
    nc: { fips: '37', name: 'North Carolina', status: 'ready', data_url: '/NC/json/dashboard.json' },
    tx: { fips: '48', name: 'Texas', status: 'coming_soon' },
    va: { fips: '51', name: 'Virginia', status: 'coming_soon' },
  };
}

function buildFetchMock(captured, { ok = true, payload = mockManifest(), status = 200 } = {}) {
  return vi.fn((url) => {
    captured.push(url);
    return Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(payload),
    });
  });
}

describe('useStateManifest', () => {
  let originalFetch;
  let captured;

  beforeEach(() => {
    captured = [];
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches the manifest from the expected path', async () => {
    globalThis.fetch = buildFetchMock(captured);
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain(STATE_MANIFEST_PATH);
  });

  it('parses the manifest and exposes it via `manifest`', async () => {
    globalThis.fetch = buildFetchMock(captured);
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.manifest).toEqual(mockManifest());
  });

  it('isReady("nc") is true; isReady("tx") is false', async () => {
    globalThis.fetch = buildFetchMock(captured);
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isReady('nc')).toBe(true);
    expect(result.current.isReady('NC')).toBe(true); // case-insensitive
    expect(result.current.isReady('tx')).toBe(false);
    expect(result.current.isReady('va')).toBe(false);
  });

  it('getStateName returns the full display name for known codes', async () => {
    globalThis.fetch = buildFetchMock(captured);
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getStateName('nc')).toBe('North Carolina');
    expect(result.current.getStateName('TX')).toBe('Texas');
  });

  it('getFips returns the two-digit FIPS for known codes', async () => {
    globalThis.fetch = buildFetchMock(captured);
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getFips('nc')).toBe('37');
    expect(result.current.getFips('tx')).toBe('48');
  });

  it('returns sensible defaults for unknown codes', async () => {
    globalThis.fetch = buildFetchMock(captured);
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isReady('zz')).toBe(false);
    expect(result.current.getStateName('zz')).toBe('');
    expect(result.current.getFips('zz')).toBe('');
    expect(result.current.getEntry('zz')).toBeNull();
  });

  it('handles missing / empty codes gracefully', async () => {
    globalThis.fetch = buildFetchMock(captured);
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isReady(undefined)).toBe(false);
    expect(result.current.isReady(null)).toBe(false);
    expect(result.current.isReady('')).toBe(false);
    expect(result.current.getStateName(undefined)).toBe('');
    expect(result.current.getFips(null)).toBe('');
  });

  it('sets error when the manifest fetch fails', async () => {
    globalThis.fetch = buildFetchMock(captured, { ok: false, status: 404 });
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/404|Failed/);
    expect(result.current.manifest).toBeNull();
    expect(result.current.isReady('nc')).toBe(false);
  });

  it('sets error when fetch throws', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    const { result } = renderHook(() => useStateManifest());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/network down/);
    expect(result.current.manifest).toBeNull();
  });

  it('exposes loading=true initially and flips to false after fetch', async () => {
    globalThis.fetch = buildFetchMock(captured);
    const { result } = renderHook(() => useStateManifest());
    expect(result.current.loading).toBe(true);
    expect(result.current.manifest).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.manifest).not.toBeNull();
  });
});
