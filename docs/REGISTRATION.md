# Registering a state repository

State repositories are registered from the ACCIDDA central dashboard
repository. Providers must supply both a source repository and a publicly
accessible HTTPS endpoint, or a source repository whose public GitHub Pages
endpoint can be derived. The source repository may be public or private. A
private repository must include a public endpoint.

The template repository is there to help produce the expected files and
host them. Providers must follow the template's repository structure, file
names, schema, and deployment layout.

## State-team submission

1. Open the central ACCIDDA measles dashboard and select **Actions**.
2. Select **Register State Data Endpoint**, then **Run workflow**.
3. Select the official two-letter USPS state code.
4. Enter the public HTTPS base URL for the template deployment, if one is
   available.
5. Enter the GitHub repository URL containing the template-based source data,
   if one is available. At least one of the endpoint URL or repository URL is
   required.
6. Wait for the workflow to validate the endpoint and open a pull request.

For a base URL of `https://example.org/measles/nc/`, the endpoint must expose:

```text
https://example.org/measles/nc/data/state.csv
https://example.org/measles/nc/data/counties.csv
https://example.org/measles/nc/data/schools.csv
```

The three CSV headers must match the pinned dashboard schema exactly. The
`state.csv` file must contain the requested state code, matching state FIPS,
state name, and at least one coverage measurement. County and school identity
values must link correctly, and all values must pass the same constraints used
by the dashboard CI. See [`measles-AA` validation
guidance](https://github.com/ACCIDDA/measles-AA/blob/main/docs/VALIDATION.md).

You can check the endpoint before submitting it in a browser, or with:

```bash
curl -fL https://example.org/measles/nc/data/state.csv
curl -fL https://example.org/measles/nc/data/counties.csv
curl -fL https://example.org/measles/nc/data/schools.csv
```

The workflow fetches those three URLs and validates that the deployment follows
the template's schema, values, state identity, county linkage, school linkage,
and coverage requirements. It does not execute code from the provider's source.
The repository, when supplied, must follow the template, but it does not need
to be public. A public repository can be submitted without `base_url`; the
workflow will validate its conventional GitHub Pages URL. A private repository
must be submitted with a public `base_url`, because its endpoint cannot be
derived or inspected through GitHub.
Because the dashboard fetches the endpoint from a browser, the endpoint must
also allow cross-origin requests from the dashboard site.

## Administrator review

The workflow creates a branch and a pull request that changes
`public/data/stateRegistry.json` and marks the state ready in
`public/data/states.json`. Review the repository URL, repository ID, dataset
path, source commit SHA, SHA-256 fingerprints, row counts, and automated validation results.
Existing CI checks must pass. Merge the PR only after confirming that the
repository's public data endpoint (`base_url`) is correct. The workflow never
merges its own PR.

The registry remains the dashboard's single source of truth. Existing string
entries are still supported; new entries include the repository ID, dataset
path, source commit, version, reporting period when supplied, and dashboard
base URL.

## Future data updates

The **Check State Data** workflow checks published endpoints every six hours,
including schema, map compatibility, browser access, and SHA-256 fingerprints
against the registered CSV contents. A failure opens one issue in the affected
state repository when the central reporting credential is configured.

After an intentional data update, rerun **Register State Repository** with the
same state code and repository URL. It validates the latest default-branch
bundle and opens a PR with refreshed fingerprints. An administrator must review
and merge that PR. A different repository ID cannot replace an existing state
through this workflow. Legacy Pages entries can also be re-registered to add
fingerprints and repository identity.

The public API must serve the registered CSV contents and a valid `meta.json`
from the registered dataset path. See [Data validation](DATA_VALIDATION.md) for
the full checks, central credential setup, legacy migration, and issue recovery.
