import { useState, useEffect } from 'react';
import * as topojson from 'topojson-client';
import { covTier } from '../config/index.js';
import { getStateConfig, DEFAULT_STATE_CODE } from '../config/states.js';

export function useDashboardData(stateCode = DEFAULT_STATE_CODE) {
  const [state, setState] = useState({
    countyData: null,
    allSchools: null,
    stateFeatures: null,
    neighborStates: null,
    stateMesh: null,
    adjacencyMap: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const cfg = getStateConfig(stateCode);

    async function load() {
      try {
        const [dashRes, usRes, coordsRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}${cfg.dataDir}/json/dashboard.json`),
          fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'),
          fetch(`${import.meta.env.BASE_URL}${cfg.dataDir}/json/school_coords.json`)
        ]);

        if (!dashRes.ok) throw new Error('Failed to load dashboard data');
        if (!usRes.ok) throw new Error('Failed to load map data');

        const dashboard = await dashRes.json();
        const us = await usRes.json();
        const schoolCoordsLookup = coordsRes.ok ? await coordsRes.json() : {};

        const stateFeatures = topojson
          .feature(us, us.objects.counties)
          .features
          .filter(f => String(f.id).startsWith(cfg.fips));
        const neighborStates = topojson
          .feature(us, us.objects.states)
          .features
          .filter(f => String(f.id) !== String(+cfg.fips));
        const stateMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

        // Build adjacency map from shared county borders
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

        // Build a lookup from county name (without " County") to its GeoJSON feature
        const featureByName = {};
        stateFeatures.forEach(f => {
          featureByName[f.properties.name] = f;
        });

        // Build countyData as a plain object keyed by "X County"
        const countyData = {};
        dashboard.counties.forEach(c => {
          const key = c.name + ' County';
          countyData[key] = {
            mean: c.coverage,
            herd_immunity: c.herd_immunity,
            fips: null
          };
          // Try to find matching FIPS from feature
          const feature = featureByName[c.name];
          if (feature) {
            countyData[key].fips = feature.id;
          }
        });

        // Build allSchools array
        const allSchools = [];
        dashboard.counties.forEach(c => {
          const countyKey = c.name + ' County';
          const feature = featureByName[c.name];

          c.schools.forEach(school => {
            const rawKey = school.name + '|' + countyKey;
            let coords = schoolCoordsLookup[rawKey] || null;

            // Build grade-level data
            // Estimated[i]=true means model-estimated; false means reported
            const breakdown = school.stats.coverage_breakdown || [];
            const estimatedFlags = school.stats.Estimated || [];

            // estimated array: all coverage_breakdown values as numbers
            const estimated = breakdown.map(v => {
              const n = parseFloat(v);
              return isNaN(n) ? null : n;
            });

            // reported array: same but null where Estimated[i]===true
            const reported = breakdown.map((v, i) => {
              if (estimatedFlags[i] === true) return null;
              const n = parseFloat(v);
              return isNaN(n) ? null : n;
            });

            allSchools.push({
              county: countyKey,
              coords,           // null when not in SCHOOL_RAW
              feature,          // used by map to compute centroid fallback
              coverage: school.stats.Coverage,
              tier: covTier(school.stats.Coverage),
              name: school.name,
              size: school.stats.Size,
              grades: { estimated, reported }
            });
          });
        });

        if (!cancelled) {
          setState({
            countyData,
            allSchools,
            stateFeatures,
            neighborStates,
            stateMesh,
            adjacencyMap,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({ ...prev, loading: false, error: err.message }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [stateCode]);

  return state;
}
