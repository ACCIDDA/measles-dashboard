# State data API

## Overview

The dashboard loads coverage data from the public state APIs listed in
`public/data/stateRegistry.json`. Dataset CSVs stay with their providers; the
dashboard repository and its deployed site contain no CSV datasets.

The dashboard publishes its registry, readiness manifest, and generated schema:

| Dashboard path | Purpose |
| --- | --- |
| `/data/stateRegistry.json` | State codes mapped to public API locations and registration metadata |
| `/data/states.json` | State readiness (`ready` or `coming_soon`) |
| `/data/schema.json` | Column definitions and value constraints |

These paths are relative to the dashboard deployment, currently
`https://accidda.github.io/measles-dashboard/`.

## State endpoints

For a registered `base_url`, new registrations use the template's `data/`
directory. Existing registry objects may specify `dataset_path: "."` for files
at the base URL; legacy string entries use `data/`.

| State API resource | Contents | Schema key |
| --- | --- | --- |
| `data/state.csv` | Exactly one state summary | `data/states.csv` |
| `data/counties.csv` | County summaries for that state | `data/states/{state}.csv` |
| `data/schools.csv` | Schools with county labels | `data/states/{state}/schools.csv` |
| `data/meta.json` | Display names, state code/FIPS, and source attribution | JSON metadata |

The API endpoints must be publicly accessible over HTTPS and permit browser
requests from the dashboard's origin. Registration and recurring monitoring
check the CSVs against the shared schema. The monitor also checks metadata,
CORS access, and county geography links.

## Downloads

The Data button fetches the current state APIs and formats the requested CSV in
the browser:

- National: combines registered states' school rows with a leading `state`
  column and saves `all-schools.csv`.
- State: saves that state's school rows as `<state>-schools.csv`.
- County: filters the school's county label, drops the redundant `county`
  column, and saves `<state>-<county>-schools.csv`.

These filenames are browser downloads, not static dashboard endpoints. String
cells that could be interpreted as spreadsheet formulas are prefixed with an
apostrophe in downloads; numeric values are preserved.

## Columns

Coverage values are proportions in `[0, 1]`, such as `0.9469` for 94.69%.
Grades K–5 are kindergarten through fifth grade. Blank optional measurements
mean unavailable, not zero. State FIPS may have one or two digits; county FIPS,
when supplied, has five digits. School IDs and county links are required;
school names may be blank, in which case the dashboard displays the school ID.

### Identity columns by schema key

The machine-readable schema retains its original keys for compatibility.
They identify column shapes, **not URLs on the dashboard**. The state endpoint
mapping is above; `data/all-schools.csv` and
`data/states/{state}/counties/{county}.csv` describe browser download shapes.

The tables below are generated from `src/data/schema.js` using
`npm run gen-api-schema`. Every identity block is followed by the shared
coverage block.

<!-- BEGIN GENERATED: identity -->
| Schema key (without data/) | Leading columns (then the shared coverage block) |
| --- | --- |
| `states.csv` | `state`, `state_fips`, `state_name`, `n_schools`, `pct_schools_below_95` |
| `states/{state}.csv` | `county`, `county_fips`, `n_schools`, `pct_schools_below_95` |
| `all-schools.csv` | `state`, `school_id`, `school_name`, `county`, `enrollment`, `lon`, `lat`, `no_data` |
| `states/{state}/schools.csv` | `school_id`, `school_name`, `county`, `enrollment`, `lon`, `lat`, `no_data` |
| `states/{state}/counties/{county}.csv` | `school_id`, `school_name`, `enrollment`, `lon`, `lat`, `no_data` |
<!-- END GENERATED: identity -->

### Shared coverage block (all files)

