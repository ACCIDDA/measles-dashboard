import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { TIER_COLORS, TIER_LABELS, covTier } from '../../config/index.js';
import { FIPS_TO_USPS, normalizeFips, fipsToUsps } from '../../config/states.js';
import MapLegend from './MapLegend.jsx';

const TC = TIER_COLORS;
const TL = TIER_LABELS;
// Greyed-out fill used when a state has no coverage data yet. Companion
// issue #18 owns the data-availability manifest; this view leans on the
// simple rule "missing from national.json → render grey".
const NO_DATA_FILL = '#d9d4cb';

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth <= 640;
}

// Convert a coverage value to a percentage. The stub stores 0–1 fractions,
// but real data may eventually arrive as 0–100; accept both transparently.
function toPercent(coverage) {
  if (coverage == null || Number.isNaN(coverage)) return null;
  return coverage <= 1 ? coverage * 100 : coverage;
}

function stateFill(fips, coverageByFips) {
  const entry = coverageByFips ? coverageByFips[fips] : null;
  if (!entry || entry.coverage == null) return NO_DATA_FILL;
  const pct = toPercent(entry.coverage);
  if (pct == null) return NO_DATA_FILL;
  return TC[covTier(pct)];
}

function buildStateTooltip(container, name, entry) {
  container.textContent = '';
  const nameDiv = document.createElement('div');
  nameDiv.className = 'tt-name';
  nameDiv.textContent = name;
  container.appendChild(nameDiv);

  if (!entry || entry.coverage == null) {
    const row = document.createElement('div');
    row.className = 'tt-row';
    const sp = document.createElement('span');
    sp.textContent = 'No data yet';
    row.appendChild(sp);
    container.appendChild(row);
    return;
  }

  const pct = toPercent(entry.coverage);
  const tier = covTier(pct);
  const rows = [
    ['Coverage', pct.toFixed(1) + '%'],
    ['Tier', TL[tier]],
  ];
  rows.forEach(([label, val], i) => {
    const row = document.createElement('div');
    row.className = 'tt-row';
    const sp1 = document.createElement('span');
    sp1.textContent = label;
    const sp2 = document.createElement('span');
    sp2.textContent = val;
    if (i === 1) sp2.style.color = TC[tier];
    row.appendChild(sp1);
    row.appendChild(sp2);
    container.appendChild(row);
  });

  const hint = document.createElement('div');
  hint.className = 'tt-hint';
  hint.textContent = 'Click to explore counties →';
  container.appendChild(hint);
}

