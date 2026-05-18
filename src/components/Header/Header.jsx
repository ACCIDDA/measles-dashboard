import { useState } from 'react';
import CountySearch from './CountySearch.jsx';

export default function Header({
  currentView,
  onViewChange,
  stateFeatures,
  countyData,
  onCountySelect,
  stateName = 'NC',
  // 'national' hides the county search and shows national landing copy.
  // 'state' (default) keeps the existing search + "Click a county to explore"
  // copy. The view toggle is national-irrelevant (no undervax aggregation
  // exists at the state level yet) so it is suppressed on the national view.
  view = 'state',
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isNational = view === 'national';

  const handleCountySelect = (feature) => {
    const name = feature.properties.name + ' County';
    onCountySelect(name);
    setMobileSearchOpen(false);
  };

  const searchPlaceholder = `Search ${stateName} counties…`;
  const searchAriaLabel = `Search for a ${stateName} county`;
  const searchRegionLabel = `Find a ${stateName} county`;

  return (
    <header role="banner">
      <img
        src={`${import.meta.env.BASE_URL}ACCIDDABlack.png`}
        className="acc-logo-img"
        title="Atlantic Coast Center for Infectious Disease Dynamics and Analytics · UNC Chapel Hill"
        alt="ACCIDDA"
        onError={e => { e.target.style.display = 'none'; }}
      />

      <div className="hd-title">
        <h1>Measles Vaccination (MMR) Coverage</h1>
        <p>{isNational ? 'Click a state to explore' : 'K–5 schools · Click a county to explore'}</p>
      </div>

      {/* County search is scoped to a state, so it's hidden in the national
          view (see issue #17 for the planned zoom-scoped search). */}
      {!isNational && (
        <>
          {/* Desktop: always-visible search */}
          <div className="hd-search-inline" role="search" aria-label={searchRegionLabel}>
            <CountySearch
              stateFeatures={stateFeatures}
              countyData={countyData}
              onSelect={handleCountySelect}
              inputId="county-search-main"
              dropdownId="main-dropdown"
              placeholder={searchPlaceholder}
              ariaLabel={searchAriaLabel}
            />
          </div>

          {/* Mobile: icon -> panel */}
          <button
            id="hd-search-btn"
            aria-label={`Search ${stateName} counties`}
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
              stateFeatures={stateFeatures}
              countyData={countyData}
              onSelect={handleCountySelect}
              inputId="county-search-mobile"
              dropdownId="mobile-dropdown"
              placeholder={searchPlaceholder}
              ariaLabel={searchAriaLabel}
              isMobile
            />
          </div>
        </>
      )}

      {!isNational && (
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
      )}
    </header>
  );
}
