import { useState, useRef, useEffect } from 'react';
import { TIER_COLORS, covTier } from '../../config/index.js';

function TierMarker({ tier }) {
  const color = TIER_COLORS[tier];
  if (tier === 'H') return <circle cx="6" cy="6" r="5" fill={color} />;
  if (tier === 'M') return <rect x="1" y="1" width="10" height="10" rx="1" fill={color} />;
  return <polygon points="6,1 11,11 1,11" fill={color} />;
}

export default function CountySearch({ ncFeatures, countyData, onSelect, inputId, dropdownId, placeholder, isMobile }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = query.trim()
    ? ncFeatures
        .filter(f => {
          const name = f.properties.name + ' County';
          return name.toLowerCase().includes(query.toLowerCase());
        })
        .slice(0, 8)
    : [];

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleSelect = (feature) => {
    onSelect(feature);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {isMobile ? (
        <div className="hse-inner">
          <input
            id={inputId}
            type="search"
            placeholder={placeholder || 'Search NC counties…'}
            autoComplete="off"
            aria-label="Search for an NC county"
            inputMode="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { if (query.trim()) setOpen(true); }}
          />
        </div>
      ) : (
        <div className="hsi-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            id={inputId}
            type="search"
            placeholder={placeholder || 'Search NC counties…'}
            autoComplete="off"
            aria-label="Search for an NC county"
            inputMode="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { if (query.trim()) setOpen(true); }}
          />
        </div>
      )}
      {open && filtered.length > 0 && (
        <div
          id={dropdownId}
          className="county-dd-list show"
          role="listbox"
          aria-label="County suggestions"
          style={isMobile ? {} : {
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            borderRadius: '10px',
            boxShadow: '0 8px 28px rgba(0,0,0,.14)',
            overflow: 'hidden',
            zIndex: 200,
          }}
        >
          {filtered.map(f => {
            const name = f.properties.name + ' County';
            const data = countyData[name];
            const cov = data ? data.mean : null;
            const tier = cov != null ? covTier(cov) : 'M';
            return (
              <div
                key={f.id || name}
                className="cd-item"
                role="option"
                onClick={() => handleSelect(f)}
              >
                <svg className="cd-marker" width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
                  <TierMarker tier={tier} />
                </svg>
                <span className="cd-name">{name}</span>
                {cov != null && (
                  <span className="cd-cov">{cov.toFixed(1)}%</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
