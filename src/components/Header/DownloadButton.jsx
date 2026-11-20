// Build the requested download in the browser from the registered state APIs.
// The repository only contains the state registry, never copies of the data.
import { useState } from "react";
import { csvFormat, csvParse } from "d3-dsv";
import { columnNames } from "../../data/schema.js";

const SCHOOL_COLUMNS = columnNames("data/states/{state}/schools.csv");

function withBase(path) {
  const base =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.BASE_URL) ||
    "/";
  return `${base}${path}`;
}

// Normalize county labels and route slugs to the same comparable key. API rows
// may include the word "County" while the URL slug normally omits it.
const countyKey = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/ county$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Prefixing formula-like string cells with an
// apostrophe; signed numeric values remain unchanged.
const spreadsheetSafeValue = (value) => {
  if (typeof value !== "string") return value;
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value);
  return !numeric && /^[\t\r\n ]*[=+@-]/.test(value) ? `'${value}` : value;
};

async function fetchCsv(url) {
  // Fetch one state's school table and validate its parsed schema. APIs may
  // serve CSV with non-text or missing content types, so the headers are not
  // a reliable way to identify the response format.
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Could not download data (${response.status})`);
  const text = await response.text();
  const rows = csvParse(text);
  if (rows.columns.length !== SCHOOL_COLUMNS.length ||
      rows.columns.some((column, index) => column !== SCHOOL_COLUMNS[index])) {
    throw new Error("The state API did not return a schools CSV.");
  }
  return rows;
}

async function createDownload({ zoomLevel, stateCode, countySlug, filename }) {
  const registryResponse = await fetch(withBase("data/stateRegistry.json"));
  if (!registryResponse.ok)
    throw new Error("Could not load the state API registry.");

  const registry = await registryResponse.json();
  // National downloads need every registered state; other views need only the
  // state currently selected in the dashboard.
  const codes =
    zoomLevel === "national" ? Object.keys(registry).sort() : [stateCode];

  // Fetch state files concurrently. Each result keeps its code alongside the
  // parsed rows so national output can identify each school's state.
  const stateRows = await Promise.all(
    codes.map(async (code) => {
      const entry = registry[code];
      const apiBase = typeof entry === "string" ? entry : entry?.base_url;
      if (!apiBase) throw new Error(`No data API is registered for ${code}.`);
      const rows = await fetchCsv(new URL("data/schools.csv", apiBase));
      return { code, rows };
    }),
  );

  let rows;
  let columns;
  if (zoomLevel === "national") {
    // Combine all schools tables and prepend a state identifier column.
    columns = ["state", ...stateRows[0].rows.columns];
    rows = stateRows.flatMap(({ code, rows: stateSchools }) =>
      stateSchools.map((row) => ({ state: code, ...row })),
    );
  } else {
    const [{ rows: schools }] = stateRows;
    if (zoomLevel === "county") {
      // Keep only the selected county. The county name is redundant in this
      // single-county file, so omit that column from its output.
      const countyRows = schools.filter(
        (row) => countyKey(row.county) === countyKey(countySlug),
      );
      rows = countyRows;
      columns = schools.columns.filter((column) => column !== "county");
    } else {
      // A state download is the API's full schools table without changes.
      rows = schools;
      columns = schools.columns;
    }
  }

  // Format the result in memory as a temporary object URL and click a hidden
  // browser link to start the download.
  const blobUrl = URL.createObjectURL(
    new Blob([
      csvFormat(
        rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              spreadsheetSafeValue(value),
            ]),
          ),
        ),
        columns,
      ) + "\n",
    ], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export default function DownloadButton({
  zoomLevel,
  stateCode,
  countySlug,
  countyName = null,
}) {
  // downloading prevents duplicate requests; error is shown and announced if
  // the registry or a state API cannot be reached.
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // filename controls the saved file name, while label is used for the button's
  // accessible name and title.
  let filename;
  let label;

  if (zoomLevel === "national") {
    filename = "all-schools.csv";
    label = "Download all schools (CSV)";
  } else if (zoomLevel === "state" && stateCode) {
    filename = `${stateCode}-schools.csv`;
    label = `Download ${stateCode.toUpperCase()} schools (CSV)`;
  } else if (zoomLevel === "county" && stateCode && countySlug) {
    filename = `${stateCode}-${countySlug}-schools.csv`;
    label = `Download ${countyName || countySlug.replace(/-/g, " ")} schools (CSV)`;
  }

  if (!filename) return null;

  const handleDownload = async () => {
    // Ignore repeated clicks until the current API fetch and download finish.
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      await createDownload({ zoomLevel, stateCode, countySlug, filename });
    } catch (downloadError) {
      setError(downloadError.message || "Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        id="download-data"
        className="hd-download"
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        title={label}
        aria-label={label}
        aria-busy={downloading}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="hd-download-label">
          {downloading ? "Preparing…" : "Data"}
        </span>
      </button>
      {error && (
        <div className="hd-download-error" role="alert">
          <p>{error}</p>
        </div>
      )}
    </>
  );
}
