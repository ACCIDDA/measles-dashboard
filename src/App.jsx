import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUnifiedMapData } from './hooks/useUnifiedMapData.js';
import { useStateManifest } from './hooks/useStateManifest.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { useStateGeolocation } from './hooks/useStateGeolocation.js';
import { getStateConfig, normalizeFips, DEFAULT_STATE_CODE } from './config/states.js';
import Header from './components/Header/Header.jsx';
import UnifiedMap from './components/Map/UnifiedMap.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Tour from './components/Tour.jsx';
import NoDataToast from './components/NoDataToast.jsx';

// Parse the location into a zoom descriptor. Three shapes:
//   { zoomLevel: 'national' }                       → site root
//   { zoomLevel: 'state', stateCode: 'nc' }         → state zoom
//   { zoomLevel: 'county', stateCode: 'nc', county: 'wake' } → deep link
// Pathname and hash routing are both accepted to keep GH Pages style hash
// routing working alongside HTML5 history.
function parseRoute() {
  if (typeof window === 'undefined') return { zoomLevel: 'national' };
  const sources = [window.location.pathname || '', window.location.hash || ''];
  for (const src of sources) {
    // /state/<code>/<county-slug>
    const deep = src.match(/\/state\/([a-zA-Z]{2})\/([a-z0-9-]+)(?:[/?#]|$)/i);
    if (deep) {
      return {
        zoomLevel: 'county',
        stateCode: deep[1].toLowerCase(),
        countySlug: deep[2].toLowerCase(),
      };
    }
    const shallow = src.match(/\/state\/([a-zA-Z]{2})(?:[/?#]|$)/);
    if (shallow) {
      return { zoomLevel: 'state', stateCode: shallow[1].toLowerCase() };
    }
  }
  return { zoomLevel: 'national' };
}

function slugify(countyName) {
  if (!countyName) return '';
  return countyName.toLowerCase().replace(/ county$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function unslugify(slug, counties) {
  if (!slug || !counties) return null;
  const target = slug.toLowerCase();
  const hit = counties.find(c => slugify(c) === target);
  return hit || null;
}

function pushUrl(target) {
  if (typeof window === 'undefined' || !window.history || !window.history.pushState) return;
  // Preserve any existing pathname prefix (vite BASE_URL handles this in dev,
  // but on GH Pages the asset prefix is baked into the URL).
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  window.history.pushState({}, '', `${base}${target}`);
}

export default function App() {
  const [route, setRoute] = useState(parseRoute);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [currentView, setCurrentView] = useState('coverage');
  const [toastState, setToastState] = useState(null);
  const [highlightedFips, setHighlightedFips] = useState(null);

  // Geolocation only ever affects the *initial* national view. Snapshot the
  // first-paint route and track the first manual navigation so a late
  // geolocation result never yanks the user off a page they chose. (issue #16)
  const initialRouteRef = useRef(route);
  const userNavigatedRef = useRef(false);
  const geoActedRef = useRef(false);

  const map = useUnifiedMapData();
  const manifest = useStateManifest();
  const { userCountyName, userCoords, setGeoCounty } = useGeolocation(route.stateCode);
  // State-level geolocation: point-in-polygon against the already-loaded
  // national state polygons → the visitor's USPS code (issue #16). No extra
  // fetch — it reuses map.stateFeatures.
  const stateGeo = useStateGeolocation(map.stateFeatures);

  // ── URL ↔ zoom sync ──
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPop = () => {
      userNavigatedRef.current = true;
      setRoute(parseRoute());
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  // Lazy-fetch the focused state's data whenever the route lands at state or
  // county zoom. The orchestrator dedupes / caches, so re-zooming into the
  // same state doesn't re-fetch. We also re-trigger once the shared base
  // load finishes — `focusState` is a no-op until the manifest + us-atlas
  // are in memory, so a deep-link to /state/nc only sees the call land once
  // `map.loading` flips to false.
  useEffect(() => {
    if (route.zoomLevel === 'national') return;
    if (!route.stateCode) return;
    if (map.loading) return;
    map.focusState(route.stateCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.zoomLevel, route.stateCode, map.loading]);

  // Resolve focused county from slug → full name once stateData lands.
  const focusedCounty = useMemo(() => {
    if (route.zoomLevel !== 'county') return null;
    const data = map.stateData[route.stateCode];
    if (!data) return null;
    const countyNames = Object.keys(data.countyData || {});
    return unslugify(route.countySlug, countyNames);
  }, [route, map.stateData]);

  // ── Navigation intents ──
  const handleZoomToState = useCallback((rawCode) => {
    const code = String(rawCode || '').toLowerCase();
    if (!code) return;
    if (!manifest.isReady(code)) {
      setToastState(manifest.getStateName(code) || code.toUpperCase());
      return;
    }
    userNavigatedRef.current = true;
    pushUrl(`/state/${code}`);
    setRoute({ zoomLevel: 'state', stateCode: code });
    setSelectedSchool(null);
  }, [manifest]);

  const handleZoomToCounty = useCallback((countyName) => {
    if (!route.stateCode || !countyName) return;
    userNavigatedRef.current = true;
    pushUrl(`/state/${route.stateCode}/${slugify(countyName)}`);
    setRoute({ zoomLevel: 'county', stateCode: route.stateCode, countySlug: slugify(countyName) });
    setSelectedSchool(null);
  }, [route.stateCode]);

  const handleZoomOut = useCallback(() => {
    userNavigatedRef.current = true;
    if (route.zoomLevel === 'county') {
      pushUrl(`/state/${route.stateCode}`);
      setRoute({ zoomLevel: 'state', stateCode: route.stateCode });
      setSelectedSchool(null);
    } else if (route.zoomLevel === 'state') {
      pushUrl('/');
      setRoute({ zoomLevel: 'national' });
      setSelectedSchool(null);
    }
  }, [route]);

  // "Go to my detected home" — wired to the loc-pill click. Navigates straight
  // to the visitor's state + county regardless of current zoom, so the pill
  // works at national zoom too (handleZoomToCounty alone no-ops there because
  // it needs route.stateCode, which isn't set at national).
  const handleGoToHome = useCallback(() => {
    // Prefer fresh geo (stateGeo); fall back to the default state when geo
    // is denied or still loading but we have a cached userCountyName — that
    // cache lives under `geo_county_<DEFAULT_STATE_CODE>` per useGeolocation,
    // so DEFAULT_STATE_CODE is the right home-state pair for that county.
    const sc = stateGeo.stateCode || (userCountyName ? DEFAULT_STATE_CODE : null);
    if (!sc) return;
    userNavigatedRef.current = true;
    if (userCountyName) {
      const slug = slugify(userCountyName);
      pushUrl(`/state/${sc}/${slug}`);
      setRoute({ zoomLevel: 'county', stateCode: sc, countySlug: slug });
      setSelectedSchool(null);
    } else {
      handleZoomToState(sc);
    }
  }, [stateGeo.stateCode, userCountyName, handleZoomToState]);

  // Default the initial view to the visitor's state from browser geolocation
  // (issue #16): a manifest-ready state zooms in; a no-data state stays on the
  // national map with that state highlighted; denied / outside-US / error all
  // fall back silently. Fires once, and only while the user is still on the
  // initial national view (never overrides a navigation they made themselves).
  useEffect(() => {
    if (geoActedRef.current) return;
    if (stateGeo.loading || manifest.loading) return;
    geoActedRef.current = true;
    const code = stateGeo.stateCode;
    if (!code) return;
    if (userNavigatedRef.current) return;
    if (initialRouteRef.current.zoomLevel !== 'national') return;
    if (manifest.isReady(code)) {
      handleZoomToState(code);
    } else {
      const fips = manifest.getFips(code);
      if (fips) setHighlightedFips(normalizeFips(fips));
    }
  }, [stateGeo.loading, stateGeo.stateCode, manifest, handleZoomToState]);

  // Escape zooms out one level at a time (preserves the legacy state→county
  // Escape behaviour but extends it across the whole map).
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') handleZoomOut();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleZoomOut]);

  // ── Loading / error gates ──
  if (map.loading || manifest.loading) {
    return (
      <div id="loading">
        <div className="spinner"></div>
        <span className="load-text">Loading map…</span>
      </div>
    );
  }
  if (map.error) return <div style={{ padding: 20 }}>Error: {map.error}</div>;

  const stateData = route.stateCode ? map.stateData[route.stateCode] : null;
  const stateCfg = route.stateCode ? getStateConfig(route.stateCode) : null;
  const focusedStateName = stateCfg ? stateCfg.name : '';

  // Sidebar inputs (county zoom only).
  const countySchools = (stateData && focusedCounty)
    ? [...stateData.allSchools.filter(s => s.county === focusedCounty)]
      .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div id="app">
      <div id="aria-live" aria-live="polite" aria-atomic="true"></div>
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        stateFeatures={(stateData && stateData.stateFeatures) || []}
        countyData={(stateData && stateData.countyData) || {}}
        onCountySelect={handleZoomToCounty}
        onStateSelect={handleZoomToState}
        stateName={focusedStateName || 'NC'}
        view={route.zoomLevel === 'national' ? 'national' : 'state'}
      />
      <div id="body-row">
        <UnifiedMap
          zoomLevel={route.zoomLevel}
          focusedStateCode={route.stateCode || null}
          focusedStateName={focusedStateName}
          focusedCounty={focusedCounty}
          selectedSchool={selectedSchool}
          stateFeatures={map.stateFeatures}
          coverageByFips={map.coverageByFips}
          countriesFeatures={map.countriesFeatures}
          stateData={stateData}
          onStateSelect={handleZoomToState}
          onCountySelect={handleZoomToCounty}
          onSchoolSelect={setSelectedSchool}
          onBack={handleZoomOut}
          onViewChange={setCurrentView}
          currentView={currentView}
          userCountyName={userCountyName}
          userCoords={userCoords}
          onGeoCountyDetected={setGeoCounty}
          onGoToHome={handleGoToHome}
          highlightedFips={highlightedFips}
        />
        {/* Sidebar lives in the DOM throughout state + county zooms so its
            slide-in / slide-out transition can ease, and a11y tests can find
            its role without first triggering a zoom. It opens (.open class)
            only when a county is in focus. */}
        {(route.zoomLevel === 'state' || route.zoomLevel === 'county') && (
          <Sidebar
            county={focusedCounty}
            countyData={(stateData && stateData.countyData) || {}}
            schools={countySchools}
            selectedSchool={selectedSchool}
            onSchoolSelect={setSelectedSchool}
            onBack={handleZoomOut}
            onCloseSchool={() => setSelectedSchool(null)}
            isOpen={!!focusedCounty}
          />
        )}
      </div>
      {route.zoomLevel !== 'national' && <Tour />}
      <NoDataToast
        stateName={toastState}
        onDismiss={() => setToastState(null)}
      />
    </div>
  );
}

// Exposed for tests
export { parseRoute, slugify, unslugify };
