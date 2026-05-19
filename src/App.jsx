import { useState, useEffect, useCallback, useRef } from 'react';
import { useDashboardData, useNationalData } from './hooks/useDashboardData.js';
import { useStateManifest } from './hooks/useStateManifest.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { useStateGeolocation } from './hooks/useStateGeolocation.js';
import { DEFAULT_STATE_CODE, getStateConfig, normalizeFips } from './config/states.js';
import Header from './components/Header/Header.jsx';
import StateMap from './components/Map/StateMap.jsx';
import NationalMap from './components/Map/NationalMap.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Tour from './components/Tour.jsx';
import NoDataToast from './components/NoDataToast.jsx';

// Parse the location into a route descriptor. The two routes are:
//   { kind: 'national' }                — site root (national choropleth)
//   { kind: 'state', stateCode: 'nc' }  — county view for a specific state
// Both pathname (e.g. "/state/nc") and hash (e.g. "#/state/nc") are accepted
// to keep GH Pages style hash routing working. Anything that doesn't match
// the state pattern falls through to the national route.
function parseRoute() {
  if (typeof window === 'undefined') return { kind: 'national' };
  const sources = [window.location.pathname || '', window.location.hash || ''];
  for (const src of sources) {
    const match = src.match(/\/state\/([a-zA-Z]{2})(?:[/?#]|$)/);
    if (match) return { kind: 'state', stateCode: match[1].toLowerCase() };
  }
  return { kind: 'national' };
}

export default function App() {
  const [route, setRoute] = useState(parseRoute);
  // Snapshot of the route at first paint. If the user has navigated away
  // from "/" by the time the geolocation hook resolves, we drop the
  // result — geolocation is only allowed to jump the initial view.
  const initialRouteRef = useRef(route);
  // Flipped to true the first time the user manually navigates (clicks a
  // state, types in search, etc.). Once set, geolocation is a no-op.
  const userNavigatedRef = useRef(false);

  // Keep the in-memory route in sync with back/forward navigation so the
  // browser back button transitions /state/<code> → / cleanly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
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

  const navigateToState = useCallback((stateCode, opts = {}) => {
    const code = String(stateCode || '').toLowerCase();
    if (!code) return;
    // Mark the user as having moved unless this is an automatic
    // geolocation jump (which doesn't count as user-initiated).
    if (!opts.fromGeolocation) userNavigatedRef.current = true;
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const target = `${base}/state/${code}`;
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({}, '', target);
      setRoute({ kind: 'state', stateCode: code });
    } else {
      setRoute({ kind: 'state', stateCode: code });
    }
  }, []);

  if (route.kind === 'national') {
    return (
      <NationalView
        onStateSelect={navigateToState}
        initialRoute={initialRouteRef.current}
        userNavigatedRef={userNavigatedRef}
      />
    );
  }
  return <StateView stateCode={route.stateCode} />;
}

function NationalView({ onStateSelect, initialRoute, userNavigatedRef }) {
  const { stateFeatures, coverageByFips, loading: dataLoading, error } = useNationalData();
  const manifest = useStateManifest();
  const [toastState, setToastState] = useState(null);
  const [highlightedFips, setHighlightedFips] = useState(null);

  // Background geolocation lookup: resolves to a USPS state code (or null)
  // once the user grants/denies permission. We pass the WGS84 state
  // geometries from useNationalData so the point-in-polygon test reuses
  // already-loaded data — no extra fetch needed.
  const geo = useStateGeolocation(stateFeatures);
  const geoActedRef = useRef(false);

  const handleStateSelect = useCallback((stateCode) => {
    const code = String(stateCode || '').toLowerCase();
    if (!code) return;
    if (manifest.isReady(code)) {
      onStateSelect(code);
    } else {
      setToastState(manifest.getStateName(code) || code.toUpperCase());
    }
  }, [manifest, onStateSelect]);

  // React to the geolocation hook resolving. Guard against running twice
  // (e.g. on a manifest-loading re-render) and against the user having
  // already navigated elsewhere — geolocation only jumps the *initial*
  // view.
  useEffect(() => {
    if (geoActedRef.current) return;
    if (geo.loading || manifest.loading) return;
    if (!geo.stateCode) {
      geoActedRef.current = true;
      return;
    }
    const stillOnRoot = initialRoute && initialRoute.kind === 'national';
    const userMoved = userNavigatedRef && userNavigatedRef.current;
    if (!stillOnRoot || userMoved) {
      geoActedRef.current = true;
      return;
    }
    const code = geo.stateCode;
    if (manifest.isReady(code)) {
      geoActedRef.current = true;
      onStateSelect(code, { fromGeolocation: true });
    } else {
      const fips = manifest.getFips(code);
      if (fips) setHighlightedFips(normalizeFips(fips));
      geoActedRef.current = true;
    }
  }, [
    geo.loading,
    geo.stateCode,
    manifest.loading,
    manifest,
    initialRoute,
    userNavigatedRef,
    onStateSelect,
  ]);

  if (dataLoading || manifest.loading) return (
    <div id="loading">
      <div className="spinner"></div>
      <span className="load-text">Loading map…</span>
    </div>
  );
  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;

  return (
    <div id="app">
      <div id="aria-live" aria-live="polite" aria-atomic="true"></div>
      <Header
        currentView="coverage"
        onViewChange={() => {}}
        stateFeatures={[]}
        countyData={{}}
        onCountySelect={() => {}}
        stateName=""
        view="national"
      />
      <div id="body-row">
        <NationalMap
          stateFeatures={stateFeatures || []}
          coverageByFips={coverageByFips || {}}
          onStateSelect={handleStateSelect}
          currentView="coverage"
          highlightedFips={highlightedFips}
        />
      </div>
      <NoDataToast
        stateName={toastState}
        onDismiss={() => setToastState(null)}
      />
    </div>
  );
}

function StateView({ stateCode = DEFAULT_STATE_CODE }) {
  const stateCfg = getStateConfig(stateCode);

  const [selectedCounty, setSelectedCounty] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [currentView, setCurrentView] = useState('coverage');
  const {
    countyData,
    allSchools,
    stateFeatures,
    neighborStates,
    stateMesh,
    adjacencyMap,
    loading,
    error,
  } = useDashboardData(stateCode);
  const { userCountyName, userCoords, setGeoCounty } = useGeolocation(stateCode);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { setSelectedCounty(null); setSelectedSchool(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleCountySelect = (countyName) => {
    setSelectedCounty(countyName);
    setSelectedSchool(null);
  };

  const countySchools = selectedCounty
    ? [...allSchools.filter(s => s.county === selectedCounty)].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  if (loading) return (
    <div id="loading">
      <div className="spinner"></div>
      <span className="load-text">Loading map…</span>
    </div>
  );
  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;

  return (
    <div id="app">
      <div id="aria-live" aria-live="polite" aria-atomic="true"></div>
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        stateFeatures={stateFeatures || []}
        countyData={countyData || {}}
        onCountySelect={handleCountySelect}
        stateName={stateCfg.name}
        view="state"
      />
      <div id="body-row">
        <StateMap
          countyData={countyData || {}}
          allSchools={allSchools || []}
          stateFeatures={stateFeatures || []}
          stateCode={stateCode}
          stateName={stateCfg.name}
          selectedCounty={selectedCounty}
          selectedSchool={selectedSchool}
          onCountySelect={handleCountySelect}
          onSchoolSelect={setSelectedSchool}
          onBack={() => { setSelectedCounty(null); setSelectedSchool(null); }}
          onViewChange={setCurrentView}
          currentView={currentView}
          userCountyName={userCountyName}
          userCoords={userCoords}
          onGeoCountyDetected={setGeoCounty}
          neighborStates={neighborStates || []}
          stateMesh={stateMesh}
          adjacencyMap={adjacencyMap}
        />
        <Sidebar
          county={selectedCounty}
          countyData={countyData || {}}
          schools={countySchools}
          selectedSchool={selectedSchool}
          onSchoolSelect={setSelectedSchool}
          onBack={() => { setSelectedCounty(null); setSelectedSchool(null); }}
          onCloseSchool={() => setSelectedSchool(null)}
          isOpen={!!selectedCounty}
        />
      </div>
      <Tour />
    </div>
  );
}
