# Registering a state repository

ACCIDA state repositories are registered from the central dashboard repository.
State repositories must be public. State teams do not need to add a workflow,
secret, app credential, or private key to their repository.

## State-team submission

1. Open the central ACCIDA measles dashboard and select **Actions**.
2. Select **Register State Repository**, then **Run workflow**.
3. Enter the official two-letter USPS code (for example, `NC`) and the
   repository's HTTPS URL.
4. Wait for the workflow to validate the repository and open a pull request.

The repository must contain the prepared `measles-AA` bundle, either at the
repository root or under `data/`:

```text
states.csv
states/<state-code>.csv
states/<state-code>/schools.csv
```

The three CSV headers must match the pinned dashboard schema exactly. The state
row must contain the requested state code, matching state FIPS, state name, and
at least one coverage measurement. County and school identity values must link
correctly, and all values must pass the same constraints used by the dashboard
CI. See [`measles-AA` validation guidance](https://github.com/ACCIDDA/measles-AA/blob/main/docs/VALIDATION.md).

The workflow reads repository metadata and raw Git blobs at the default branch.
It rejects private repositories, records the immutable repository ID and source
commit SHA, and never copies the dataset into the dashboard repository.

Registration validation does not execute code from a source repository. It only
reads public repository metadata, the Git tree, and the three expected CSV
blobs. If the repository is private or inaccessible, make it public and rerun
the workflow.

## Administrator review

The workflow creates a branch and a pull request that changes
`public/data/stateRegistry.json` and marks the state ready in
`public/data/states.json`. Review the repository URL, repository ID, dataset
path, source commit SHA, row counts, and automated validation results.
Existing CI checks must pass. Merge the PR only after confirming that the
repository's public data endpoint (`base_url`) is correct. The workflow never
merges its own PR.

The registry remains the dashboard's single source of truth. Existing string
entries are still supported; new entries include the repository ID, dataset
path, source commit, version, reporting period when supplied, and dashboard
base URL.

## Future data updates

The immutable repository ID makes a later update workflow safe to add: it can
read the same registered repository, validate a newer commit against the same
schema, and open an update PR. A new state registration is not required.