<!-- BEGIN GENERATED: coverage -->
| Column | Type | Description |
| --- | --- | --- |
| `coverage` | number | Overall MMR coverage (proportion, 0-1) |
| `coverage_ci_low` | number | Lower bound, 95% credible interval for coverage |
| `coverage_ci_high` | number | Upper bound, 95% credible interval for coverage |
| `coverage_K` | number | Per-grade coverage (grade K) |
| `coverage_1` | number | Per-grade coverage (grade 1) |
| `coverage_2` | number | Per-grade coverage (grade 2) |
| `coverage_3` | number | Per-grade coverage (grade 3) |
| `coverage_4` | number | Per-grade coverage (grade 4) |
| `coverage_5` | number | Per-grade coverage (grade 5) |
| `coverage_ci_low_K` | number | Per-grade CI lower bound (grade K) |
| `coverage_ci_low_1` | number | Per-grade CI lower bound (grade 1) |
| `coverage_ci_low_2` | number | Per-grade CI lower bound (grade 2) |
| `coverage_ci_low_3` | number | Per-grade CI lower bound (grade 3) |
| `coverage_ci_low_4` | number | Per-grade CI lower bound (grade 4) |
| `coverage_ci_low_5` | number | Per-grade CI lower bound (grade 5) |
| `coverage_ci_high_K` | number | Per-grade CI upper bound (grade K) |
| `coverage_ci_high_1` | number | Per-grade CI upper bound (grade 1) |
| `coverage_ci_high_2` | number | Per-grade CI upper bound (grade 2) |
| `coverage_ci_high_3` | number | Per-grade CI upper bound (grade 3) |
| `coverage_ci_high_4` | number | Per-grade CI upper bound (grade 4) |
| `coverage_ci_high_5` | number | Per-grade CI upper bound (grade 5) |
| `prob_below_95` | number | Posterior probability that coverage is below 95% |
| `tier` | string | Coverage tier: H (>=95%), M (90-95%), L (<90%) |
<!-- END GENERATED: coverage -->

## Machine-readable schema

Fetch the dashboard's `/data/schema.json` and select the appropriate `files`
entry from the mapping above. Each column supplies a name, type (`string`,
`integer`, or `number`), and optional constraints. Parsing a file with those
types is separate from validating its ranges, IDs, and cross-file links.

## Examples

Discover a registered state endpoint and fetch its school rows with Python:

```python
import csv
import io
import json
from urllib.request import urlopen
from urllib.parse import urljoin

DASHBOARD = "https://accidda.github.io/measles-dashboard/"
with urlopen(urljoin(DASHBOARD, "data/stateRegistry.json")) as response:
    registry = json.load(response)

entry = registry["nc"]
base = entry if isinstance(entry, str) else entry["base_url"]
path = "data/" if isinstance(entry, str) else (entry.get("dataset_path") or "data/")
path = "" if path == "." else path.rstrip("/") + "/"
schools_url = urljoin(base.rstrip("/") + "/", path + "schools.csv")
with urlopen(schools_url) as response:
    schools = list(csv.DictReader(io.StringIO(response.read().decode("utf-8"))))
print(len(schools))
```

For a template endpoint, substitute its registered deployment URL below:

```sh
BASE="https://example.org/measles/nc"
curl -fL "$BASE/data/state.csv" -o state.csv
curl -fL "$BASE/data/counties.csv" -o counties.csv
curl -fL "$BASE/data/schools.csv" -o schools.csv
```

Save downloaded datasets outside this dashboard's `public/` directory. Both
`npm run dev` and `npm run build` reject local CSVs there to prevent stale data
from being published with the site.

## Versioning and validation

Live endpoints can change independently of a dashboard deployment. Registration
stores SHA-256 hashes of the three validated CSV responses in the registry.
Recurring checks validate the contents and compare them to that approved
baseline; intentional changes require another reviewed registration PR.

An optional `source_commit_sha` records source provenance, but does not prove
that a live deployment corresponds to that commit. Legacy entries without
hashes still receive schema checks and need re-registration to enable content
change detection. Hashes establish integrity, not scientific correctness or
freshness. See the repository's `docs/REGISTRATION.md` and
`docs/DATA_VALIDATION.md` for the workflow and notification setup.
