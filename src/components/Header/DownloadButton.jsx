// Download affordance (#21): an <a download> linking to the static CSV for the
// user's current resolution. No JS-generated CSV — the deployed files are the
// download. Hidden when there's nothing meaningful to download.
//
// Resolution -> file:
//   national -> data/states.csv                                   (all states)
//   state    -> data/states/<code>.csv                            (counties)
//   county   -> data/states/<code>/counties/<county>.csv          (schools)
function withBase(path) {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return `${base}${path}`;
}

export default function DownloadButton({ zoomLevel, stateCode, countySlug }) {
  let href = null;
  let filename = null;
  let label = null;

  if (zoomLevel === 'national') {
    href = withBase('data/states.csv');
    filename = 'states.csv';
    label = 'Download all states (CSV)';
  } else if (zoomLevel === 'state' && stateCode) {
    href = withBase(`data/states/${stateCode}.csv`);
    filename = `${stateCode}-counties.csv`;
    label = `Download ${stateCode.toUpperCase()} counties (CSV)`;
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
