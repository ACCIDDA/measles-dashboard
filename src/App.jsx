import { useState, useEffect } from 'react';
import { useDashboardData } from './hooks/useDashboardData.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import Header from './components/Header/Header.jsx';
import NCMap from './components/Map/NCMap.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Tour from './components/Tour.jsx';

export default function App() {
  const [selectedCounty, setSelectedCounty] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [currentView, setCurrentView] = useState('coverage');
  const { countyData, allSchools, ncFeatures, neighborStates, stateMesh, adjacencyMap, loading, error } = useDashboardData();
  const { userCountyName, userCoords, setGeoCounty } = useGeolocation();

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
        ncFeatures={ncFeatures || []}
        countyData={countyData || {}}
        onCountySelect={handleCountySelect}
      />
      <div id="body-row">
        <NCMap
          countyData={countyData || {}}
          allSchools={allSchools || []}
          ncFeatures={ncFeatures || []}
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
