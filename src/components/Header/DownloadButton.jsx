// Download affordance, currently unavailable to users.
//
// Every level is school-level rows, concatenated up — one plain CSV, no archive
// (#75). The files double as the static data API: any tool that reads a CSV
// from a URL (Arrow, pandas, R, DuckDB) can pull them directly.
//   national -> data/all-schools.csv                      every school, a `state` column
//   state    -> data/states/<code>/schools.csv            that state's schools
//   county   -> data/states/<code>/counties/<county>.csv  that county's schools
export default function DownloadButton({ zoomLevel, stateCode, countySlug, countyName = null }) {
  let label = null;

  if (zoomLevel === 'national') {
    label = 'Download all schools (CSV)';
  } else if (zoomLevel === 'state' && stateCode) {
    label = `Download ${stateCode.toUpperCase()} schools (CSV)`;
  } else if (zoomLevel === 'county' && stateCode && countySlug) {
    // Prefer the canonical display name ("Wake County"); fall back to the
    // de-slugified slug until stateData lands and the name resolves.
    label = `Download ${countyName || countySlug.replace(/-/g, ' ')} schools (CSV)`;
  }

  if (!label) return null;

  return (
    <span className="hd-download-wrap">
      <button
      id="download-data"
      className="hd-download hd-download-disabled"
      type="button"
      disabled
      aria-label="Download not available"
      >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span className="hd-download-label">Data</span>
      </button>
      <span className="hd-download-tooltip" role="tooltip">Download not available</span>
    </span>
  );
}
