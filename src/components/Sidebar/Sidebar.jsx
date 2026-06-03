import { covTier } from '../../config/index.js';
import SchoolList from './SchoolList.jsx';
import SchoolDetail from './SchoolDetail.jsx';
import GradeBreakdown from '../GradeBreakdown.jsx';

export default function Sidebar({
  county,
  countyData,
  schools,
  selectedSchool,
  onSchoolSelect,
  onBack,
  onCloseSchool,
  isOpen,
  // State-summary mode (#50): shown at state zoom before a county is picked.
  stateSummary = null,
  stateName = '',
}) {
  const isCounty = !!county;

  // County stats are computed over the county's schools (unchanged behavior).
  const avgCoverage = schools.length > 0
    ? schools.reduce((a, s) => a + s.coverage, 0) / schools.length
    : 0;
  const pctBelow95 = schools.length > 0
    ? (schools.filter(s => s.coverage < 95).length / schools.length) * 100
    : 0;
  const avgTier = covTier(avgCoverage).toLowerCase();

  // Per-grade values for the breakdown panel: the county's CSV aggregate when a
  // county is focused, otherwise the state-wide row (#50). Both come straight
  // from the producer's node values — no client-side aggregation.
  const grades = isCounty
    ? (countyData[county] && countyData[county].grades)
    : (stateSummary && stateSummary.grades);
  const hasGrades = Array.isArray(grades) && grades.some(v => v != null);

  const label = isCounty
    ? county
    : (stateSummary ? stateSummary.name : (stateName || '—'));
  const backLabel = isCounty ? 'Return to all counties' : 'Return to national map';

  return (
    <div
      id="sidebar"
      className={isOpen ? 'open' : ''}
      role="complementary"
      aria-label={isCounty ? 'County details' : 'State details'}
    >
      <div id="sb-drag-handle" aria-hidden="true"><div></div></div>

      <div id="sb-county">
        <div id="sb-county-row">
          <span id="sb-county-label">{label}</span>
          <button id="sb-back-inline" aria-label={backLabel} onClick={onBack}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7.5 1.5L3 6l4.5 4.5" />
            </svg>
            Back
          </button>
        </div>

        {isCounty ? (
          <div className="sb-stats" role="region" aria-label="County statistics">
            <div className="sb-stat">
              <div className={`sb-stat-val ${avgTier}`} id="sb-cov">
                {schools.length > 0 ? `${avgCoverage.toFixed(1)}%` : '—'}
              </div>
              <div className="sb-stat-lbl">Avg. Coverage</div>
            </div>
            <div className="sb-stat">
              <div className="sb-stat-val" id="sb-pct">
                {schools.length > 0 ? `${pctBelow95.toFixed(0)}%` : '—'}
              </div>
              <div className="sb-stat-lbl">Below 95%</div>
            </div>
            <div className="sb-stat">
              <div className="sb-stat-val" id="sb-cnt">
                {schools.length > 0 ? schools.length : '—'}
              </div>
              <div className="sb-stat-lbl">Schools</div>
            </div>
          </div>
        ) : (
          <div className="sb-stats" role="region" aria-label="State statistics">
            <div className="sb-stat">
              <div
                className={`sb-stat-val ${stateSummary && stateSummary.coverage != null ? covTier(stateSummary.coverage).toLowerCase() : ''}`}
                id="sb-cov"
              >
                {stateSummary && stateSummary.coverage != null ? `${stateSummary.coverage.toFixed(1)}%` : '—'}
              </div>
              <div className="sb-stat-lbl">Avg. Coverage</div>
            </div>
            <div className="sb-stat">
              <div className="sb-stat-val" id="sb-pct">
                {stateSummary && stateSummary.pctBelow95 != null ? `${stateSummary.pctBelow95.toFixed(0)}%` : '—'}
              </div>
              <div className="sb-stat-lbl">Below 95%</div>
            </div>
            <div className="sb-stat">
              <div className="sb-stat-val" id="sb-cnt">
                {stateSummary && stateSummary.nSchools != null ? stateSummary.nSchools : '—'}
              </div>
              <div className="sb-stat-lbl">Schools</div>
            </div>
          </div>
        )}
      </div>

      {hasGrades && (
        <div className="sb-grades-section" role="region" aria-label="Coverage by grade">
          <div className="sb-grades-title">Coverage by grade</div>
          <GradeBreakdown values={grades} id={isCounty ? 'sb-county-grades' : 'sb-state-grades'} />
        </div>
      )}

      {isCounty && (
        <>
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
        </>
      )}
    </div>
  );
}
