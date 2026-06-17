import { useState, useEffect, useRef, useCallback } from 'react';
import { covTier } from '../../config/index.js';
import SchoolList from './SchoolList.jsx';
import SchoolDetail from './SchoolDetail.jsx';
import GradeBreakdown from '../GradeBreakdown.jsx';

// Phone bottom-sheet snap points, as a fraction of the viewport height. The map
// frames the focused state/county into the top ~52% (see UnifiedMap visH), so
// COLLAPSED keeps the sheet below that band and the map stays visible. EXPANDED
// hands the screen to the school list when the user drags up.
const SHEET_COLLAPSED = 0.5;
const SHEET_EXPANDED = 0.9;
// Matches the CSS `@media (max-width:640px)` breakpoint and the isMobile checks
// in UnifiedMap / Tour, so the draggable sheet and the map framing agree on what
// counts as a phone.
const MOBILE_MAX_WIDTH = 640;
function isPhone() {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH;
}

// Pointer events carry clientY directly; fall back to the touch point so the
// handle still drags if a browser dispatches a touch event instead.
function pointerY(e) {
  if (e.clientY != null) return e.clientY;
  const t = e.touches?.[0] || e.changedTouches?.[0];
  return t ? t.clientY : 0;
}

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

  // ── Phone bottom-sheet drag ──
  // On phones the sheet snaps between COLLAPSED (map visible) and EXPANDED
  // (list-focused). Desktop is untouched: the sheet is a fixed-width side panel
  // and `sheetStyle` stays empty. The handle is draggable; a tap toggles snaps.
  const [isMobile, setIsMobile] = useState(isPhone);
  const [snap, setSnap] = useState(SHEET_COLLAPSED);
  const [dragVh, setDragVh] = useState(null); // live height while dragging
  const dragRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsMobile(isPhone());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-collapse whenever the sheet's subject changes (new county / school
  // cleared) so a fresh selection always reveals the map first.
  useEffect(() => { setSnap(SHEET_COLLAPSED); }, [county]);

  const onHandleDown = useCallback((e) => {
    if (!isMobile) return;
    const startVh = snap * window.innerHeight;
    dragRef.current = { startY: pointerY(e), startVh, moved: false };
    setDragVh(startVh);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [isMobile, snap]);

  const onHandleMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = pointerY(e) - d.startY; // up is negative
    if (Math.abs(dy) > 4) d.moved = true;
    const h = Math.max(
      SHEET_COLLAPSED * 0.6 * window.innerHeight,
      Math.min(SHEET_EXPANDED * window.innerHeight, d.startVh - dy),
    );
    setDragVh(h);
  }, []);

  const endDrag = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    let target;
    if (!d.moved) {
      // Tap → toggle between the two snaps.
      target = snap === SHEET_COLLAPSED ? SHEET_EXPANDED : SHEET_COLLAPSED;
    } else {
      const frac = (dragVh ?? d.startVh) / window.innerHeight;
      const mid = (SHEET_COLLAPSED + SHEET_EXPANDED) / 2;
      target = frac >= mid ? SHEET_EXPANDED : SHEET_COLLAPSED;
    }
    setSnap(target);
    setDragVh(null);
    e?.currentTarget?.releasePointerCapture?.(e.pointerId);
  }, [snap, dragVh]);

  const heightVh = dragVh != null ? `${dragVh}px` : `${snap * 100}vh`;
  const sheetStyle = isMobile
    ? { height: heightVh, maxHeight: `${SHEET_EXPANDED * 100}vh` }
    : undefined;

  // County coverage is the county's CSV row value (the model's node estimate, a
  // median of the posterior) — the same number the map tooltip and the per-grade
  // bars use. We deliberately do NOT re-average the schools here: an unweighted
  // school mean disagrees with the model node value and is exactly the kind of
  // client-side aggregation Carl flagged on #54 (means, unweighted). The
  // consumer just displays the producer's number. (#50)
  const countyCoverage = isCounty && countyData[county] ? countyData[county].mean : null;
  const pctBelow95 = schools.length > 0
    ? (schools.filter(s => s.coverage < 95).length / schools.length) * 100
    : 0;
  const covTierClass = countyCoverage != null ? covTier(countyCoverage).toLowerCase() : '';

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
      className={`${isOpen ? 'open' : ''}${dragVh != null ? ' dragging' : ''}`}
      role="complementary"
      aria-label={isCounty ? 'County details' : 'State details'}
      style={sheetStyle}
    >
      <div
        id="sb-drag-handle"
        role="button"
        tabIndex={isMobile ? 0 : -1}
        aria-label={snap === SHEET_COLLAPSED ? 'Expand panel' : 'Collapse panel'}
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSnap(s => (s === SHEET_COLLAPSED ? SHEET_EXPANDED : SHEET_COLLAPSED));
          }
        }}
      ><div></div></div>

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
              <div className={`sb-stat-val ${covTierClass}`} id="sb-cov">
                {countyCoverage != null ? `${countyCoverage.toFixed(1)}%` : '—'}
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
