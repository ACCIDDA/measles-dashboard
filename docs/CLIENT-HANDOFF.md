# Client handoff plan

## What the client is receiving

The Measles Vaccination (MMR) Coverage Dashboard is a public website that
shows vaccination coverage at three levels:

1. A national map of available state data.
2. County-level coverage within a state.
3. K–5 school and grade-level details where those data are available.

The live demonstration is currently at
[accidda.github.io/measles-dashboard](https://accidda.github.io/measles-dashboard/).

## Technical description in plain language

This is a static web application. It has no application server, database,
login system, or server that the client must purchase and maintain.

- The interface is built with React, Vite, and D3.
- GitHub Pages hosts the built website.
- GitHub Actions builds and publishes the site when the production branch is
  updated.
- Data is delivered as public CSV files. The same files used by the dashboard
  can be downloaded by a browser or with `curl`; there is no API key.
- The site uses the `/measles-dashboard/` path on GitHub Pages.

The technical overview and data URL format are maintained in
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`API.md`](./API.md).

## Recommended client-controlled setup

The recommended final arrangement is an `ACCIDDA`-owned GitHub repository and
GitHub Pages site:

```text
https://github.com/ACCIDDA/measles-dashboard
https://accidda.github.io/measles-dashboard/
```

The client should control the ACCIDDA organization, its administrators, the
repository settings, and the GitHub Pages site. State repositories may remain
owned by their contributing organizations as long as they are public and
continue to publish the expected files. The dashboard reads those repositories
rather than copying their data into the dashboard repository.

### Transfer and launch checklist

A client administrator should complete these steps with the development team:

1. **Create or transfer the dashboard repository** to the client’s
   `ACCIDDA` organization. Preserve the repository history and the `main`
   branch.
2. **Enable GitHub Pages** for the dashboard repository using **GitHub Actions**
   as the source. The repository already contains a deployment workflow that
   installs Node 20, builds the site, and uploads the result to Pages.
3. **Merge and deploy the reviewed production branch.** The deployment workflow
   runs on pushes to `main`; it can also be started manually from the Actions
   page.
4. **Open the published URL** and verify the national map, North Carolina
   state view, county drill-down, school details, and the API page.

## How a developer can obtain and run the project

The client’s development team can work locally without a special server:

```sh
git clone https://github.com/ACCIDDA/measles-dashboard.git
cd measles-dashboard
nvm use                 # uses the Node version in .nvmrc (currently Node 20)
npm ci
npm run dev             # opens a local development site
```

Before merging a change, run the same checks used by the project:

```sh
npm run lint
npm test
npm run build
```

The build is the important launch check: it regenerates the data/API
artifacts, creates the production bundle, and is the same general operation
used by GitHub Actions. A pull request should be reviewed before it reaches
`main`.

## State data: how the pieces fit together

The repositories have separate responsibilities:

