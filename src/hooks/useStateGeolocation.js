import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { fipsToUsps, normalizeFips } from '../config/states.js';

// Default options for navigator.geolocation.getCurrentPosition. Tuned to
// fail fast so we don't keep users staring at the national view waiting
// for a high-accuracy fix.
const DEFAULT_GEO_OPTIONS = { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 };

/**
 * Resolve the user's USPS state code (e.g. "nc") from the browser's
 * geolocation API by running a point-in-polygon test against the supplied
 * state GeoJSON features.
 *
 * Inputs:
 *   - stateFeatures: array of GeoJSON Features for the 50 states + DC
 *     (lat/lon WGS84 — the un-projected topology from us-atlas works as-is
 *     with d3.geoContains). When null/empty the hook idles until features
 *     arrive.
 *   - options: navigator.geolocation.getCurrentPosition options.
 *
 * Output: { stateCode, loading, error }
 *   - stateCode: lowercase USPS code on success, or null when the user is
 *     outside the supplied geometries, geolocation isn't available, the
 *     user denied permission, or any other failure path. Callers can treat
 *     "null after loading=false" as "fall back to the national view".
 *   - loading: true until we either resolve a coordinate or fail.
 *   - error: a short string describing the failure mode (denied,
 *     unavailable, timeout, out_of_us, error). Useful for debugging but
 *     never surfaced to the user — silent failure is the UX requirement.
 */
export function useStateGeolocation(stateFeatures, options = DEFAULT_GEO_OPTIONS) {
  const [state, setState] = useState({
    stateCode: null,
    loading: true,
    error: null,
  });
  // We only ever want to prompt the user for geolocation once per mount.
  // Without this guard, callers that re-render with a fresh `stateFeatures`
  // array reference (a very common React pattern) would re-invoke
  // getCurrentPosition on every render, and any synchronous mock in tests
  // can turn that into an infinite update loop.
  const promptedRef = useRef(false);

  useEffect(() => {
    // Wait for state geometries before doing anything; calling the API
    // without features would force us to either re-query or cache a
    // coordinate, which complicates the surface for no real win.
    if (!stateFeatures || stateFeatures.length === 0) return;
    if (promptedRef.current) return;
    promptedRef.current = true;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ stateCode: null, loading: false, error: 'unavailable' });
      return;
    }

    let cancelled = false;

    const onSuccess = (pos) => {
      if (cancelled) return;
      const lon = pos && pos.coords ? pos.coords.longitude : null;
      const lat = pos && pos.coords ? pos.coords.latitude : null;
      if (lon == null || lat == null) {
        setState({ stateCode: null, loading: false, error: 'error' });
        return;
      }
      const match = stateFeatures.find(f => {
        try {
          return d3.geoContains(f, [lon, lat]);
        } catch {
          return false;
        }
      });
      if (!match) {
        setState({ stateCode: null, loading: false, error: 'out_of_us' });
        return;
      }
      const fips = normalizeFips(match.id);
      const code = fipsToUsps(fips);
      setState({ stateCode: code || null, loading: false, error: code ? null : 'out_of_us' });
    };

    const onError = (err) => {
      if (cancelled) return;
      // PositionError.code: 1=denied, 2=unavailable, 3=timeout.
      let kind = 'error';
      if (err && typeof err.code === 'number') {
        if (err.code === 1) kind = 'denied';
        else if (err.code === 2) kind = 'unavailable';
        else if (err.code === 3) kind = 'timeout';
      }
      setState({ stateCode: null, loading: false, error: kind });
    };

    try {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    } catch {
      setState({ stateCode: null, loading: false, error: 'error' });
    }

    return () => { cancelled = true; };
    // We deliberately don't subscribe to `options` — the caller can change
    // the array reference between renders without re-prompting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFeatures]);

  return state;
}

export default useStateGeolocation;
