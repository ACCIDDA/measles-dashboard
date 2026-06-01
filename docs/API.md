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
| `/data/states/{state}/schools.csv` | one row per school in that state |
| `/data/states/{state}/counties/{county}.csv` | one row per school in that county |

`{state}/schools.csv` and the per-`{county}` files carry the same school rows;
the per-county files are a convenience split. The dashboard itself loads
`{state}.csv` + `{state}/schools.csv`.

## Slug conventions

- `{state}`: lowercase two-letter USPS abbreviation (`nc`, `ca`).
- `{county}`: county name lowercased and kebab-cased (`los-angeles`,
  `new-hanover`). Spaces and punctuation become single hyphens.

## Columns

Every file shares the same coverage block; the files differ only in their
leading identity columns. Coverage values are **proportions in [0, 1]** (e.g.
`0.9469` = 94.69%), rounded to 4 decimals. Grades `K`–`5` correspond to the
model's age bands; `K` is kindergarten.

### Identity columns (per file)

| File | Leading columns |
| --- | --- |
| `states.csv` | `state`, `state_fips`, `state_name`, `n_schools`, `pct_schools_below_95` |
| `{state}.csv` | `county`, `county_fips`, `n_schools`, `pct_schools_below_95` |
| `{state}/schools.csv` | `school_id`, `school_name`, `county`, `enrollment` |
| `{state}/counties/{county}.csv` | `school_id`, `school_name`, `enrollment` |

### Shared coverage block (all files)

| Column | Type | Description |
| --- | --- | --- |
| `coverage` | number | Overall MMR coverage (proportion, 0–1) |
| `coverage_ci_low` / `coverage_ci_high` | number | 95% credible interval for `coverage` |
| `coverage_K` … `coverage_5` | number | Per-grade coverage (K through 5th grade) |
| `coverage_ci_low_K` … `_5` | number | Per-grade CI lower bounds |
| `coverage_ci_high_K` … `_5` | number | Per-grade CI upper bounds |
| `prob_below_95` | number | Posterior probability that coverage is below 95% |
| `tier` | string | Coverage tier: `H` (≥95%), `M` (90–95%), `L` (<90%) |

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

Load straight into pandas:

```python
import pandas as pd

url = "https://accidda.github.io/measles-dashboard/data/states/ca/schools.csv"
df = pd.read_csv(url)
```

## Versioning

There is no explicit versioning today. The CSVs are regenerated and republished
when the underlying model output updates, so the data reflects whatever the
dashboard is currently showing. For a stable snapshot, pin to a specific Git
commit via `raw.githubusercontent.com` against the `main` branch, or open an
issue if versioned releases would be useful.