- [`measles-AA`](https://github.com/ACCIDDA/measles-AA) is the common template
  and preparation/validation path for state data.
- [`measles-NC`](https://github.com/cgbryan1/measles-NC) is the current public
  North Carolina data repository.
- [`measles-CA`](https://github.com/cgbryan1/measles-CA) is the current public
  California data repository.
The common bundle uses this structure:

```text
state.csv
counties.csv
schools.csv
```

The state code, state FIPS, state name, county/school identities, and coverage
columns must pass the shared schema. Missing measurements must remain blank;
they must not be changed to zero. The preparation example and validation
commands are documented in the
[`measles-AA` README](https://github.com/ACCIDDA/measles-AA#readme) and
[`VALIDATION.md`](https://github.com/ACCIDDA/measles-AA/blob/main/docs/VALIDATION.md).

### Registering a state repository

Once the dashboard’s state-registration workflow is part of the production
branch, a state maintainer can:

1. Open the dashboard repository’s **Actions** tab.
2. Choose **Register State Repository** and select **Run workflow**.
3. Enter the two-letter state code and the state repository’s HTTPS URL.
4. Wait for the workflow to validate the public repository and open a pull
   request.
5. Have a dashboard administrator review the repository URL, source commit,
   dataset path, row counts, and validation results.
6. Merge the pull request only after the public data endpoint is confirmed.

This workflow reads public metadata and CSV blobs; it does not execute code
from the state repository. The detailed procedure is in
[`REGISTRATION.md`](./REGISTRATION.md).

## Routine maintenance

### Updating existing state data

When a state publishes a new reporting period:

1. Obtain the approved source data and document its source and reporting
   period.
2. Place the raw inputs in the state repository’s local input area.
3. Run the `measles-AA` preparation and validation process.
4. Review row counts, state/county names, and a sample of coverage values.
5. Publish the prepared CSV bundle from the state repository.
6. Run the dashboard checks and verify the public URLs in a browser.

The current registration design records a source commit so reviewers can tell
which data version is being used. An automated “new data update” workflow is
described as future work, so updates currently require a maintainer’s review
and deployment rather than happening automatically.

### Adding another state

Use the same state-repository format, validate the bundle, and submit it
through the registration workflow. The dashboard’s state registry is intended
to be the single source of truth; adding a state should not require rewriting
the map or page components.

### Troubleshooting examples

- **The site is blank or a route returns 404:** check the GitHub Actions
  deployment run and confirm the Pages source is GitHub Actions. The deployment
  copies the app entry point to `404.html` so direct links can load.
- **A state is grey or has no county/school detail:** check that its registry
  entry and public `meta.json`/CSV URLs are reachable, and that the repository
  uses lowercase state paths and the required schema.
- **A build fails after a data change:** run the state validation first, then
  `npm run build`; do not publish synthetic example data from `measles-AA`.
- **A new data source is unavailable:** leave the measurement missing and
  explain the limitation. Do not infer a zero value.

## Cost and capacity expectations

For the expected public, static-site use:

- GitHub Pages and GitHub Actions are normally available at no additional
  charge for a public GitHub repository, subject to GitHub’s current quotas
  and policies.
- There is no application database, paid API, or always-on cloud server.
- A custom domain has an ordinary domain-registration cost if the client
  chooses one.
- Private repositories, private CI usage, unusually large traffic, or
  additional GitHub storage may incur GitHub charges under the client’s plan.
- The main ongoing cost is staff time: reviewing source data, running
  validation, responding to broken public data links, and maintaining
  dependencies.

If usage grows substantially, the client should monitor GitHub Pages bandwidth
and Actions usage. The static build can be moved to another static host later,
but that would be a hosting migration rather than a change to the application
itself.

## Client decisions required before final acceptance

The client and development team should document these decisions in the
handoff meeting:

- Which ACCIDDA organization administrators own GitHub, Pages, and any domain?
- What is the authoritative `measles-ca` repository URL and who maintains it?
- Should California be listed as available now, or remain disabled until its
  repository passes registration validation?
- Who approves a new reporting period and who reviews the resulting pull
  request?
- What reporting period and data freshness target should the public site show?
- Is a custom domain required, or is the GitHub Pages URL acceptable?
- Who receives alerts when a GitHub Actions build or public data endpoint
  fails?

## Evidence used for this plan

This plan reflects the most recent accessible project materials:

- Dashboard deployment workflow in
  [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).
- Dashboard setup and live URL in [`README.md`](../README.md).
- State registration procedure in [`REGISTRATION.md`](./REGISTRATION.md).
- Shared state preparation guidance in
  [`measles-AA/README.md`](https://github.com/ACCIDDA/measles-AA/blob/main/README.md).
- North Carolina repository history at
  [`measles-NC`](https://github.com/cgbryan1/measles-NC).
- Latest dashboard registration work:
  [registration commit](https://github.com/kgbrown5/measles-dashboard/commit/38d50edb0ee574bb502e5f2f95cf85d87ada954c)
  and the subsequent
  [revert on `dev`](https://github.com/kgbrown5/measles-dashboard/commit/e0673fff535c36a6cb0163152ef123693de591c4).

The ownership, California URL, data-freshness target, and custom-domain
choices above are client decisions, not assumptions that should be silently
filled in by the development team.
