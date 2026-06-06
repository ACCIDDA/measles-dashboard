<!-- Thanks for the PR! Keep the summary short; delete sections that don't apply. -->

## Summary

<!-- What does this change and why? Link the issue: "Closes #123". -->

## Checklist

- [ ] `npm run lint` — zero errors/warnings
- [ ] `npm test` — unit suite green
- [ ] `npm run build && npm run test:e2e` — e2e green locally (macOS, snapshots included), if UI changed
- [ ] Visual snapshots regenerated and committed, if styling/layout changed

---

<!-- ▼▼▼ DELETE this whole block unless you are contributing a state's data (#78). ▼▼▼ -->
## Adding a state's data?

See **[Contributing a state's data](../blob/dev/CONTRIBUTING.md#contributing-a-states-data)**. The CSVs are validated against the published schema in CI, so:

- [ ] `npm run validate-data` passes locally (same check CI runs)
- [ ] Committed the source files: `public/data/states/<code>/schools.csv`, `public/data/states/<code>.csv`, and the row in `public/data/states.csv`
- [ ] Registered the state: `npm run register-state -- <code>` (flips `public/data/states.json` to `ready` after validating)
- [ ] Added the `<code>` attribution entry (source link) to `STATES` in `src/config/states.js`
- [ ] Did **not** commit generated artifacts (`public/data/all-schools.csv`, `public/data/states/*/counties/`, `public/data/schema.json` — all gitignored)
- [ ] Source + license noted in the linked "Contribute a state's data" issue
<!-- ▲▲▲ end state-data block ▲▲▲ -->
