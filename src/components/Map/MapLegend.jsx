import { TIER_COLORS, LEGEND } from '../../config/index.js';

export default function MapLegend({ currentView }) {
  const lv = LEGEND[currentView] || LEGEND.coverage;

  return (
    <div id="map-legend" role="img" aria-label="Map legend">
      <div className="map-leg-title">{lv.title}</div>
      <div className="map-leg-item">
        <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="5" fill={TIER_COLORS.H} />
        </svg>
        <span>{lv.h}</span>
      </div>
      <div className="map-leg-item">
        <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" rx="1" fill={TIER_COLORS.M} />
        </svg>
        <span>{lv.m}</span>
      </div>
      <div className="map-leg-item">
        <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
          <polygon points="6,1 11,11 1,11" fill={TIER_COLORS.L} />
        </svg>
        <span>{lv.l}</span>
      </div>
      <div className="map-leg-sources">
        <a href="https://www.dph.ncdhhs.gov/programs/epidemiology/immunization/data/kindergarten-dashboard" target="_blank" rel="noopener noreferrer">NC DHHS</a>
        {' · '}
        <a href="https://www.cdc.gov/vaccines/data-reporting/index.html" target="_blank" rel="noopener noreferrer">CDC VaxView</a>
        {' · imuGAP'}
      </div>
    </div>
  );
}
