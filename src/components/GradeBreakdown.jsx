import { TIER_COLORS, GRADES, covTier } from '../config/index.js';

// Shared K-5 per-grade coverage bars (#50). Rendered at the school, county, and
// state levels so the age-specific breakdown looks identical everywhere.
//
// `values` is a 6-element array (K..5) of coverage percentages (0-100), with
// `null` for grades that have no estimate. Renders nothing when every value is
// null — e.g. NC counties, which carry no per-grade aggregate, or a no-data
// school — so callers can drop it in unconditionally.
export default function GradeBreakdown({ values, id, role = 'list' }) {
  if (!values || values.every(v => v == null)) return null;

  return (
    <div className="sd-grades" id={id} role={role}>
      {GRADES.map((grade, i) => {
        const val = values[i];
        const isNull = val == null;
        const barWidth = isNull ? 0 : Math.max(0, (val - 60) / 40 * 100);
        const barColor = isNull ? 'transparent' : TIER_COLORS[covTier(val)];
        return (
          <div className="sd-grade-row" key={grade} role="listitem">
            <span className="sd-grade-lbl">{grade}</span>
            <div className="sd-bar-wrap">
              <div className="sd-bar" style={{ width: `${barWidth}%`, background: barColor }} />
            </div>
            <span
              className="sd-grade-val"
              style={{ color: isNull ? 'var(--muted)' : TIER_COLORS[covTier(val)] }}
            >
              {isNull ? 'N/A' : `${val.toFixed(1)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
