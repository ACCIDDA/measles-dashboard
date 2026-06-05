# Static dataset API

## Overview

All dashboard data is published as static CSV files at predictable URLs on the
deployed site. You can fetch them with `curl`, `wget`, a browser, or any HTTP
client: there is no authentication, no API key, and no rate limit beyond
whatever GitHub Pages applies to public traffic. The URL scheme *is* the API,
the same files that drive the dashboard are what you get when you fetch them.

The deployment base path is `/measles-dashboard/`, so every dataset path below
is suffixed onto `https://accidda.github.io/measles-dashboard/`.

States with data published: North Carolina (`nc`) and California (`ca`). More
states are added incrementally; the URL scheme is stable.

## URL scheme

| Path | Row granularity |
| --- | --- |
| `/data/states.csv` | one row per state (national summary) |
| `/data/states/{state}.csv` | one row per county in that state |
| `/data/all-schools.csv` | one row per school, every state (leading `state` column) |
| `/data/states/{state}/schools.csv` | one row per school in that state |
| `/data/states/{state}/counties/{county}.csv` | one row per school in that county |

`all-schools.csv`, `{state}/schools.csv`, and the per-`{county}` files carry the
same school rows at decreasing scope; `all-schools.csv` adds a leading `state`
column so the concatenated rows stay identifiable. The dashboard itself loads
`{state}.csv` + `{state}/schools.csv`. The in-app download button hands back the
school CSV for the current zoom (national → `all-schools.csv`, state →
`{state}/schools.csv`, county → the per-county file).

## Slug conventions

- `{state}`: lowercase two-letter USPS abbreviation (`nc`, `ca`).
- `{county}`: county name lowercased and kebab-cased (`los-angeles`,
  `new-hanover`). Spaces and punctuation become single hyphens.

## Columns

Every file shares the same coverage block; the files differ only in their
leading identity columns. Coverage values are **proportions in [0, 1]** (e.g.
`0.9469` = 94.69%), rounded to 4 decimals. Grades `K`–`5` correspond to the
model's age bands; `K` is kindergarten.

> The tables below are generated from `src/data/schema.js` (the single source of
> truth) by `npm run gen-api-schema`. The same definition produces the
> machine-readable [`data/schema.json`](#machine-readable-schema). Edit the
> schema module, not these tables.

### Identity columns (per file)

Each file's leading columns; every file then carries the shared coverage block.

<!-- BEGIN GENERATED: identity -->
| File | Leading columns (then the shared coverage block) |
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

Identity-column meanings: `*_fips` are the 2- and 5-digit FIPS codes;
`n_schools` is the school count aggregated into that row; `pct_schools_below_95`
is the share of the level's schools under 95% coverage; `enrollment` is the
school's student count.

### A note on data completeness

Coverage values come from the imuGAP model. Where a state's data is supplied
pre-aggregated rather than as a full model fit, the aggregate (state/county)
rows may have **blank** per-grade and credible-interval columns (only the
overall `coverage` is populated). North Carolina is currently in this category;
California, fit directly, has the full block at every level. Treat empty cells
as "not available," not zero.

## Machine-readable schema

The full column schema is published as
[`data/schema.json`](https://accidda.github.io/measles-dashboard/data/schema.json)
— one entry per file shape, each listing its columns with a `type` (`string`,
`integer`, or `number`). It is generated from the same source as the tables
above, so it always matches the data.

Fetch the schema and use it to read a file with guaranteed types (no inference)
via Apache Arrow:

```python
import json, urllib.request
import pyarrow as pa, pyarrow.csv as pv

BASE = "https://accidda.github.io/measles-dashboard/data"
spec = json.load(urllib.request.urlopen(f"{BASE}/schema.json"))

# Map the schema's type vocabulary to Arrow types.
ARROW = {"string": pa.string(), "integer": pa.int64(), "number": pa.float64()}
cols = spec["files"]["data/all-schools.csv"]["columns"]
types = {c["name"]: ARROW[c["type"]] for c in cols}

import fsspec
with fsspec.filesystem("https").open(f"{BASE}/all-schools.csv") as f:
    table = pv.read_csv(f, convert_options=pv.ConvertOptions(column_types=types))
```

The same `schema.json` drives readers in R (`arrow`), DuckDB, Polars, etc.

## Examples

Fetch the national state summary:

```sh
curl -O https://accidda.github.io/measles-dashboard/data/states.csv
```

Fetch California's county-level coverage:

```sh
curl -O https://accidda.github.io/measles-dashboard/data/states/ca.csv
```

Fetch the school-level breakdown for Los Angeles County:

```sh
curl -O https://accidda.github.io/measles-dashboard/data/states/ca/counties/los-angeles.csv
```

Preview the first rows without saving:

```sh
curl -s https://accidda.github.io/measles-dashboard/data/states/ca.csv | head
```

Fetch every school nationwide in one file:

```sh
curl -O https://accidda.github.io/measles-dashboard/data/all-schools.csv
```

Load straight into pandas:

```python
import pandas as pd

url = "https://accidda.github.io/measles-dashboard/data/states/ca/schools.csv"
df = pd.read_csv(url)
```

The files double as a static data API: any tool that reads a CSV from a URL can
pull them directly, no download step. With Apache Arrow:

```python
# Python — pyarrow streams the URL straight into an Arrow table
import pyarrow.csv as pv
from fsspec.implementations.http import HTTPFileSystem

fs = HTTPFileSystem()
with fs.open("https://accidda.github.io/measles-dashboard/data/all-schools.csv") as f:
    table = pv.read_csv(f)
```

```r
# R
schools <- arrow::read_csv_arrow(
  "https://accidda.github.io/measles-dashboard/data/all-schools.csv"
)
```

```sql
-- DuckDB
SELECT county, coverage
FROM 'https://accidda.github.io/measles-dashboard/data/all-schools.csv'
WHERE state = 'ca';
```

## Versioning

There is no explicit versioning today. The CSVs are regenerated and republished
when the underlying model output updates, so the data reflects whatever the
dashboard is currently showing. For a stable snapshot, pin to a specific Git
commit via `raw.githubusercontent.com` against the `main` branch, or open an
issue if versioned releases would be useful.
