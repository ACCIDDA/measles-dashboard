import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { TIER_COLORS, TIER_LABELS, SHAPES, covTier, uvTier } from '../../config/index.js';
import MapLegend from './MapLegend.jsx';

const TC = TIER_COLORS;
const TL = TIER_LABELS;

function isMobile() {
  return window.innerWidth <= 640;
}

// Deterministic hash of a string → unsigned 32-bit int
function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return h >>> 0;
}

// xorshift32 PRNG seeded by a 32-bit integer
function seededRand(seed) {
  let s = seed || 1;
  return function () {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

// Return geographic [lon, lat] for a school: explicit coords if available,
// otherwise a deterministic random point inside the county polygon.
function scatterCoord(school) {
  if (school.coords) return school.coords;
  const feature = school.feature;
  const [[lon0, lat0], [lon1, lat1]] = d3.geoBounds(feature);
  const rand = seededRand(hashStr(school.name));
  for (let i = 0; i < 300; i++) {
    const lon = lon0 + rand() * (lon1 - lon0);
    const lat = lat0 + rand() * (lat1 - lat0);
    if (d3.geoContains(feature, [lon, lat])) return [lon, lat];
  }
  return d3.geoCentroid(feature);
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

// Build tooltip DOM safely (no innerHTML)
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
  hint.textContent = 'Click to explore schools \u2192';
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
  hint.textContent = 'Click for K\u20135 breakdown';
  container.appendChild(hint);
}

export default function NCMap({
  countyData,
  allSchools,
  ncFeatures,
  selectedCounty,
  selectedSchool,
  onCountySelect,
  onSchoolSelect,
  onBack,
  onViewChange,
  currentView,
  userCountyName,
  userCoords,
  onGeoCountyDetected,
  neighborStates,
  stateMesh,
  adjacencyMap,
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);

  // Mutable refs to avoid stale closures in D3 callbacks
  const zoomedRef = useRef(false);
  const activeSchoolRef = useRef(null);
  const currentScaleRef = useRef(1);
  const currentViewRef = useRef(currentView);
  const selectedCountyRef = useRef(selectedCounty);
  const projRef = useRef(null);
  const pathGenRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const countyPathsRef = useRef(null);
  const schoolsGRef = useRef(null);
  const adjSchoolsGRef = useRef(null);
  const locHighlightGRef = useRef(null);
  const hintShownRef = useRef(false);

  const [loaded, setLoaded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [detectedCounty, setDetectedCounty] = useState(null);

  // Keep refs in sync
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
  useEffect(() => { selectedCountyRef.current = selectedCounty; }, [selectedCounty]);

  // ── Main D3 initialization ──
  useEffect(() => {
    if (!ncFeatures || !countyData || !allSchools) return;

    const wrap = wrapRef.current;
    const svg = d3.select(svgRef.current);
    const g = svg.select('#map-g');

    // Clear any previous render
    g.selectAll('*').remove();

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const pad = isMobile() ? 16 : 40;
    const ncFC = { type: 'FeatureCollection', features: ncFeatures };
    const proj = d3.geoMercator().fitExtent([[pad, pad], [W - pad, H - pad]], ncFC);
    const pathGen = d3.geoPath().projection(proj);
    projRef.current = proj;
    pathGenRef.current = pathGen;

    // Stroke helpers
    function s0(sel) { sel.style('stroke', 'rgba(255,255,255,0.3)').style('stroke-width', '0.7px'); }
    function sSel(sel) { sel.style('stroke', 'rgba(0,0,0,0.7)').style('stroke-width', '2.5px'); }
    function sDim(sel) { sel.style('stroke', 'rgba(60,40,20,0.28)').style('stroke-width', '0.6px'); }

    // Draw non-NC states as gray land
    if (neighborStates) {
      g.append('g').selectAll('.neighbor-county').data(neighborStates).enter().append('path')
        .attr('class', 'neighbor-county').attr('d', pathGen);
    }

    // State mesh lines
    if (stateMesh) {
      g.append('path')
        .datum(stateMesh)
        .attr('class', 'neighbor-state-line').attr('d', pathGen);
    }

    // NC county paths — wrapped in own group so .raise() stays local
    const countyG = g.append('g').attr('id', 'county-g');
    const countyPaths = countyG.selectAll('.county-path').data(ncFeatures).enter().append('path')
      .attr('class', 'county-path').attr('d', pathGen)
      .attr('fill', d => countyFill(d.properties.name + ' County', countyData, allSchools, currentViewRef.current))
      .call(s0);
    countyPathsRef.current = countyPaths;

    // School groups
    const adjSchoolsG = g.append('g');
    const schoolsG = g.append('g');
    adjSchoolsGRef.current = adjSchoolsG;
    schoolsGRef.current = schoolsG;

    // Location highlight group
    const locHighlightG = g.append('g').attr('id', 'loc-highlight-g').style('pointer-events', 'none');
    locHighlightGRef.current = locHighlightG;

    // Zoom behavior — restrict pan to NC bounds so user can't drift to other states
    const [[ncX0, ncY0], [ncX1, ncY1]] = pathGen.bounds(ncFC);
    const panMargin = 60;
    const zoomBehavior = d3.zoom()
      .scaleExtent([1, 40])
      .translateExtent([[ncX0 - panMargin, ncY0 - panMargin], [ncX1 + panMargin, ncY1 + panMargin]])
      .filter(e => !(e.type === 'click') && currentScaleRef.current > 1.05)
      .on('zoom', e => {
        g.attr('transform', e.transform);
        currentScaleRef.current = e.transform.k;
        const k = e.transform.k;
        schoolsG.selectAll('circle')
          .attr('r', d => d === activeSchoolRef.current ? 8 / k : 5.5 / k)
          .attr('stroke-width', d => d === activeSchoolRef.current ? 2 / k : 0.8 / k);
        adjSchoolsG.selectAll('circle').attr('r', 3 / k);
        // Rescale location highlight
        locHighlightG.selectAll('circle[fill="white"]').attr('r', 5 / k).attr('stroke-width', 1.5 / k);
        const strokeEl = document.getElementById('loc-county-stroke');
        if (strokeEl) d3.select(strokeEl).attr('stroke-width', 3 / k + 'px');
      });
    svg.call(zoomBehavior).on('dblclick.zoom', null);
    zoomBehaviorRef.current = zoomBehavior;

    // Background click reset
    let pointerMoved = false;
    svg.on('pointerdown', () => { pointerMoved = false; })
      .on('pointermove', () => { pointerMoved = true; })
      .on('pointerup', e => {
        const tag = (e.target.tagName || '').toLowerCase();
        const isBg = tag === 'svg' || e.target.id === 'ocean-bg' ||
          e.target.classList.contains('neighbor-county') ||
          e.target.classList.contains('neighbor-state-line');
        if (!pointerMoved && zoomedRef.current && isBg) {
          onBack();
        }
      });

    // Tooltip
    const tt = document.getElementById('tooltip');
    function showTT(x, y) {
      if (isMobile()) return;
      tt.style.left = Math.min(x + 14, wrap.clientWidth - 210) + 'px';
      tt.style.top = Math.min(y - 10, wrap.clientHeight - 120) + 'px';
      tt.classList.add('show');
    }
    function hideTT() { tt.classList.remove('show'); }

    // County hover/click
    function clearAllHover() {
      countyPaths.style('filter', null).call(s0);
    }

    countyPaths
      .on('mouseenter', function () {
        if (zoomedRef.current || isMobile()) return;
        clearAllHover();
        d3.select(this).raise()
          .style('filter', 'brightness(1.15)')
          .style('stroke', 'rgba(0,0,0,0.5)')
          .style('stroke-width', '1.8px');
      })
      .on('mousemove', function (e, d) {
        if (zoomedRef.current || isMobile()) return;
        const nm = d.properties.name + ' County';
        const cd = countyData[nm]; if (!cd) return;
        const t = covTier(cd.mean);
        const sc = allSchools.filter(s => s.county === nm);
        buildCountyTooltip(tt, d.properties.name + ' County', cd, t, sc.length);
        showTT(e.offsetX, e.offsetY);
      })
      .on('mouseleave', function () {
        if (!zoomedRef.current) {
          d3.select(this).style('filter', null).call(s0);
        }
        hideTT();
      })
      .on('click', function (e, d) {
        e.stopPropagation();
        clearAllHover();
        onCountySelect(d.properties.name + ' County');
      });

    // Fallback: clear stale highlights when mouse leaves the county group entirely
    countyG.on('mouseleave', function () {
      if (!zoomedRef.current) { clearAllHover(); hideTT(); }
    });

    // Hint overlay
    if (!hintShownRef.current) {
      const hint = document.getElementById('hint-overlay');
      if (hint) {
        setTimeout(() => {
          hint.classList.add('show');
          hintShownRef.current = true;
          setTimeout(() => hint.classList.remove('show'), 3800);
        }, 1000);
      }
    }

    // Geolocation highlight (from saved county name)
    if (userCountyName) {
      const feature = ncFeatures.find(f => f.properties.name + ' County' === userCountyName);
      if (feature) {
        highlightUserCounty(feature, countyPaths, locHighlightG, pathGen);
      }
    }

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      const nW = wrap.clientWidth;
      const nH = wrap.clientHeight;
      const nPad = isMobile() ? 16 : 40;
      proj.fitExtent([[nPad, nPad], [nW - nPad, nH - nPad]], ncFC);
      countyPaths.attr('d', pathGen);
      if (neighborStates) g.selectAll('.neighbor-county').attr('d', pathGen);
      if (stateMesh) g.select('.neighbor-state-line').attr('d', pathGen);
    });
    ro.observe(wrap);

    setLoaded(true);

    return () => {
      ro.disconnect();
      svg.on('.zoom', null);
      svg.on('pointerdown', null).on('pointermove', null).on('pointerup', null);
    };
  }, [ncFeatures, countyData, allSchools, neighborStates, stateMesh]);

  // ── Geolocation coords arrived — highlight the user's county ──
  useEffect(() => {
    if (!userCoords || !ncFeatures || !countyPathsRef.current || !locHighlightGRef.current || !pathGenRef.current) return;
    const { longitude, latitude } = userCoords;
    const feature = ncFeatures.find(f => d3.geoContains(f, [longitude, latitude]));
    if (feature) {
      const name = feature.properties.name + ' County';
      setDetectedCounty(name);
      highlightUserCounty(feature, countyPathsRef.current, locHighlightGRef.current, pathGenRef.current);
      if (onGeoCountyDetected) onGeoCountyDetected(name);
    }
  }, [userCoords, ncFeatures]);

  // ── Update county fill when view changes ──
  useEffect(() => {
    if (!countyPathsRef.current || !countyData || !allSchools) return;
    countyPathsRef.current.attr('fill', d =>
      countyFill(d.properties.name + ' County', countyData, allSchools, currentView)
    );
  }, [currentView, countyData, allSchools]);

  // ── selectedSchool effect: highlight active dot ──
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

  // ── selectedCounty effect: zoom + school dots ──
  useEffect(() => {
    const countyPaths = countyPathsRef.current;
    const schoolsG = schoolsGRef.current;
    const adjSchoolsG = adjSchoolsGRef.current;
    const proj = projRef.current;
    const pathGen = pathGenRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    const svg = d3.select(svgRef.current);
    const wrap = wrapRef.current;

    if (!countyPaths || !schoolsG || !adjSchoolsG || !proj || !pathGen || !zoomBehavior || !wrap) return;

    function s0(sel) { sel.style('stroke', 'rgba(255,255,255,0.3)').style('stroke-width', '0.7px'); }
    function sSel(sel) { sel.style('stroke', 'rgba(0,0,0,0.7)').style('stroke-width', '2.5px'); }
    function sDim(sel) { sel.style('stroke', 'rgba(60,40,20,0.28)').style('stroke-width', '0.6px'); }

    const tt = document.getElementById('tooltip');
    function showTT(x, y) {
      if (isMobile()) return;
      tt.style.left = Math.min(x + 14, wrap.clientWidth - 210) + 'px';
      tt.style.top = Math.min(y - 10, wrap.clientHeight - 120) + 'px';
      tt.classList.add('show');
    }
    function hideTT() { tt.classList.remove('show'); }

    // Show/hide geolocation beacon and pill based on zoom state
    const locHighlightG = locHighlightGRef.current;
    const locPill = document.getElementById('loc-pill');

    if (!selectedCounty) {
      // Reset zoom
      zoomedRef.current = false;
      activeSchoolRef.current = null;
      setZoomed(false);
      countyPaths.each(function () { d3.select(this).style('opacity', '1').style('filter', null).call(s0); });
      schoolsG.selectAll('circle').transition().duration(160).attr('r', 0).attr('opacity', 0).remove();
      adjSchoolsG.selectAll('circle').remove();
      svg.transition().duration(800).ease(d3.easeCubicInOut)
        .call(zoomBehavior.transform, d3.zoomIdentity);
      // Restore beacon and pill
      if (locHighlightG) locHighlightG.style('display', null);
      if (locPill) locPill.classList.add('show');
      hideTT();
      return;
    }

    // Find the feature for the selected county
    const feature = ncFeatures.find(f => f.properties.name + ' County' === selectedCounty);
    if (!feature) return;

    zoomedRef.current = true;
    activeSchoolRef.current = null;
    setZoomed(true);

    // Hide beacon and pill when zoomed
    if (locHighlightG) locHighlightG.style('display', 'none');
    if (locPill) locPill.classList.remove('show');

    // Dim/highlight counties
    countyPaths.each(function (dd) {
      const el = d3.select(this);
      if (dd.id === feature.id) el.style('opacity', '1').call(sSel);
      else el.style('opacity', '0.3').call(sDim);
    });

    // Adjacent county ghost dots (desktop only)
    adjSchoolsG.selectAll('circle').remove();
    if (!isMobile() && adjacencyMap) {
      const adjCounties = adjacencyMap[feature.id] || [];
      const adjList = adjCounties.flatMap(id => {
        const f = ncFeatures.find(ff => ff.id === id);
        return f ? allSchools.filter(s => s.county === f.properties.name + ' County') : [];
      });
      adjSchoolsG.selectAll('circle').data(adjList).enter().append('circle')
        .attr('cx', s => proj(scatterCoord(s))[0])
        .attr('cy', s => proj(scatterCoord(s))[1])
        .attr('r', 3).attr('fill', s => TC[s.tier]).attr('opacity', 0.18).attr('stroke', 'none')
        .style('pointer-events', 'none');
    }

    // School dots — pre-bind data and events now; position after resize settles
    const countySchools = [...allSchools.filter(s => s.county === selectedCounty)]
      .sort((a, b) => a.name.localeCompare(b.name));

    schoolsG.selectAll('circle').remove();
    schoolsG.selectAll('circle').data(countySchools).enter().append('circle')
      .attr('class', 'school-dot')
      .attr('cx', -9999).attr('cy', -9999)  // off-screen until positioned in setTimeout
      .attr('r', 5.5).attr('fill', s => TC[s.tier])
      .attr('stroke', 'rgba(245,240,232,0.7)').attr('stroke-width', 0.8).attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .on('mousemove', function (e, s) {
        if (s === activeSchoolRef.current || isMobile()) return;
        const pt = d3.pointer(e, wrap);
        buildSchoolTooltip(tt, s);
        showTT(pt[0], pt[1]);
      })
      .on('mouseleave', hideTT)
      .on('click', (e, s) => { e.stopPropagation(); hideTT(); onSchoolSelect(s); });

    // Zoom to county — sidebar is an overlay so map stays full width;
    // center within the visible (non-sidebar) region on desktop.
    setTimeout(() => {
      const nW = wrap.clientWidth;
      const nH = wrap.clientHeight;
      const sidebarW = isMobile() ? 0 : 300;
      const visW = nW - sidebarW;
      const visH = isMobile() ? nH * 0.52 : nH;
      const [[x0, y0], [x1, y1]] = pathGen.bounds(feature);
      const scale = Math.min(12, 0.75 / Math.max((x1 - x0) / visW, (y1 - y0) / visH));
      const tx = visW / 2 - scale * (x0 + x1) / 2;
      const ty = visH / 2 - scale * (y0 + y1) / 2;
      svg.interrupt().transition().duration(800).ease(d3.easeCubicInOut)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

      schoolsG.selectAll('circle.school-dot')
        .attr('cx', s => proj(scatterCoord(s))[0])
        .attr('cy', s => proj(scatterCoord(s))[1])
        .attr('r', 5.5).attr('opacity', 0.9);
    }, 50);

    hideTT();
  }, [selectedCounty, ncFeatures, allSchools, countyData, adjacencyMap]);

  // ── Highlight user county helper ──
  function highlightUserCounty(feature, countyPaths, locHighlightG, pathGen) {
    const [cx, cy] = pathGen.centroid(feature);

    // Pill
    const locPill = document.getElementById('loc-pill');
    const locText = document.getElementById('loc-text');
    if (locText) locText.textContent = feature.properties.name + ' Co.';
    if (locPill) locPill.classList.add('show');

    locHighlightG.selectAll('*').remove();

    // County stroke highlight
    if (countyPaths) {
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
    }

    // Animated expanding rings
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

    // Static pin dot
    locHighlightG.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', 5)
      .attr('fill', 'white').attr('stroke', '#222').attr('stroke-width', 1.5);
  }

  // Location pill click handler
  const geoCounty = userCountyName || detectedCounty;
  const handleLocPillClick = useCallback(() => {
    if (geoCounty) {
      onCountySelect(geoCounty);
    }
  }, [geoCounty, onCountySelect]);

  return (
    <div id="map-wrap" ref={wrapRef}>
      <div id="loading" className={loaded ? 'hidden' : ''}>
        <div className="spinner"></div>
        <span className="load-text">Loading map...</span>
      </div>

      <svg id="map-svg" ref={svgRef} role="application" aria-label="NC county map">
        <rect id="ocean-bg" width="100%" height="100%" fill="#c5dae8" />
        <g id="map-g"></g>
      </svg>

      <div id="map-controls">
        <button
          id="back-btn"
          className={zoomed ? 'visible' : ''}
          onClick={onBack}
          aria-label="Return to all counties"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M7.5 1.5L3 6l4.5 4.5" />
          </svg>
          All Counties
        </button>
        <div id="mobile-view-toggle" role="group" aria-label="Map view">
          <button
            className={'mvt-btn' + (currentView === 'coverage' ? ' active' : '')}
            onClick={() => onViewChange('coverage')}
          >
            Coverage
          </button>
          <button
            className={'mvt-btn' + (currentView === 'undervax' ? ' active' : '')}
            onClick={() => onViewChange('undervax')}
          >
            Below 95%
          </button>
        </div>
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

      <MapLegend currentView={currentView} />
    </div>
  );
}
