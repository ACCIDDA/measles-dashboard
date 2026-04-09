import { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    target: '#map-svg',
    title: 'Explore the map',
    text: 'Click any county to zoom in and see individual school vaccination rates.',
    position: 'center',
  },
  {
    target: '.view-toggle',
    targetMobile: '#mobile-view-toggle',
    title: 'Switch views',
    text: 'Toggle between overall coverage and schools below the 95% herd-immunity threshold.',
    position: 'below',
  },
  {
    target: '.hd-search-inline',
    targetMobile: '#hd-search-btn',
    title: 'Find a county',
    text: 'Search for any NC county by name to jump straight to it.',
    position: 'below',
  },
];

const LS_KEY = 'nc_measles_tour_done';

export default function Tour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  const isMobile = () => window.innerWidth <= 640;

  const measure = useCallback((idx) => {
    const s = STEPS[idx];
    const selector = isMobile() && s.targetMobile ? s.targetMobile : s.target;
    const el = document.querySelector(selector);
    if (!el) return null;
    return el.getBoundingClientRect();
  }, []);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
    setRect(measure(0));
  }, [measure]);

  const finish = useCallback(() => {
    setActive(false);
    localStorage.setItem(LS_KEY, '1');
  }, []);

  const next = useCallback(() => {
    if (step + 1 >= STEPS.length) {
      finish();
    } else {
      const nextStep = step + 1;
      setStep(nextStep);
      setRect(measure(nextStep));
    }
  }, [step, finish, measure]);

  // Auto-start on first visit after map loads (run once)
  useEffect(() => {
    if (localStorage.getItem(LS_KEY)) return;
    let cancelled = false;
    const check = setInterval(() => {
      if (document.querySelector('#map-svg .county-path')) {
        clearInterval(check);
        if (!cancelled) {
          // Small extra delay so the map is fully painted
          setTimeout(() => { if (!cancelled) start(); }, 400);
        }
      }
    }, 200);
    const giveUp = setTimeout(() => clearInterval(check), 6000);
    return () => { cancelled = true; clearInterval(check); clearTimeout(giveUp); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure on resize
  useEffect(() => {
    if (!active) return;
    const onResize = () => setRect(measure(step));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, step, measure]);

  if (!active || !rect) {
    return (
      <button id="tour-help-btn" onClick={start} aria-label="Show guided tour" title="How to use this dashboard">
        ?
      </button>
    );
  }

  const pad = 8;
  const cur = STEPS[step];

  // Tooltip position — keep within viewport
  const tipW = 300;
  const tipH = 140;
  let tipStyle = {};
  if (cur.position === 'center') {
    // Center over the target area
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    tipStyle = {
      top: Math.min(cy - tipH / 2, window.innerHeight - tipH - 12) + 'px',
      left: Math.max(12, cx - tipW / 2) + 'px',
    };
  } else {
    // Below the target, but clamp to viewport
    const top = rect.bottom + pad;
    const clampedTop = top + tipH > window.innerHeight ? rect.top - tipH - pad : top;
    tipStyle = {
      top: Math.max(8, clampedTop) + 'px',
      left: Math.max(12, Math.min(rect.left, window.innerWidth - tipW - 12)) + 'px',
    };
  }

  return (
    <>
      {/* Backdrop with cutout */}
      <svg id="tour-backdrop" width="100%" height="100%" onClick={finish}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - pad} y={rect.top - pad}
              width={rect.width + pad * 2} height={rect.height + pad * 2}
              rx="10" fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)" />
      </svg>

      {/* Spotlight ring */}
      <div id="tour-spotlight" style={{
        top: rect.top - pad + 'px',
        left: rect.left - pad + 'px',
        width: rect.width + pad * 2 + 'px',
        height: rect.height + pad * 2 + 'px',
      }} />

      {/* Tooltip */}
      <div id="tour-tip" style={tipStyle}>
        <div className="tour-step-count">{step + 1} of {STEPS.length}</div>
        <div className="tour-title">{cur.title}</div>
        <div className="tour-text">{cur.text}</div>
        <div className="tour-actions">
          <button className="tour-skip" onClick={finish}>Skip</button>
          <button className="tour-next" onClick={next}>
            {step + 1 >= STEPS.length ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