export default function NationalMap({
  stateFeatures,
  coverageByFips,
  onStateSelect,
  currentView,
  highlightedFips = null,
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const statePathsRef = useRef(null);
  const projRef = useRef(null);
  const pathGenRef = useRef(null);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!stateFeatures) return;

    const wrap = wrapRef.current;
    const svg = d3.select(svgRef.current);
    const g = svg.select('#map-g');

    g.selectAll('*').remove();

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const pad = isMobile() ? 12 : 24;
    const stateFC = { type: 'FeatureCollection', features: stateFeatures };
    // us-atlas projects to AlbersUsa-friendly coordinates already; geoIdentity
    // simply re-fits to the available viewport.
    const proj = d3.geoIdentity()
      .reflectY(true)
      .fitExtent([[pad, pad], [W - pad, H - pad]], stateFC);
    const pathGen = d3.geoPath().projection(proj);
    projRef.current = proj;
    pathGenRef.current = pathGen;

    const tt = document.getElementById('tooltip');
    function showTT(x, y) {
      if (isMobile() || !tt) return;
      tt.style.left = Math.min(x + 14, wrap.clientWidth - 210) + 'px';
      tt.style.top = Math.min(y - 10, wrap.clientHeight - 120) + 'px';
      tt.classList.add('show');
    }
    function hideTT() { if (tt) tt.classList.remove('show'); }

    const stateG = g.append('g').attr('id', 'state-g');
    const highlightFips = highlightedFips ? normalizeFips(highlightedFips) : null;
    const statePaths = stateG.selectAll('.state-path').data(stateFeatures).enter().append('path')
      .attr('class', d => {
        const fips = normalizeFips(d.id);
        const entry = coverageByFips ? coverageByFips[fips] : null;
        const hasData = entry && entry.coverage != null;
        const usps = FIPS_TO_USPS[fips];
        const userLoc = highlightFips && fips === highlightFips ? ' state-user-location' : '';
        return `state-path${hasData ? '' : ' no-data'}${usps ? '' : ' non-state'}${userLoc}`;
      })
      .attr('d', pathGen)
      .attr('fill', d => stateFill(normalizeFips(d.id), coverageByFips))
      .attr('data-state', d => fipsToUsps(d.id) || '')
      .attr('data-fips', d => normalizeFips(d.id))
      .style('stroke', 'rgba(255,255,255,0.5)')
      .style('stroke-width', '0.7px')
      .style('cursor', d => fipsToUsps(d.id) ? 'pointer' : 'default')
      .attr('tabindex', d => fipsToUsps(d.id) ? 0 : -1)
      .attr('role', 'button')
      .attr('aria-label', d => {
        const fips = normalizeFips(d.id);
        const entry = coverageByFips ? coverageByFips[fips] : null;
        const name = d.properties && d.properties.name ? d.properties.name : `State ${fips}`;
        if (!entry || entry.coverage == null) return `${name} (no data yet)`;
        const pct = toPercent(entry.coverage);
        return `${name}: ${pct.toFixed(1)}% coverage`;
      });
    statePathsRef.current = statePaths;

    statePaths
      .on('mouseenter', function () {
        if (isMobile()) return;
        d3.select(this).raise()
          .style('filter', 'brightness(1.12)')
          .style('stroke', 'rgba(0,0,0,0.55)')
          .style('stroke-width', '1.6px');
      })
      .on('mousemove', function (e, d) {
        if (isMobile()) return;
        const fips = normalizeFips(d.id);
        const entry = coverageByFips ? coverageByFips[fips] : null;
        const name = d.properties && d.properties.name ? d.properties.name : `State ${fips}`;
        buildStateTooltip(tt, name, entry);
        showTT(e.offsetX, e.offsetY);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .style('filter', null)
          .style('stroke', 'rgba(255,255,255,0.5)')
          .style('stroke-width', '0.7px');
        hideTT();
      })
      .on('click', function (e, d) {
        e.stopPropagation();
        const usps = fipsToUsps(d.id);
        if (usps && typeof onStateSelect === 'function') onStateSelect(usps);
      })
      .on('keydown', function (e, d) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const usps = fipsToUsps(d.id);
        if (usps && typeof onStateSelect === 'function') onStateSelect(usps);
      });

    const ro = new ResizeObserver(() => {
      const nW = wrap.clientWidth;
      const nH = wrap.clientHeight;
      const nPad = isMobile() ? 12 : 24;
      proj.fitExtent([[nPad, nPad], [nW - nPad, nH - nPad]], stateFC);
      statePaths.attr('d', pathGen);
    });
    ro.observe(wrap);

    if (highlightFips) {
      statePaths.filter(d => normalizeFips(d.id) === highlightFips).raise();
    }

    setLoaded(true);

    return () => {
      ro.disconnect();
      hideTT();
    };
  }, [stateFeatures, coverageByFips, onStateSelect, highlightedFips]);

  return (
    <div id="map-wrap" ref={wrapRef}>
      <div id="loading" className={loaded ? 'hidden' : ''}>
        <div className="spinner"></div>
        <span className="load-text">Loading map...</span>
      </div>

      <svg id="map-svg" ref={svgRef} role="application" aria-label="National state-level measles coverage map">
        <rect id="ocean-bg" width="100%" height="100%" fill="#c5dae8" />
        <g id="map-g"></g>
      </svg>

      <div id="tooltip" role="tooltip" aria-hidden="true"></div>

      <MapLegend currentView={currentView} variant="national" />
    </div>
  );
}
