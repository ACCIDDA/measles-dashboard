import { useState, useEffect, useMemo, useCallback } from 'react';

// Path (under Vite's BASE_URL) to the state availability manifest.
// The manifest drives which states render as "ready" (clickable into a
// drill-down view) versus "coming_soon" (greyed out, not clickable).
//
// Shape:
//   {
//     "nc": { "fips": "37", "name": "North Carolina", "status": "ready",
//             "data_url": "/NC/json/dashboard.json" },
//     "tx": { "fips": "48", "name": "Texas", "status": "coming_soon" },
//     ...
//   }
//
// Keys are lowercase two-letter state codes. Adding a new ready state is
// a JSON-only change; no code changes are required.
export const STATE_MANIFEST_PATH = 'data/states.json';

const READY_STATUS = 'ready';

function normalizeCode(code) {
  return (code || '').toString().trim().toLowerCase();
}

/**
 * Fetches the state availability manifest once at mount and exposes a
 * small read-only API. Components use this to decide whether to render a
 * state as drill-down-clickable (status === "ready") or greyed-out
 * (anything else).
 *
 * Returns:
 *   - manifest: the full object keyed by state code, or null while loading
 *   - isReady(code): boolean — true iff manifest[code].status === "ready"
 *   - getStateName(code): full display name, or "" if unknown
 *   - getFips(code): two-digit FIPS string, or "" if unknown
 *   - getEntry(code): the raw manifest entry, or null if unknown
 *   - loading: true until the fetch resolves (or fails)
 *   - error: error message string, or null
 */
export function useStateManifest() {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
        const res = await fetch(`${base}${STATE_MANIFEST_PATH}`);
        if (!res.ok) throw new Error(`Failed to load state manifest (${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          setManifest(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || String(err));
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const getEntry = useCallback((code) => {
    if (!manifest) return null;
    const key = normalizeCode(code);
    return manifest[key] || null;
  }, [manifest]);

  const isReady = useCallback((code) => {
    const entry = getEntry(code);
    return !!entry && entry.status === READY_STATUS;
  }, [getEntry]);

  const getStateName = useCallback((code) => {
    const entry = getEntry(code);
    return entry && entry.name ? entry.name : '';
  }, [getEntry]);

  const getFips = useCallback((code) => {
    const entry = getEntry(code);
    return entry && entry.fips ? entry.fips : '';
  }, [getEntry]);

  return useMemo(() => ({
    manifest,
    loading,
    error,
    isReady,
    getStateName,
    getFips,
    getEntry,
  }), [manifest, loading, error, isReady, getStateName, getFips, getEntry]);
}

export default useStateManifest;
