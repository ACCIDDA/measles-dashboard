import { covTier } from '../../config/index.js';
import SchoolList from './SchoolList.jsx';
import SchoolDetail from './SchoolDetail.jsx';

export default function Sidebar({ county, countyData: _countyData, schools, selectedSchool, onSchoolSelect, onBack, onCloseSchool, isOpen }) {
  const avgCoverage = schools.length > 0
    ? schools.reduce((a, s) => a + s.coverage, 0) / schools.length
    : 0;
  const pctBelow95 = schools.length > 0
    ? (schools.filter(s => s.coverage < 95).length / schools.length) * 100
    : 0;
  const avgTier = covTier(avgCoverage).toLowerCase();

  return (
    <div id="sidebar" className={isOpen ? 'open' : ''} role="complementary" aria-label="County details">
      <div id="sb-drag-handle" aria-hidden="true"><div></div></div>

      <div id="sb-county">
        <div id="sb-county-row">
          <span id="sb-county-label">{county || '\u2014'}</span>
          <button id="sb-back-inline" aria-label="Return to all counties" onClick={onBack}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7.5 1.5L3 6l4.5 4.5" />
            </svg>
            Back
          </button>
        </div>
        <div className="sb-stats" role="region" aria-label="County statistics">
          <div className="sb-stat">
            <div className={`sb-stat-val ${avgTier}`} id="sb-cov">
              {schools.length > 0 ? `${avgCoverage.toFixed(1)}%` : '\u2014'}
            </div>
            <div className="sb-stat-lbl">Avg Coverage</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-val" id="sb-pct">
              {schools.length > 0 ? `${pctBelow95.toFixed(0)}%` : '\u2014'}
            </div>
            <div className="sb-stat-lbl">Below 95%</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-val" id="sb-cnt">
              {schools.length > 0 ? schools.length : '\u2014'}
            </div>
            <div className="sb-stat-lbl">Schools</div>
          </div>
        </div>
      </div>

      <SchoolList
        schools={schools}
        selectedSchool={selectedSchool}
        onSchoolSelect={onSchoolSelect}
      />

      {selectedSchool && (
        <SchoolDetail
          school={selectedSchool}
          onClose={onCloseSchool}
        />
      )}
    </div>
  );
}
