import { useState, useEffect, useCallback } from 'react';
import { useDashboardData, useNationalData } from './hooks/useDashboardData.js';
import { useStateManifest } from './hooks/useStateManifest.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { DEFAULT_STATE_CODE, getStateConfig } from './config/states.js';
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

  // Keep the in-memory route in sync with back/forward navigation so the
  // browser back button transitions /state/<code> → / cleanly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const navigateToState = useCallback((stateCode) => {
    const code = String(stateCode || '').toLowerCase();
    if (!code) return;
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
    return <NationalView onStateSelect={navigateToState} />;
  }
  return <StateView stateCode={route.stateCode} />;
}

function NationalView({ onStateSelect }) {
  const { stateFeatures, coverageByFips, loading: dataLoading, error } = useNationalData();
  const manifest = useStateManifest();
  const [toastState, setToastState] = useState(null);

  const handleStateSelect = useCallback((stateCode) => {
    const code = String(stateCode || '').toLowerCase();
    if (!code) return;
    if (manifest.isReady(code)) {
      onStateSelect(code);
    } else {
      setToastState(manifest.getStateName(code) || code.toUpperCase());
    }
  }, [manifest, onStateSelect]);

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
