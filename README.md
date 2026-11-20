# Measles Vaccination (MMR) Coverage Dashboard

An interactive dashboard visualizing measles (MMR) vaccination coverage across
the United States, drilling down from a national overview to individual states,
counties, and K–5 schools. Built by [ACCIDDA](https://github.com/ACCIDDA).

🔗 **Live:** https://accidda.github.io/measles-dashboard/

## What it shows

- **National view**: every US state shaded by its overall coverage; states
  without data yet render greyed.
- **State view**: click a state to zoom into its counties, each colored by
  coverage tier (high / medium / low) or by an under-vaccination lens.
- **County view**: drill into a county to see its individual K–5 schools,
  each with a per-grade coverage breakdown.

Coverage estimates come from the [imuGAP](https://github.com/ACCIDDA/imuGAP)
Bayesian model; school and county geography come from public sources.

## Data

Each state's coverage data lives at its registered public HTTPS API. A template
endpoint supplies `data/state.csv`, `data/counties.csv`, `data/schools.csv`, and
`data/meta.json`. The dashboard fetches those resources directly and creates
CSV downloads in the browser; it stores no dataset CSVs in this repository.

To add or update a state, run the **Register State Repository** GitHub Action
with the state code and public endpoint or repository URL. It validates the
CSV responses, records their SHA-256 hashes, and opens a registry pull request
for administrator review. See [`docs/REGISTRATION.md`](docs/REGISTRATION.md)
for submission requirements and [`docs/API.md`](docs/API.md) for endpoint and
column details.

## Tech

Single-page [Vite](https://vitejs.dev) + [React 18](https://react.dev) app.
Page chrome is React; the interactive map is [D3](https://d3js.org) over
[us-atlas](https://github.com/topojson/us-atlas) TopoJSON. Deployed as a static
site on GitHub Pages under the `/measles-dashboard/` base path.

How it all fits together is documented in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

State repositories are registered centrally through GitHub Actions. See
[`docs/REGISTRATION.md`](docs/REGISTRATION.md) for the submission format,
public endpoint requirements and administrator review process.
[Data validation](docs/DATA_VALIDATION.md) describes recurring API checks,
registered SHA-256 fingerprints, and automated issues for failing states.

## Quick start

Built and tested against **Node 20** (pinned in [`.nvmrc`](./.nvmrc); what CI
runs). Run `nvm use` to match it.

```sh
nvm use
npm install
npm run dev        # http://localhost:5173
```

Full command list and the contributor workflow are in
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). In short: `nvm use` (Node 20),
`npm install`, and the pre-commit hook lints staged source files. Adding a new state
needs a data API and registration, not code changes.
