import { useState, useEffect, useRef, useCallback } from 'react';
import * as topojson from 'topojson-client';
import { covTier } from '../config/index.js';
import { getStateConfig, normalizeFips } from '../config/states.js';

// CDN URLs for shared topology data. us-atlas drives the US states + counties;
// world-atlas provides surrounding countries (Canada, Mexico, Caribbean) to
// render as muted background context on the national zoom (closes #30).
const US_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';
const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// The us-atlas state choropleth stub mapped by 2-digit FIPS. While the
// USImmunityProfiles output is still pending (issue #14), this drives shading
// on the national zoom; states missing from the stub render greyed.
const NATIONAL_STUB_PATH = 'data/national.json';

function withBase(path) {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return `${base}${path}`;
}

// Build the per-state derived structures from a freshly-fetched
// `dashboard.json` + `school_coords.json` + the shared us-atlas topology.
//
// Returns the same shape the legacy `useDashboardData` produced
// (countyData, allSchools, stateFeatures, neighborStates, stateMesh,
// adjacencyMap) so the map component and sidebar code don't have to change.
function buildStatePayload({ stateCode, dashboard, schoolCoordsLookup, us }) {
  const cfg = getStateConfig(stateCode);

  const stateFeatures = topojson
    .feature(us, us.objects.counties)
    .features
    .filter(f => String(f.id).startsWith(cfg.fips));
  const neighborStates = topojson
    .feature(us, us.objects.states)
    .features
    .filter(f => String(f.id) !== String(+cfg.fips));
  const stateMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

  // Adjacency map (county id → adjacent county ids) restricted to this state.
  const stateCountyIds = new Set(stateFeatures.map(f => f.id));
  const adjacencyMap = {};
  stateFeatures.forEach(f => { adjacencyMap[f.id] = []; });
  topojson.neighbors(us.objects.counties.geometries).forEach((neighbors, i) => {
    const geo = us.objects.counties.geometries[i];
    const id = geo.id != null ? String(geo.id) : String(i);
    if (!stateCountyIds.has(id)) return;
    neighbors.forEach(j => {
      const nGeo = us.objects.counties.geometries[j];
      const nId = nGeo.id != null ? String(nGeo.id) : String(j);
      if (stateCountyIds.has(nId) && !adjacencyMap[id].includes(nId)) {
        adjacencyMap[id].push(nId);
      }
    });
  });

  const featureByName = {};
  stateFeatures.forEach(f => { featureByName[f.properties.name] = f; });

  const countyData = {};
  (dashboard.counties || []).forEach(c => {
    const key = c.name + ' County';
    countyData[key] = {
      mean: c.coverage,
      herd_immunity: c.herd_immunity,
      fips: featureByName[c.name] ? featureByName[c.name].id : null,
    };
  });

  const allSchools = [];
  (dashboard.counties || []).forEach(c => {
    const countyKey = c.name + ' County';
    const feature = featureByName[c.name];
    (c.schools || []).forEach(school => {
      const rawKey = school.name + '|' + countyKey;
      const coords = schoolCoordsLookup[rawKey] || null;
      const breakdown = (school.stats && school.stats.coverage_breakdown) || [];
      const estimatedFlags = (school.stats && school.stats.Estimated) || [];
      const estimated = breakdown.map(v => {
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      });
      const reported = breakdown.map((v, i) => {
        if (estimatedFlags[i] === true) return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      });
      allSchools.push({
        county: countyKey,
        coords,
        feature,
        coverage: school.stats.Coverage,
        tier: covTier(school.stats.Coverage),
        name: school.name,
        size: school.stats.Size,
        grades: { estimated, reported },
      });
    });
  });

  return { countyData, allSchools, stateFeatures, neighborStates, stateMesh, adjacencyMap };
}

/**
 * Unified data orchestrator that backs the zoom-aware map. Replaces the
 * legacy `useNationalData` + `useDashboardData` pair.
 *
 * - Loads the shared us-atlas, world-atlas, national stub, and per-state
 *   manifest exactly once at mount.
 * - Lazy-loads each state's `dashboard.json` + `school_coords.json` on
 *   demand via `focusState(code)`. Re-focusing a previously loaded state is
 *   a cache hit; no extra fetches occur.
 * - Returns a stable `focusState` callback and a `stateData` map keyed by
 *   lowercase state code, so the consumer can render whichever state's
 *   counties + schools are currently in focus.
 *
 * Surfaces (in addition to the loaded data):
 *   - loading: true until the initial shared payload resolves
 *   - error: top-level error string (initial fetch only)
 *   - stateError: per-state error keyed by state code (e.g. for "ready" but
 *     missing data files; "coming_soon" states intentionally don't fetch)
 *   - focusState(code): trigger a lazy fetch + cache for that state. No-op
 *     for unknown / non-ready codes.
 */
