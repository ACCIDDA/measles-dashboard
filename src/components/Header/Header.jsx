import { useState } from 'react';
import CountySearch from './CountySearch.jsx';

export default function Header({ currentView, onViewChange, ncFeatures, countyData, onCountySelect }) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const handleCountySelect = (feature) => {
    const name = feature.properties.name + ' County';
    onCountySelect(name);
    setMobileSearchOpen(false);
  };

  return (
    <header role="banner">
      <img
        src="/ACCIDDABlack.png"
        className="acc-logo-img"
        title="Atlantic Coast Center for Infectious Disease Dynamics and Analytics · UNC Chapel Hill"
        alt="ACCIDDA"
        onError={e => { e.target.style.display = 'none'; }}
      />

      <div className="hd-title">
        <h1>NC Measles (MMR) Coverage</h1>
        <p>K&ndash;5 schools &middot; Click a county to explore</p>
      </div>

      {/* Desktop: always-visible search */}
      <div className="hd-search-inline" role="search" aria-label="Find an NC county">
        <CountySearch
          ncFeatures={ncFeatures}
          countyData={countyData}
          onSelect={handleCountySelect}
          inputId="county-search-main"
          dropdownId="main-dropdown"
          placeholder="Search NC counties…"
        />
      </div>

      {/* Mobile: icon -> panel */}
      <button
        id="hd-search-btn"
        aria-label="Search NC counties"
        aria-expanded={mobileSearchOpen}
        aria-controls="hd-search-expanded"
        onClick={() => setMobileSearchOpen(prev => !prev)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      <div id="hd-search-expanded" className={mobileSearchOpen ? 'show' : ''} role="dialog" aria-label="County search">
        <CountySearch
          ncFeatures={ncFeatures}
          countyData={countyData}
          onSelect={handleCountySelect}
          inputId="county-search-mobile"
          dropdownId="mobile-dropdown"
          placeholder="Search NC counties…"
          isMobile
        />
      </div>

      <div className="view-toggle" role="group" aria-label="Map view">
        <button
          className={`vt-btn${currentView === 'coverage' ? ' active' : ''}`}
          data-view="coverage"
          aria-pressed={currentView === 'coverage'}
          onClick={() => onViewChange('coverage')}
        >
          Coverage
        </button>
        <button
          className={`vt-btn${currentView === 'undervax' ? ' active' : ''}`}
          data-view="undervax"
          aria-pressed={currentView === 'undervax'}
          onClick={() => onViewChange('undervax')}
        >
          Below 95%
        </button>
      </div>
    </header>
  );
}
