import { useState, useRef, useEffect, useMemo } from 'react';
import { useStateManifest } from '../../hooks/useStateManifest.js';

// Zoom-scoped search shown on the national view. Lets the user type a
// state name; matching entries from the manifest are shown as
// suggestions. Selecting one fires `onSelect(stateCode)` with a lowercase
// USPS code. `coming_soon` states are still selectable so the parent can
// surface a "data not yet available" toast — they are visually tagged with
// a "(no data yet)" suffix.
//
// The manifest can be passed in explicitly (useful for tests) or, when
// omitted, the component reads it via `useStateManifest()`.
export default function StateSearch({
  manifest: manifestProp,
  onSelect,
  inputId = 'state-search-main',
  dropdownId = 'state-search-dropdown',
  placeholder = 'Search states…',
  ariaLabel = 'Search for a state',
}) {
  const fetched = useStateManifest();
  const manifest = manifestProp !== undefined ? manifestProp : fetched.manifest;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Flatten the manifest into a stable, alphabetically-sorted list of
  // { code, name, status } entries so it filters cheaply and renders in
  // a predictable order.
  const entries = useMemo(() => {
    if (!manifest) return [];
    return Object.keys(manifest)
      .map((code) => ({
        code,
        name: manifest[code]?.name || '',
        status: manifest[code]?.status || '',
      }))
      .filter((e) => e.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [manifest]);

  const filtered = query.trim()
    ? entries
        .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
    : [];

  const hasNoMatches = query.trim().length > 0 && filtered.length === 0;

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

  const handleSelect = (entry) => {
    if (typeof onSelect === 'function') onSelect(entry.code.toLowerCase());
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div className="hsi-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          id={inputId}
          type="search"
          placeholder={placeholder}
          autoComplete="off"
          aria-label={ariaLabel}
          inputMode="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div
          id={dropdownId}
          className="county-dd-list show"
          role="listbox"
          aria-label="State suggestions"
          style={{
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
          {filtered.map((entry) => {
            const isReady = entry.status === 'ready';
            return (
              <div
                key={entry.code}
                className="cd-item"
                role="option"
                aria-selected="false"
                data-state-code={entry.code}
                data-status={entry.status}
                onClick={() => handleSelect(entry)}
              >
                <span className="cd-name">{entry.name}</span>
                {!isReady && (
                  <span className="cd-cov" aria-label="No data yet">(no data yet)</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {open && hasNoMatches && (
        <div
          id={`${dropdownId}-empty`}
          className="county-dd-list show"
          role="status"
          aria-live="polite"
          style={{
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
            padding: '11px 12px',
            fontSize: '14px',
            color: 'var(--muted)',
          }}
        >
          No matching states
        </div>
      )}
    </div>
  );
}
