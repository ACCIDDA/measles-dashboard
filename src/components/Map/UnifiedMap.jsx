import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { TIER_COLORS, TIER_LABELS, covTier, uvTier } from '../../config/index.js';
import { FIPS_TO_USPS, normalizeFips, fipsToUsps, uspsToFips } from '../../config/states.js';
import MapLegend from './MapLegend.jsx';

const TC = TIER_COLORS;
const TL = TIER_LABELS;
const NO_DATA_FILL = '#d9d4cb';

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth <= 640;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers shared with the legacy state-level map. Kept inline so this file is
// self-contained while the rename lands; can be lifted to a util later.
// ─────────────────────────────────────────────────────────────────────────────
function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return h >>> 0;
}
function seededRand(seed) {
  let s = seed || 1;
  return function () {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    s = s >>> 0;
    return s / 0x100000000;
  };
}
function scatterCoord(school) {
  if (school.coords) return school.coords;
  const feature = school.feature;
  if (!feature) return [0, 0];
  const [[lon0, lat0], [lon1, lat1]] = d3.geoBounds(feature);
  const rand = seededRand(hashStr(school.name));
  for (let i = 0; i < 300; i++) {
    const lon = lon0 + rand() * (lon1 - lon0);
    const lat = lat0 + rand() * (lat1 - lat0);
    if (d3.geoContains(feature, [lon, lat])) return [lon, lat];
  }
  return d3.geoCentroid(feature);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fill helpers
// ─────────────────────────────────────────────────────────────────────────────
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
function countyFill(nm, countyData, allSchools, view) {
  const cd = countyData[nm];
  if (!cd) return '#ccc';
  if (view === 'coverage') return TC[covTier(cd.mean)];
  const sc = allSchools.filter(s => s.county === nm);
  return sc.length
    ? TC[uvTier(sc.filter(s => s.coverage < 95).length / sc.length * 100)]
    : '#ccc';
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip builders (no innerHTML)
// ─────────────────────────────────────────────────────────────────────────────
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
function buildCountyTooltip(container, name, cd, tier, schoolCount) {
  container.textContent = '';
  const nameDiv = document.createElement('div');
  nameDiv.className = 'tt-name';
  nameDiv.textContent = name;
  container.appendChild(nameDiv);
  const rows = [
    ['Avg coverage', cd.mean.toFixed(1) + '%'],
    ['Tier', TL[tier]],
    ['Schools', String(schoolCount)],
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
  hint.textContent = 'Click to explore schools →';
  container.appendChild(hint);
}
function buildSchoolTooltip(container, school) {
  container.textContent = '';
  const nameDiv = document.createElement('div');
  nameDiv.className = 'tt-name';
  nameDiv.style.fontSize = '11px';
  nameDiv.textContent = school.name;
  container.appendChild(nameDiv);
  const row = document.createElement('div');
  row.className = 'tt-row';
  const sp1 = document.createElement('span');
  sp1.textContent = 'Coverage';
  const sp2 = document.createElement('span');
  sp2.textContent = school.coverage.toFixed(1) + '%';
  row.appendChild(sp1);
  row.appendChild(sp2);
  container.appendChild(row);
  const hint = document.createElement('div');
  hint.className = 'tt-hint';
  hint.textContent = 'Click for K–5 breakdown';
  container.appendChild(hint);
}

// ─────────────────────────────────────────────────────────────────────────────
// UnifiedMap — one zoom-aware component that renders all three zoom levels.
//
//  zoomLevel       'national' | 'state' | 'county'
//  focusedStateCode  lowercase 2-char (or null on national)
//  focusedCounty   'X County' or null (only meaningful at county zoom)
//  stateData       per-state derived payload (countyData, allSchools, …) or null
//  stateFeatures   all-50 US state polygons (always loaded)
//  coverageByFips  per-state coverage stub (always loaded)
//  countriesFeatures world-atlas countries minus the US (always loaded)
//
// Callbacks: `onStateSelect(code)`, `onCountySelect(name)`,
// `onSchoolSelect(school)`, `onBack()`, `onViewChange(v)`, `currentView`.
// ─────────────────────────────────────────────────────────────────────────────
export default function UnifiedMap({
  zoomLevel,
  focusedStateCode,
  focusedCounty,
  selectedSchool,
  // shared
  stateFeatures,
  coverageByFips,
  countriesFeatures,
  // per-state
  stateData,
  // callbacks
  onStateSelect,
  onCountySelect,
  onSchoolSelect,
  onBack,
  onViewChange,
  currentView,
  // geolocation
  userCountyName,
  userCoords,
  onGeoCountyDetected,
  // labels
  focusedStateName = '',
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);

  // Mutable refs for D3 callbacks. Keeping these out of React state avoids
  // closure-staleness during pan/zoom and click handlers.
  const projRef = useRef(null);
  const pathGenRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const currentScaleRef = useRef(1);
  const statePathsRef = useRef(null);
  const countyPathsRef = useRef(null);
  const schoolsGRef = useRef(null);
  const adjSchoolsGRef = useRef(null);
  const locHighlightGRef = useRef(null);
  const worldGRef = useRef(null);
  const insetGRef = useRef(null);
  const stateGRef = useRef(null);
  const countyGRef = useRef(null);
  const neighborGRef = useRef(null);
  const meshPathRef = useRef(null);
  const zoomLevelRef = useRef(zoomLevel);
  const focusedStateCodeRef = useRef(focusedStateCode);
  const focusedCountyRef = useRef(focusedCounty);
  const activeSchoolRef = useRef(null);
  const currentViewRef = useRef(currentView);
  const onStateSelectRef = useRef(onStateSelect);
  const onCountySelectRef = useRef(onCountySelect);

  const [loaded, setLoaded] = useState(false);
  const [detectedCounty, setDetectedCounty] = useState(null);

  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);
  useEffect(() => { focusedStateCodeRef.current = focusedStateCode; }, [focusedStateCode]);
  useEffect(() => { focusedCountyRef.current = focusedCounty; }, [focusedCounty]);
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
  useEffect(() => { onStateSelectRef.current = onStateSelect; }, [onStateSelect]);
  useEffect(() => { onCountySelectRef.current = onCountySelect; }, [onCountySelect]);

  // ───────────────────────────────────────────────────────────────────────
  // Core scene construction. Re-runs only when the topology changes (state
  // features, world countries). Layer visibility + zoom transforms are
  // updated by lighter effects below to keep render cost flat.
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!stateFeatures) return undefined;

    const wrap = wrapRef.current;
    const svg = d3.select(svgRef.current);
    const g = svg.select('#map-g');
    g.selectAll('*').remove();

    const W = wrap.clientWidth || 800;
    const H = wrap.clientHeight || 600;
    const pad = isMobile() ? 12 : 24;

    // The us-atlas counties-10m topology is in WGS84 lat/lon despite the
    // distributed name. We project it through d3.geoAlbers() — a single
    // conic projection that's good for North America — and reuse the SAME
    // projection for the world-countries layer so they share a coordinate
    // system. Fit the projection to the contiguous-US bbox so the 48
    // states + DC fill the viewport prominently; AK/HI/PR/territories
    // project to their real geographic positions (outside the viewport
    // for AK/HI, partly visible for PR).
    const CONTIG_FIPS = new Set(['01','04','05','06','08','09','10','11','12','13','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','44','45','46','47','48','49','50','51','53','54','55','56']);
    const fitFC = {
      type: 'FeatureCollection',
      features: stateFeatures.filter(f => CONTIG_FIPS.has(normalizeFips(f.id))),
    };
    // Use Mercator (not Albers) so individual states appear "straight on"
    // when the user zooms into them. Albers is a conic projection that
    // rotates parallels — states far from the projection center (NC, FL,
    // ME, WA) end up visibly tilted at state zoom. Mercator's straight
    // meridians keep every state upright at the cost of mild N-S stretch
    // in northern latitudes (acceptable for a US map; AK is in the inset).
    const proj = d3.geoMercator()
      .fitExtent([[pad, pad], [W - pad, H - pad]], fitFC);
    const pathGen = d3.geoPath().projection(proj);
    projRef.current = proj;
    pathGenRef.current = pathGen;

    // World countries — drawn first so the US choropleth layers on top.
    // Uses the SAME projection as the US states, so the two layers line
    // up geographically (Canada north of US border, Mexico south, etc.).
    const worldG = g.append('g').attr('id', 'world-g').style('pointer-events', 'none');
    worldGRef.current = worldG;
    if (countriesFeatures && countriesFeatures.length) {
      worldG.selectAll('path.world-path').data(countriesFeatures).enter().append('path')
        .attr('class', 'world-path')
        .attr('d', pathGen)
        // Slightly desaturated tan that contrasts with the lighter
        // no-data US state fill (#d9d4cb), so Canada and Mexico read as
        // distinct geography even at state zoom where neighboring US
        // states sit alongside them.
        .attr('fill', '#cbbe9d')
        .attr('stroke', '#a39785')
        .attr('stroke-width', 0.6);
    }

    // State paths — always rendered (the choropleth at national zoom; muted
    // at state/county zoom where the focused state's counties take over).
    const stateG = g.append('g').attr('id', 'state-g');
    stateGRef.current = stateG;
    const statePaths = stateG.selectAll('path.state-path').data(stateFeatures).enter().append('path')
      .attr('class', d => {
        const fips = normalizeFips(d.id);
        const entry = coverageByFips ? coverageByFips[fips] : null;
        const hasData = entry && entry.coverage != null;
        const usps = FIPS_TO_USPS[fips];
        return `state-path${hasData ? '' : ' no-data'}${usps ? '' : ' non-state'}`;
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

    // Inset callout for AK / HI / PR. These project off-canvas through the
    // main contiguous-48 fit, so we render them again in a fixed corner box
    // (outside the d3-zoom transform group #map-g, so they stay put as the
    // user zooms). Each cell uses its own Mercator projection sized to fit
    // that single feature.
    const insetSel = d3.select(svg.node()).select('#inset-g');
    insetSel.selectAll('*').remove();
    insetGRef.current = insetSel;
    const INSET_CELLS = [
      // AK needs a polar-friendly projection because the Aleutian Islands
      // cross the antimeridian and break geoMercator (paths render empty).
      { fips: '02', label: 'AK', w: 90, projection: () => d3.geoAlbers().rotate([149, 0]).center([0, 64]).parallels([55, 65]) },
      { fips: '15', label: 'HI', w: 70, projection: () => d3.geoMercator() },
      { fips: '72', label: 'PR', w: 56, projection: () => d3.geoMercator() },
    ];
    const INSET_H = 70;
    const INSET_GAP = 8;
    const insetTotalW = INSET_CELLS.reduce((acc, c) => acc + c.w, 0)
      + (INSET_CELLS.length - 1) * INSET_GAP;
    const insetX0 = 24;
    const insetY0 = 44; // top-left, below the page header
    insetSel.attr('transform', `translate(${insetX0},${insetY0})`);
    insetSel.append('rect')
      .attr('x', -8).attr('y', -22)
      .attr('width', insetTotalW + 16).attr('height', INSET_H + 30)
      .attr('rx', 6).attr('ry', 6)
      .attr('fill', 'rgba(255,255,255,0.88)')
      .attr('stroke', '#bdb5a8').attr('stroke-width', 0.8);
    let cellX = 0;
    INSET_CELLS.forEach(({ fips, label, w, projection }) => {
      const feature = stateFeatures.find(f => normalizeFips(f.id) === fips);
      if (!feature) { cellX += w + INSET_GAP; return; }
      const cellG = insetSel.append('g').attr('transform', `translate(${cellX},0)`);
      cellG.append('text')
        .attr('x', w / 2).attr('y', -8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px').attr('font-weight', 600)
        .attr('fill', '#555').text(label);
      const subProj = projection().fitExtent([[2, 6], [w - 2, INSET_H - 4]], feature);
      const subPath = d3.geoPath().projection(subProj);
      const usps = FIPS_TO_USPS[fips];
      const entry = coverageByFips ? coverageByFips[fips] : null;
      const hasData = entry && entry.coverage != null;
      const name = (feature.properties && feature.properties.name) || `State ${fips}`;
      const ariaLabel = hasData
        ? `${name}: ${toPercent(entry.coverage).toFixed(1)}% coverage`
        : `${name} (no data yet)`;
      cellG.append('path')
        .datum(feature)
        .attr('class', `state-path inset-state-path${hasData ? '' : ' no-data'}`)
        .attr('d', subPath)
        .attr('fill', stateFill(fips, coverageByFips))
        .attr('data-state', usps ? usps.toLowerCase() : '')
        .attr('data-fips', fips)
        .style('stroke', 'rgba(255,255,255,0.5)')
        .style('stroke-width', '0.7px')
        .style('cursor', usps ? 'pointer' : 'default')
        .attr('tabindex', usps ? 0 : -1)
        .attr('role', 'button')
        .attr('aria-label', ariaLabel)
        .on('click', function (e) {
          e.stopPropagation();
          if (zoomLevelRef.current !== 'national') return;
          this.blur();
          if (usps && typeof onStateSelectRef.current === 'function') {
            onStateSelectRef.current(usps.toLowerCase());
          }
        });
      cellX += w + INSET_GAP;
    });

    // Tooltip helpers (shared across hover handlers).
    const tt = document.getElementById('tooltip');
    function showTT(x, y) {
      if (isMobile() || !tt) return;
      tt.style.left = Math.min(x + 14, wrap.clientWidth - 210) + 'px';
      tt.style.top = Math.min(y - 10, wrap.clientHeight - 120) + 'px';
      tt.classList.add('show');
    }
    function hideTT() { if (tt) tt.classList.remove('show'); }

    statePaths
      .on('mouseenter', function () {
        if (zoomLevelRef.current !== 'national' || isMobile()) return;
        d3.select(this).raise()
          .style('filter', 'brightness(1.12)')
          .style('stroke', 'rgba(0,0,0,0.55)')
          .style('stroke-width', '1.6px');
      })
      .on('mousemove', function (e, d) {
        if (zoomLevelRef.current !== 'national' || isMobile()) return;
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
        if (zoomLevelRef.current !== 'national') return;
        this.blur();
        const usps = fipsToUsps(d.id);
        if (usps && typeof onStateSelectRef.current === 'function') onStateSelectRef.current(usps);
      })
      .on('keydown', function (e, d) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (zoomLevelRef.current !== 'national') return;
        e.preventDefault();
        const usps = fipsToUsps(d.id);
        if (usps && typeof onStateSelectRef.current === 'function') onStateSelectRef.current(usps);
      });

    // Neighbor states (drawn beneath the focused state's counties at state
    // zoom). Recreated when stateData changes (see below).
    const neighborG = g.append('g').attr('id', 'neighbor-g').style('pointer-events', 'none');
    neighborGRef.current = neighborG;

    // County layer container — populated when stateData is available.
    const countyG = g.append('g').attr('id', 'county-g');
    countyGRef.current = countyG;

    // School groups
    const adjSchoolsG = g.append('g').attr('id', 'adj-schools-g').style('pointer-events', 'none');
    const schoolsG = g.append('g').attr('id', 'schools-g');
    adjSchoolsGRef.current = adjSchoolsG;
    schoolsGRef.current = schoolsG;

    // Location highlight group (geolocation pin)
    const locHighlightG = g.append('g').attr('id', 'loc-highlight-g').style('pointer-events', 'none');
    locHighlightGRef.current = locHighlightG;

    // ─────────────────────────────────────────────────────────────────────
    // Zoom behaviour. We always attach d3-zoom to the SVG. Programmatic
    // transitions (driven by zoomLevel / focused* prop changes below) call
    // `svg.transition().call(zoomBehavior.transform, …)` so they remain
    // composable with user pan/wheel zoom at the deepest levels.
    // ─────────────────────────────────────────────────────────────────────
    const zoomBehavior = d3.zoom()
      .scaleExtent([1, 40])
      .filter(e => {
        // Only allow user-initiated pan/wheel zoom once we've zoomed in past
        // the national level. At national zoom we still want clicks to fire
        // on state paths, so suppress drag-pan there.
        if (e.type === 'click') return false;
        return zoomLevelRef.current !== 'national' && currentScaleRef.current > 1.05;
      })
      .on('zoom', e => {
        g.attr('transform', e.transform);
        currentScaleRef.current = e.transform.k;
        const k = e.transform.k;
        if (schoolsGRef.current) {
          schoolsGRef.current.selectAll('circle')
            .attr('r', d => d === activeSchoolRef.current ? 8 / k : 5.5 / k)
            .attr('stroke-width', d => d === activeSchoolRef.current ? 2 / k : 0.8 / k);
        }
        if (adjSchoolsGRef.current) adjSchoolsGRef.current.selectAll('circle').attr('r', 3 / k);
        if (locHighlightGRef.current) {
          locHighlightGRef.current.selectAll('circle[fill="white"]').attr('r', 5 / k).attr('stroke-width', 1.5 / k);
          const strokeEl = document.getElementById('loc-county-stroke');
          if (strokeEl) d3.select(strokeEl).attr('stroke-width', 3 / k + 'px');
        }
      });
    svg.call(zoomBehavior).on('dblclick.zoom', null);
    zoomBehaviorRef.current = zoomBehavior;

    // Background pointer/up → zoom out one level (replaces the legacy state
    // map's "click empty space to clear selection" affordance, but unified
    // across all three levels).
    let pointerMoved = false;
    svg.on('pointerdown', () => { pointerMoved = false; })
      .on('pointermove', () => { pointerMoved = true; })
      .on('pointerup', e => {
        const tag = (e.target.tagName || '').toLowerCase();
        const isBg = tag === 'svg' || e.target.id === 'ocean-bg' ||
          e.target.classList.contains('neighbor-county') ||
          e.target.classList.contains('neighbor-state-line') ||
          e.target.classList.contains('world-path');
        if (!pointerMoved && zoomLevelRef.current !== 'national' && isBg && typeof onBack === 'function') {
          onBack();
        }
      });

    // ResizeObserver: re-fit projection + recompute path generators.
    const ro = new ResizeObserver(() => {
      const nW = wrap.clientWidth || W;
      const nH = wrap.clientHeight || H;
      const nPad = isMobile() ? 12 : 24;
      proj.fitExtent([[nPad, nPad], [nW - nPad, nH - nPad]], fitFC);
      statePaths.attr('d', pathGen);
      if (countriesFeatures && countriesFeatures.length) {
        worldG.selectAll('path.world-path').attr('d', pathGen);
      }
      if (countyPathsRef.current) countyPathsRef.current.attr('d', pathGen);
      if (neighborGRef.current) neighborGRef.current.selectAll('path.neighbor-county').attr('d', pathGen);
      if (meshPathRef.current) meshPathRef.current.attr('d', pathGen);
    });
    ro.observe(wrap);

    setLoaded(true);

    return () => {
      ro.disconnect();
      hideTT();
      svg.on('.zoom', null);
      svg.on('pointerdown', null).on('pointermove', null).on('pointerup', null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFeatures, countriesFeatures, coverageByFips]);

  // ───────────────────────────────────────────────────────────────────────
  // Build / tear down the focused state's county layer + schools when
  // stateData changes. At national zoom this stays empty.
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const countyG = countyGRef.current;
    const neighborG = neighborGRef.current;
    const pathGen = pathGenRef.current;
    if (!countyG || !neighborG || !pathGen) return undefined;

    // Reset
    countyG.selectAll('*').remove();
    neighborG.selectAll('*').remove();
    countyPathsRef.current = null;
    meshPathRef.current = null;
    if (schoolsGRef.current) schoolsGRef.current.selectAll('*').remove();
    if (adjSchoolsGRef.current) adjSchoolsGRef.current.selectAll('*').remove();

    if (!stateData) return undefined;

    const { stateFeatures: counties, neighborStates, stateMesh, countyData, allSchools } = stateData;
    if (!counties) return undefined;

    // Neighbor (non-focus) states drawn beneath the focused state to provide
    // geographic context while the user is zoomed in.
    if (neighborStates) {
      neighborG.selectAll('path.neighbor-county').data(neighborStates).enter().append('path')
        .attr('class', 'neighbor-county')
        .attr('d', pathGen);
    }
    if (stateMesh) {
      meshPathRef.current = neighborG.append('path')
        .datum(stateMesh)
        .attr('class', 'neighbor-state-line')
        .attr('d', pathGen);
    }

    function s0(sel) { sel.style('stroke', 'rgba(255,255,255,0.3)').style('stroke-width', '0.7px'); }

    const view = currentViewRef.current;
    const countyPaths = countyG.selectAll('path.county-path').data(counties).enter().append('path')
      .attr('class', 'county-path')
      .attr('d', pathGen)
      .attr('fill', d => countyFill(d.properties.name + ' County', countyData, allSchools, view))
      .call(s0);
    countyPathsRef.current = countyPaths;

    // County interaction — hover / click → select.
    const tt = document.getElementById('tooltip');
    const wrap = wrapRef.current;
    function showTT(x, y) {
      if (isMobile() || !tt || !wrap) return;
      tt.style.left = Math.min(x + 14, wrap.clientWidth - 210) + 'px';
      tt.style.top = Math.min(y - 10, wrap.clientHeight - 120) + 'px';
      tt.classList.add('show');
    }
    function hideTT() { if (tt) tt.classList.remove('show'); }

    countyPaths
      .on('mouseenter', function () {
        if (focusedCountyRef.current || isMobile()) return;
        d3.select(this).raise()
          .style('filter', 'brightness(1.15)')
          .style('stroke', 'rgba(0,0,0,0.5)')
          .style('stroke-width', '1.8px');
      })
      .on('mousemove', function (e, d) {
        if (focusedCountyRef.current || isMobile()) return;
        const nm = d.properties.name + ' County';
        const cd = countyData[nm]; if (!cd) return;
        const t = covTier(cd.mean);
        const sc = allSchools.filter(s => s.county === nm);
        buildCountyTooltip(tt, nm, cd, t, sc.length);
        showTT(e.offsetX, e.offsetY);
      })
      .on('mouseleave', function () {
        if (!focusedCountyRef.current) {
          d3.select(this).style('filter', null).call(s0);
        }
        hideTT();
      })
      .on('click', function (e, d) {
        e.stopPropagation();
        const nm = d.properties.name + ' County';
        if (typeof onCountySelectRef.current === 'function') onCountySelectRef.current(nm);
      });

    return undefined;
  }, [stateData]);

  // ───────────────────────────────────────────────────────────────────────
  // County colour follows the current view (coverage ↔ undervax). Cheap;
  // only updates fills, no re-creation.
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!countyPathsRef.current || !stateData) return;
    countyPathsRef.current.attr('fill', d =>
      countyFill(d.properties.name + ' County', stateData.countyData, stateData.allSchools, currentView)
    );
  }, [currentView, stateData]);

  // ───────────────────────────────────────────────────────────────────────
  // Layer visibility based on zoom level. Layers are always in the DOM (so
  // their selections survive across transitions); we just toggle `display`
  // to swap "what's painted" in lock-step with the zoom transform.
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // World countries layer stays visible at all zoom levels — it scales
    // with the d3-zoom transform along with the state/county layers, so
    // Canada / Mexico / Caribbean stay in geographic context when the
    // user zooms into a state.
    if (worldGRef.current) worldGRef.current.style('display', null);
    if (insetGRef.current) insetGRef.current.style('display', zoomLevel === 'national' ? null : 'none');
    if (neighborGRef.current) neighborGRef.current.style('display', zoomLevel === 'national' ? 'none' : null);
    if (countyGRef.current) countyGRef.current.style('display', zoomLevel === 'national' ? 'none' : null);
    if (stateGRef.current) {
      // At state/county zoom we dim the choropleth states beneath the
      // focused state's counties; keeping them in the DOM ensures the
      // zoom-out transition has a target to ease back to.
      stateGRef.current.style('opacity', 1);
      if (statePathsRef.current) {
        statePathsRef.current.style('pointer-events', zoomLevel === 'national' ? null : 'none');
      }
    }
  }, [zoomLevel]);

  // ───────────────────────────────────────────────────────────────────────
  // Zoom transitions driven by (zoomLevel, focusedStateCode, focusedCounty).
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const pathGen = pathGenRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    const wrap = wrapRef.current;
    if (!pathGen || !zoomBehavior || !wrap) return;

    const nW = wrap.clientWidth || 800;
    const nH = wrap.clientHeight || 600;

    if (zoomLevel === 'national') {
      // Zoom out to identity (national choropleth + world background).
      svg.transition().duration(700).ease(d3.easeCubicInOut)
        .call(zoomBehavior.transform, d3.zoomIdentity);
      return;
    }

    if (zoomLevel === 'state') {
      // Zoom to the focused state's bounding box (computed from us-atlas
      // state features so we never need the per-state payload to drive the
      // transition — it can land mid-fetch).
      const fips = uspsToFips(focusedStateCode);
      if (!fips || !stateFeatures) return;
      const feat = stateFeatures.find(f => normalizeFips(f.id) === fips);
      if (!feat) return;
      const sidebarW = isMobile() ? 0 : 0; // sidebar is overlay at state zoom
      const visW = nW - sidebarW;
      const visH = nH;
      const [[x0, y0], [x1, y1]] = pathGen.bounds(feat);
      // 0.55 fills ~55% of the viewport with the state, leaving generous
      // surrounding context (neighbour states, Canada/Mexico, Atlantic)
      // so users keep their geographic bearings at state zoom.
      const scale = Math.min(12, 0.55 / Math.max((x1 - x0) / visW, (y1 - y0) / visH));
      const tx = visW / 2 - scale * (x0 + x1) / 2;
      const ty = visH / 2 - scale * (y0 + y1) / 2;
      svg.transition().duration(800).ease(d3.easeCubicInOut)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      return;
    }

    // zoomLevel === 'county'
    if (!stateData || !stateData.stateFeatures || !focusedCounty) return;
    const feat = stateData.stateFeatures.find(f => f.properties.name + ' County' === focusedCounty);
    if (!feat) return;
    const sidebarW = isMobile() ? 0 : 300;
    const visW = nW - sidebarW;
    const visH = isMobile() ? nH * 0.52 : nH;
    const [[x0, y0], [x1, y1]] = pathGen.bounds(feat);
    const scale = Math.min(12, 0.75 / Math.max((x1 - x0) / visW, (y1 - y0) / visH));
    const tx = visW / 2 - scale * (x0 + x1) / 2;
    const ty = visH / 2 - scale * (y0 + y1) / 2;
    svg.transition().duration(800).ease(d3.easeCubicInOut)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, [zoomLevel, focusedStateCode, focusedCounty, stateData, stateFeatures]);

  // ───────────────────────────────────────────────────────────────────────
  // County selection visuals + school dots (county zoom only).
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const countyPaths = countyPathsRef.current;
    const schoolsG = schoolsGRef.current;
    const adjSchoolsG = adjSchoolsGRef.current;
    const proj = projRef.current;
    if (!countyPaths || !schoolsG || !adjSchoolsG || !proj || !stateData) return;

    function s0(sel) { sel.style('stroke', 'rgba(255,255,255,0.3)').style('stroke-width', '0.7px'); }
    function sSel(sel) { sel.style('stroke', 'rgba(0,0,0,0.7)').style('stroke-width', '2.5px'); }
    function sDim(sel) { sel.style('stroke', 'rgba(60,40,20,0.28)').style('stroke-width', '0.6px'); }

    if (!focusedCounty) {
      activeSchoolRef.current = null;
      countyPaths.each(function () {
        d3.select(this).style('opacity', '1').style('filter', null).call(s0);
      });
      schoolsG.selectAll('circle').transition().duration(160).attr('r', 0).attr('opacity', 0).remove();
      adjSchoolsG.selectAll('circle').remove();
      return;
    }

    const { stateFeatures: counties, allSchools, adjacencyMap } = stateData;
    const feature = counties.find(f => f.properties.name + ' County' === focusedCounty);
    if (!feature) return;
    activeSchoolRef.current = null;
    countyPaths.each(function (dd) {
      const el = d3.select(this);
      if (dd.id === feature.id) el.style('opacity', '1').call(sSel);
      else el.style('opacity', '0.3').call(sDim);
    });

    // Adjacent county ghost schools (desktop only).
    adjSchoolsG.selectAll('circle').remove();
    if (!isMobile() && adjacencyMap) {
      const adjList = (adjacencyMap[feature.id] || []).flatMap(id => {
        const f = counties.find(ff => ff.id === id);
        return f ? allSchools.filter(s => s.county === f.properties.name + ' County') : [];
      });
      adjSchoolsG.selectAll('circle').data(adjList).enter().append('circle')
        .attr('cx', s => proj(scatterCoord(s))[0])
        .attr('cy', s => proj(scatterCoord(s))[1])
        .attr('r', 3).attr('fill', s => TC[s.tier]).attr('opacity', 0.18).attr('stroke', 'none')
        .style('pointer-events', 'none');
    }

    // School dots
    const countySchools = [...allSchools.filter(s => s.county === focusedCounty)]
      .sort((a, b) => a.name.localeCompare(b.name));
    schoolsG.selectAll('circle').remove();
    const tt = document.getElementById('tooltip');
    schoolsG.selectAll('circle').data(countySchools).enter().append('circle')
      .attr('class', 'school-dot')
      .attr('cx', s => proj(scatterCoord(s))[0])
      .attr('cy', s => proj(scatterCoord(s))[1])
      .attr('r', 5.5).attr('fill', s => TC[s.tier])
      .attr('stroke', 'rgba(245,240,232,0.7)').attr('stroke-width', 0.8).attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .on('mousemove', function (e, s) {
        if (s === activeSchoolRef.current || isMobile() || !tt) return;
        const wrap = wrapRef.current;
        if (!wrap) return;
        const pt = d3.pointer(e, wrap);
        buildSchoolTooltip(tt, s);
        tt.style.left = Math.min(pt[0] + 14, wrap.clientWidth - 210) + 'px';
        tt.style.top = Math.min(pt[1] - 10, wrap.clientHeight - 120) + 'px';
        tt.classList.add('show');
      })
      .on('mouseleave', () => { if (tt) tt.classList.remove('show'); })
      .on('click', (e, s) => {
        e.stopPropagation();
        if (tt) tt.classList.remove('show');
        if (typeof onSchoolSelect === 'function') onSchoolSelect(s);
      });
  }, [focusedCounty, stateData, onSchoolSelect]);

  // ───────────────────────────────────────────────────────────────────────
  // Highlight selected school dot (size + stroke).
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    activeSchoolRef.current = selectedSchool;
    const schoolsG = schoolsGRef.current;
    if (!schoolsG) return;
    const k = currentScaleRef.current;
    schoolsG.selectAll('circle.school-dot')
      .attr('r', d => d === selectedSchool ? 9 / k : 5.5 / k)
      .attr('stroke', d => d === selectedSchool ? '#fff' : 'rgba(245,240,232,0.7)')
      .attr('stroke-width', d => d === selectedSchool ? 2.5 / k : 0.8 / k)
      .attr('opacity', d => d === selectedSchool ? 1 : 0.9);
  }, [selectedSchool]);

  // ───────────────────────────────────────────────────────────────────────
  // Geolocation highlight — drops a beacon on the user's county when
  // available. Lifted unchanged from StateMap so its visual fidelity stays.
  // ───────────────────────────────────────────────────────────────────────
  function highlightUserCounty(feature) {
    const pathGen = pathGenRef.current;
    const countyPaths = countyPathsRef.current;
    const locHighlightG = locHighlightGRef.current;
    if (!pathGen || !countyPaths || !locHighlightG) return;
    const [cx, cy] = pathGen.centroid(feature);

    const locPill = document.getElementById('loc-pill');
    const locText = document.getElementById('loc-text');
    if (locText) locText.textContent = feature.properties.name + ' Co.';
    if (locPill) locPill.classList.add('show');

    locHighlightG.selectAll('*').remove();
    countyPaths.each(function (d) {
      if (d.id === feature.id) {
        d3.select(this).clone(true).lower()
          .attr('fill', 'none')
          .attr('stroke', '#222')
          .attr('stroke-width', '3px')
          .attr('opacity', '0.0')
          .attr('id', 'loc-county-stroke')
          .style('pointer-events', 'none')
          .transition().duration(400).attr('opacity', '1');
      }
    });
    [0, 600, 1200].forEach((delay, i) => {
      const ring = locHighlightG.append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', 0)
        .attr('fill', 'none').attr('stroke', '#222')
        .attr('stroke-width', 2 - i * 0.4).attr('opacity', 0);
      function pulse() {
        ring.attr('r', 0).attr('opacity', 0.7)
          .transition().delay(delay).duration(1800).ease(d3.easeCubicOut)
          .attr('r', 38).attr('opacity', 0)
          .on('end', pulse);
      }
      pulse();
    });
    locHighlightG.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', 5)
      .attr('fill', 'white').attr('stroke', '#222').attr('stroke-width', 1.5);
  }

  useEffect(() => {
    if (!userCoords || !stateData || !stateData.stateFeatures) return;
    const { longitude, latitude } = userCoords;
    const feature = stateData.stateFeatures.find(f => d3.geoContains(f, [longitude, latitude]));
    if (feature) {
      const name = feature.properties.name + ' County';
      setDetectedCounty(name);
      highlightUserCounty(feature);
      if (typeof onGeoCountyDetected === 'function') onGeoCountyDetected(name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCoords, stateData]);

  useEffect(() => {
    if (!userCountyName || !stateData || !stateData.stateFeatures) return;
    const feature = stateData.stateFeatures.find(f => f.properties.name + ' County' === userCountyName);
    if (feature) highlightUserCounty(feature);
  }, [userCountyName, stateData]);

  const geoCounty = userCountyName || detectedCounty;
  const handleLocPillClick = useCallback(() => {
    if (geoCounty && typeof onCountySelect === 'function') onCountySelect(geoCounty);
  }, [geoCounty, onCountySelect]);

  const variant = zoomLevel === 'national' ? 'national' : 'state';
  const stateZoomActive = zoomLevel === 'state' || zoomLevel === 'county';

  return (
    <div id="map-wrap" ref={wrapRef}>
      <div id="loading" className={loaded ? 'hidden' : ''}>
        <div className="spinner"></div>
        <span className="load-text">Loading map...</span>
      </div>

      <svg
        id="map-svg"
        ref={svgRef}
        role="application"
        aria-label={
          zoomLevel === 'national'
            ? 'National state-level measles coverage map'
            : `${focusedStateName || 'state'} county map`
        }
      >
        <rect id="ocean-bg" width="100%" height="100%" fill="#c5dae8" />
        <g id="map-g"></g>
        <g id="inset-g"></g>
      </svg>

      <div id="map-controls">
        <button
          id="back-btn"
          className={stateZoomActive ? 'visible' : ''}
          onClick={onBack}
          aria-label="Zoom out"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M7.5 1.5L3 6l4.5 4.5" />
          </svg>
          {zoomLevel === 'county' ? 'All Counties' : 'Back'}
        </button>
        {stateZoomActive && (
          <div id="mobile-view-toggle" role="group" aria-label="Map view">
            <button
              className={'mvt-btn' + (currentView === 'coverage' ? ' active' : '')}
              onClick={() => onViewChange && onViewChange('coverage')}
            >
              Coverage
            </button>
            <button
              className={'mvt-btn' + (currentView === 'undervax' ? ' active' : '')}
              onClick={() => onViewChange && onViewChange('undervax')}
            >
              Below 95%
            </button>
          </div>
        )}
      </div>

      <div
        id="loc-pill"
        role="button"
        tabIndex={0}
        onClick={handleLocPillClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleLocPillClick(); }}
      >
        <div id="loc-dot"></div>
        <span id="loc-text">My county</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--muted)' }}>
          <path d="M4.5 1.5L9 6l-4.5 4.5" />
        </svg>
      </div>

      <div id="hint-overlay" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        Click any county to explore its schools
      </div>

      <div id="tooltip" role="tooltip" aria-hidden="true"></div>

      <MapLegend currentView={currentView} stateCode={focusedStateCode} variant={variant} />
    </div>
  );
}
