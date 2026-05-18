import { useState, useEffect } from 'react';
import { useDashboardData } from './hooks/useDashboardData.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { DEFAULT_STATE_CODE, getStateConfig } from './config/states.js';
import Header from './components/Header/Header.jsx';
import StateMap from './components/Map/StateMap.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Tour from './components/Tour.jsx';

// Parse a state code from the URL path (e.g. "/state/nc") or hash
// ("#/state/nc"). Falls back to DEFAULT_STATE_CODE when no match is found,
// so the existing entry URL still loads the NC view.
function parseStateCodeFromLocation() {
  if (typeof window === 'undefined') return DEFAULT_STATE_CODE;
  const sources = [window.location.pathname || '', window.location.hash || ''];
  for (const src of sources) {
    const match = src.match(/\/state\/([a-zA-Z]{2})(?:[/?#]|$)/);
    if (match) return match[1].toLowerCase();
  }
  return DEFAULT_STATE_CODE;
}

export default function App() {
  const [stateCode] = useState(parseStateCodeFromLocation);
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
  if (error) return <div style={{padding:20}}>Error: {error}</div>;

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
