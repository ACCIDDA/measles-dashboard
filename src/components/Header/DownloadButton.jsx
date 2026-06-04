// Download affordance (#21): an <a download> linking to the static CSV for the
// user's current resolution. No JS-generated output — the deployed files are
// the download. Hidden when there's nothing meaningful to download.
//
// Every level is school-level rows, concatenated up — one plain CSV, no archive
// (#75). The files double as the static data API: any tool that reads a CSV
// from a URL (Arrow, pandas, R, DuckDB) can pull them directly.
//   national -> data/all-schools.csv                      every school, a `state` column
//   state    -> data/states/<code>/schools.csv            that state's schools
//   county   -> data/states/<code>/counties/<county>.csv  that county's schools
function withBase(path) {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return `${base}${path}`;
}

export default function DownloadButton({ zoomLevel, stateCode, countySlug }) {
  let href = null;
  let filename = null;
  let label = null;

  if (zoomLevel === 'national') {
    href = withBase('data/all-schools.csv');
    filename = 'all-schools.csv';
    label = 'Download all schools (CSV)';
  } else if (zoomLevel === 'state' && stateCode) {
    href = withBase(`data/states/${stateCode}/schools.csv`);
    filename = `${stateCode}-schools.csv`;
    label = `Download ${stateCode.toUpperCase()} schools (CSV)`;
  } else if (zoomLevel === 'county' && stateCode && countySlug) {
    href = withBase(`data/states/${stateCode}/counties/${countySlug}.csv`);
    filename = `${stateCode}-${countySlug}-schools.csv`;
    label = `Download ${countySlug.replace(/-/g, ' ')} schools (CSV)`;
  }

  if (!href) return null;

  return (
    <a
      id="download-data"
      className="hd-download"
      href={href}
      download={filename}
      title={label}
      aria-label={label}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span className="hd-download-label">Data</span>
    </a>
  );
}
