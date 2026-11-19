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

Each state’s data lives in its own public `measles-AA` repository (where AA is the corresponding 
state code). A state repository supplies `state.csv`, `counties.csv`, and `schools.csv` at its root
or under `data/`; these files must match the dashboard’s validated schema.
The dashboard reads data from the registered state repository’s public data
endpoint when that state is selected.

To add a state, a contributor runs the **Register State Repository** GitHub
Action with the state code and repository URL. The workflow validates the
repository and opens a pull request to update the central registry and mark the
state ready. An administrator then reviews and merges that pull request; the data
itself stays in the state repository. See
[`docs/REGISTRATION.md`](docs/REGISTRATION.md) for the submission requirements
and review steps.

## Tech

Single-page [Vite](https://vitejs.dev) + [React 18](https://react.dev) app.
Page chrome is React; the interactive map is [D3](https://d3js.org) over
[us-atlas](https://github.com/topojson/us-atlas) TopoJSON. Deployed as a static
site on GitHub Pages under the `/measles-dashboard/` base path.

How it all fits together is documented in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

State repositories are registered centrally through GitHub Actions. See
[`docs/REGISTRATION.md`](docs/REGISTRATION.md) for the submission format,
public repository requirement, and administrator review process.

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
`npm install`, and the pre-commit hook runs lint + tests. Adding a new state
needs a data API and registration, not code changes.
