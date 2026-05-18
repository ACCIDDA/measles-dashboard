# Static dataset API

## Overview

All dashboard data is published as static CSV files at predictable URLs on the
deployed site. You can fetch them with `curl`, `wget`, a browser, or any HTTP
client — there is no authentication, no API key, and no rate limit beyond
whatever GitHub Pages applies to public traffic. The URL scheme *is* the API:
the same files that power the in-app download buttons are what you get when you
fetch them directly.

The deployment base path is `/measles-dashboard/`, so every dataset path below
is suffixed onto `https://accidda.github.io/measles-dashboard/`.

Currently only North Carolina (`nc`) has data published. Additional states will
be added incrementally as their source data lands; the URL scheme is stable.

## URL scheme

| Path | Description |
| --- | --- |
| `/data/states/{state}.csv` | County-aggregated coverage for one state |
| `/data/states/{state}/counties/{county}.csv` | School-level breakdown for one county |

`{state}` and `{county}` are slugs (see below).

## Slug conventions

- Lowercase ASCII.
- Words separated by hyphens (kebab-case).
- No punctuation other than the hyphen.

Examples:

- North Carolina → `nc`
- New Hanover County → `new-hanover`
- Los Angeles County → `los-angeles`

State slugs use the standard two-letter USPS abbreviation in lowercase. County
slugs drop the word "County" and kebab-case the remaining name.

## CSV columns

> The columns below describe the *intended* output of the build-time CSV
> generator. The exact column set may evolve slightly as the generator lands and
> additional states are onboarded; this document will be updated to match.

### State CSV — `/data/states/{state}.csv`

One row per county in the state.

| Column | Type | Description |
| --- | --- | --- |
| `county` | string | County name as it appears in the source data |
| `coverage` | number | MMR vaccination coverage for the county, as a percentage (0–100) |
| `cov_low` | number | Lower bound of the coverage estimate (percentage) |
| `cov_high` | number | Upper bound of the coverage estimate (percentage) |
| `herd_immunity` | integer | Herd-immunity indicator value from the source dataset |

### County CSV — `/data/states/{state}/counties/{county}.csv`

One row per school in the county.

| Column | Type | Description |
| --- | --- | --- |
| `school` | string | School name |
| `coverage` | number | Overall MMR coverage for the school (percentage) |
| `size` | integer | Reported student count used to compute coverage |
| `coverage_5_6` | number \| `-` | Coverage for the 5–6 age band, as a percentage; `-` if not reported |
| `coverage_6_7` | number \| `-` | Coverage for the 6–7 age band |
| `coverage_7_8` | number \| `-` | Coverage for the 7–8 age band |
| `coverage_8_9` | number \| `-` | Coverage for the 8–9 age band |
| `coverage_9_10` | number \| `-` | Coverage for the 9–10 age band |
| `coverage_10_11` | number \| `-` | Coverage for the 10–11 age band |
| `estimated_5_6` | boolean | `true` if the 5–6 band's value is an estimate rather than reported |
| `estimated_6_7` | boolean | `true` if the 6–7 band's value is an estimate |
| `estimated_7_8` | boolean | `true` if the 7–8 band's value is an estimate |
| `estimated_8_9` | boolean | `true` if the 8–9 band's value is an estimate |
| `estimated_9_10` | boolean | `true` if the 9–10 band's value is an estimate |
| `estimated_10_11` | boolean | `true` if the 10–11 band's value is an estimate |

Risk classifications (`hirisk` / `mdrisk` / `lorisk`) in the source data are
derived from the coverage percentage and are not included as separate columns;
consumers can recompute them from `coverage_*` if needed.

## Examples

Fetch the county-aggregated CSV for North Carolina:

```sh
curl -O https://accidda.github.io/measles-dashboard/data/states/nc.csv
```

Fetch the school-level breakdown for Wake County, NC:

```sh
curl -O https://accidda.github.io/measles-dashboard/data/states/nc/counties/wake.csv
```

Pipe directly into another tool, for example to preview the first few rows with
`head`:

```sh
curl -s https://accidda.github.io/measles-dashboard/data/states/nc.csv | head
```

Or load straight into pandas:

```python
import pandas as pd

url = "https://accidda.github.io/measles-dashboard/data/states/nc.csv"
df = pd.read_csv(url)
```

## Versioning

There is no explicit versioning today. The CSVs are regenerated and republished
on every deploy to GitHub Pages, so the data reflects whatever the dashboard
itself is currently showing. If a stable historical snapshot is needed, consider
pinning to a specific Git commit via `raw.githubusercontent.com` against the
`dev` or `main` branch — or open an issue if explicit versioned releases would
be useful.
