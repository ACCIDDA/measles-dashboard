import { useState } from 'react';
import { TIER_COLORS, TIER_LABELS, GRADES, covTier } from '../../config/index.js';

export default function SchoolDetail({ school, onClose }) {
  const [mode, setMode] = useState('estimated');

  if (!school) return null;

  const values = school.grades[mode];
  const nonNull = values.filter(v => v != null);
  const overall = nonNull.length > 0
    ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length
    : 0;
  const tier = covTier(overall);

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

        <div className="sd-tabs" role="tablist">
          <button
            className={`sd-tab${mode === 'estimated' ? ' active' : ''}`}
            data-mode="estimated"
            role="tab"
            aria-selected={mode === 'estimated'}
            onClick={() => setMode('estimated')}
          >
            Estimated
          </button>
          <button
            className={`sd-tab${mode === 'reported' ? ' active' : ''}`}
            data-mode="reported"
            role="tab"
            aria-selected={mode === 'reported'}
            onClick={() => setMode('reported')}
          >
            Reported
          </button>
        </div>

        <div className="sd-overall">
          <div>
            <div id="sd-cov-val" style={{ color: TIER_COLORS[tier] }}>
              {overall.toFixed(1)}%
            </div>
            <div className="sd-ov-sub">Overall Coverage</div>
          </div>
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
        </div>

        <div className="sd-grades" id="sd-grades" role="list">
          {GRADES.map((grade, i) => {
            const val = values[i];
            const isNull = val == null;
            const barWidth = isNull ? 0 : Math.max(0, (val - 60) / 40 * 100);
            const barColor = isNull ? 'transparent' : TIER_COLORS[covTier(val)];
            return (
              <div className="sd-grade-row" key={grade} role="listitem">
                <span className="sd-grade-lbl">{grade}</span>
                <div className="sd-bar-wrap">
                  <div
                    className="sd-bar"
                    style={{ width: `${barWidth}%`, background: barColor }}
                  />
                </div>
                <span className="sd-grade-val" style={{ color: isNull ? 'var(--muted)' : TIER_COLORS[covTier(val)] }}>
                  {isNull ? 'N/A' : `${val.toFixed(1)}%`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="sd-footer">
          <strong>Estimated</strong> &mdash; model-smoothed via imuGAP &middot;{' '}
          <strong>Reported</strong> &mdash; raw survey data
        </div>
      </div>
    </div>
  );
}