export function useUnifiedMapData() {
  const [base, setBase] = useState({
    us: null,
    world: null,
    stateFeatures: null,
    coverageByFips: null,
    countriesFeatures: null,
    manifest: null,
    loading: true,
    error: null,
  });

  // Per-state cache: lowercase code → derived payload (countyData, allSchools, …).
  // Held in a ref so multiple consumers calling `focusState` in flight don't
  // race; pending promises are tracked separately for dedupe.
  const stateCacheRef = useRef({});
  const inFlightRef = useRef({});
  const usRef = useRef(null);
  const manifestRef = useRef(null);
  const [stateData, setStateData] = useState({});
  const [stateError, setStateError] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [usRes, worldRes, natRes, manifestRes] = await Promise.all([
          fetch(US_ATLAS_URL),
          fetch(WORLD_ATLAS_URL),
          fetch(withBase(NATIONAL_STUB_PATH)),
          fetch(withBase('data/states.json')),
        ]);

        if (!usRes.ok) throw new Error('Failed to load US map data');

        const us = await usRes.json();
        // world-atlas + national stub + manifest are optional; degrade rather
        // than fail the whole app if any are missing.
        const world = worldRes.ok ? await worldRes.json() : null;
        const national = natRes.ok ? await natRes.json() : { states: {} };
        const manifest = manifestRes.ok ? await manifestRes.json() : {};

        const stateFeatures = topojson.feature(us, us.objects.states).features;
        const coverageByFips = {};
        const rawCov = (national && national.states) || {};
        Object.keys(rawCov).forEach(k => {
          coverageByFips[normalizeFips(k)] = rawCov[k];
        });

        // world-atlas exposes `countries` (and `land`); we need countries so
        // we can filter the US out and leave Canada/Mexico/Caribbean as
        // background. Use `land` as a fallback when only that key is present.
        let countriesFeatures = [];
        if (world) {
          const objName = world.objects && (world.objects.countries ? 'countries' : (world.objects.land ? 'land' : null));
          if (objName) {
            const fc = topojson.feature(world, world.objects[objName]);
            countriesFeatures = fc.type === 'FeatureCollection' ? fc.features : [fc];
            // Filter out the United States — we render the us-atlas states on
            // top in their own colour scheme, so leaving the world's US
            // polygon under it would just blur the choropleth edges.
            countriesFeatures = countriesFeatures.filter(f => {
              const id = f.id != null ? String(f.id) : '';
              const name = f.properties && (f.properties.name || f.properties.NAME);
              return id !== '840' && name !== 'United States of America';
            });
          }
        }

        if (!cancelled) {
          usRef.current = us;
          manifestRef.current = manifest;
          setBase({
            us,
            world,
            stateFeatures,
            coverageByFips,
            countriesFeatures,
            manifest,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setBase(prev => ({ ...prev, loading: false, error: err.message || String(err) }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Lazy-load a single state's dashboard + school coords on demand.
  const focusState = useCallback((rawCode) => {
    const code = String(rawCode || '').toLowerCase();
    if (!code) return Promise.resolve(null);

    // Cache hit — nothing to do.
    if (stateCacheRef.current[code]) return Promise.resolve(stateCacheRef.current[code]);
    if (inFlightRef.current[code]) return inFlightRef.current[code];

    const manifest = manifestRef.current;
    const us = usRef.current;
    if (!us) {
      // Shared payload hasn't resolved yet; nothing we can build.
      return Promise.resolve(null);
    }

    // Surface a clean error for non-ready / unknown states without firing
    // any fetches.  Callers (e.g. the map) treat this as "no county data".
    const entry = manifest && manifest[code];
    if (!entry || entry.status !== 'ready') {
      setStateError(prev => ({ ...prev, [code]: 'not_ready' }));
      return Promise.resolve(null);
    }

    const cfg = getStateConfig(code);
    const promise = (async () => {
      try {
        const [dashRes, coordsRes] = await Promise.all([
          fetch(withBase(`${cfg.dataDir}/json/dashboard.json`)),
          fetch(withBase(`${cfg.dataDir}/json/school_coords.json`)),
        ]);
        if (!dashRes.ok) throw new Error(`Failed to load ${code.toUpperCase()} dashboard`);
        const dashboard = await dashRes.json();
        const schoolCoordsLookup = coordsRes.ok ? await coordsRes.json() : {};
        const payload = buildStatePayload({ stateCode: code, dashboard, schoolCoordsLookup, us });
        stateCacheRef.current[code] = payload;
        setStateData(prev => ({ ...prev, [code]: payload }));
        setStateError(prev => {
          if (!prev[code]) return prev;
          const next = { ...prev }; delete next[code]; return next;
        });
        return payload;
      } catch (err) {
        setStateError(prev => ({ ...prev, [code]: err.message || String(err) }));
        return null;
      } finally {
        delete inFlightRef.current[code];
      }
    })();
    inFlightRef.current[code] = promise;
    return promise;
  }, []);

  return {
    // Shared (loaded once)
    loading: base.loading,
    error: base.error,
    stateFeatures: base.stateFeatures,
    coverageByFips: base.coverageByFips,
    countriesFeatures: base.countriesFeatures,
    manifest: base.manifest,
    // Per-state (lazy)
    stateData,
    stateError,
    focusState,
  };
}

export default useUnifiedMapData;
