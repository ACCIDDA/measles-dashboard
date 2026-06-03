import { TIER_COLORS, TIER_LABELS, covTier } from '../../config/index.js';
import GradeBreakdown from '../GradeBreakdown.jsx';

export default function SchoolDetail({ school, onClose }) {
  if (!school) return null;

  const values = school.grades;
  const nonNull = values.filter(v => v != null);
  // no coverage estimate at all (#60): school has a location but wasn't in the fit.
  const noData = school.noData || nonNull.length === 0;
  const overall = nonNull.length > 0
    ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length
    : 0;
  const tier = noData ? null : covTier(overall);

  return (
    <div id="sb-school-detail" className="open" aria-live="polite">
      <div id="sd-inner">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div id="sd-name">{school.name}</div>
          <button
            id="sd-close"
            aria-label="Close school detail"
            onClick={onClose}
            style={{
              flexShrink: 0,
              background: 'var(--faint)',
              border: '1px solid var(--border2)',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--muted)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        <div className="sd-overall">
          <div>
            <div id="sd-cov-val" style={{ color: noData ? 'var(--muted)' : TIER_COLORS[tier] }}>
              {noData ? 'No data yet' : `${overall.toFixed(1)}%`}
            </div>
            <div className="sd-ov-sub">Avg. Coverage</div>
          </div>
          {!noData && (
            <span
              id="sd-badge"
              style={{
                marginLeft: 'auto',
                background: TIER_COLORS[tier] + '18',
                color: TIER_COLORS[tier],
                fontSize: '11px',
                fontWeight: 500,
                padding: '3px 10px',
                borderRadius: '99px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {TIER_LABELS[tier]}
            </span>
          )}
        </div>

        <GradeBreakdown values={values} id="sd-grades" />

        <div className="sd-footer">
          Coverage estimated via the imuGAP model.
        </div>
      </div>
    </div>
  );
}
