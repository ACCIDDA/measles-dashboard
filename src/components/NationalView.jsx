import { useState, useCallback } from 'react';
import { useStateManifest } from '../hooks/useStateManifest.js';
import NoDataToast from './NoDataToast.jsx';

// Default navigator: full-page assignment, so the existing per-state
// bootstrap (URL → useDashboardData) runs unchanged after drill-down.
// Tests inject their own `navigate` to observe calls without triggering
// jsdom's navigation guard.
function defaultNavigate(href) {
  if (typeof window !== 'undefined') {
    window.location.href = href;
  }
}

// Minimal national-overview view that surfaces the state availability
// manifest as a clickable list. This is intentionally lightweight — the
// rich choropleth (NationalMap) is owned by issue #14. Until that lands,
// this view renders one button per state, marking ready states as
// clickable (navigate into `/state/<code>`) and `coming_soon` states as
// greyed-out + non-navigating, surfacing a toast on activation.
//
// Once NationalMap.jsx exists, App.jsx can swap this component for the
// choropleth; the toast + hook here are designed to be lifted directly.
export default function NationalView({ navigate = defaultNavigate } = {}) {
  const { manifest, loading, error, isReady, getStateName } = useStateManifest();
  const [pendingState, setPendingState] = useState(null);

  const handleSelect = useCallback((code) => {
    if (isReady(code)) {
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
      navigate(`${base}state/${code}`);
      return;
    }
    // Greyed / coming_soon: surface a transient "no data" notice.
    setPendingState(getStateName(code) || code.toUpperCase());
  }, [isReady, getStateName, navigate]);

  if (loading) {
    return (
      <div id="loading">
        <div className="spinner"></div>
        <span className="load-text">Loading state directory…</span>
      </div>
    );
  }
  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!manifest) return null;

  const entries = Object.entries(manifest)
    .sort(([, a], [, b]) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div id="national-view" className="national-view">
      <h2 className="national-view-title">United States — State Availability</h2>
      <p className="national-view-subtitle">
        Click a state to view its dashboard. Greyed states do not yet have data
        available.
      </p>
      <ul className="national-view-list" data-testid="national-state-list">
        {entries.map(([code, entry]) => {
          const ready = entry.status === 'ready';
          return (
            <li key={code} className="national-view-item">
              <button
                type="button"
                data-state-code={code}
                data-state-status={entry.status}
                data-testid={`state-btn-${code}`}
                className={`state-path ${ready ? 'state-ready' : 'state-coming-soon'}`}
                aria-disabled={!ready ? 'true' : undefined}
                onClick={() => handleSelect(code)}
              >
                {entry.name || code.toUpperCase()}
              </button>
            </li>
          );
        })}
      </ul>
      <NoDataToast
        stateName={pendingState}
        onDismiss={() => setPendingState(null)}
      />
    </div>
  );
}
