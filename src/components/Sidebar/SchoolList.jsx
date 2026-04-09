import { useState } from 'react';
import { TIER_COLORS, covTier } from '../../config/index.js';
import TierMarker from '../TierMarker.jsx';

export default function SchoolList({ schools, selectedSchool, onSchoolSelect }) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? schools.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : schools;

  const countLabel = search.trim()
    ? `${filtered.length} of ${schools.length}`
    : `${schools.length} schools (A\u2013Z)`;

  return (
    <>
      <div id="sb-search-wrap">
        <label htmlFor="sb-search">Schools</label>
        <input
          id="sb-search"
          type="search"
          placeholder="Search schools…"
          autoComplete="off"
          aria-label="Search schools"
          inputMode="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div id="sb-results-count" aria-live="polite">{countLabel}</div>
      </div>
      <div id="sb-school-list" role="listbox" aria-label="Schools">
        {filtered.length === 0 ? (
          <div className="sb-no-results">No schools match</div>
        ) : (
          filtered.map(school => {
            const tier = school.tier || covTier(school.coverage);
            const isActive = selectedSchool && selectedSchool.name === school.name;
            return (
              <div
                key={school.name}
                className={`sb-school-item${isActive ? ' active' : ''}`}
                role="option"
                aria-selected={isActive}
                onClick={() => onSchoolSelect(isActive ? null : school)}
              >
                <svg className="sb-school-marker" width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
                  <TierMarker tier={tier} />
                </svg>
                <span className="sb-school-name">{school.name}</span>
                <span className="sb-school-cov" style={{ color: TIER_COLORS[tier] }}>
                  {school.coverage.toFixed(1)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
