# Phase 0 patch release gate

Candidate version: v4.0.9

The candidate is release-ready only when `npm run validate:phase0` succeeds from a clean dependency
installation. That command verifies:

1. every baseline hash lock plus the immutable-baseline change policy;
2. TypeScript type checking;
3. lint with zero errors, no new warning category, and no more than the approved 14-warning
   baseline;
4. the full Jest suite (preventing pass-with-no-tests smoke false positives);
5. all existing framework, configuration, end-to-end, and integration tests;
6. dual-path characterization against the recorded report;
7. the machine-readable reject/strip/sandbox matrix across public and integration entry points;
8. a clean build, `npm pack`, tarball inspection, installation into a clean consumer, binary
   execution, ESM/subpath imports, declarations, shebang, and a real component build; and
9. a package allowlist enforcing the recorded v4.0.9 file-count and packed-size baseline with a
   maximum 5% unapproved growth tolerance, the exact reviewed 606-asset public corpus, and no
   internal baseline/report/test/source/source-map/archive content. Exact values are retained in the
   package-conformance evidence and executable gate.

The release record must additionally link:

- `baselines/v4.0.x/baseline.lock.json`;
- `compatibility/dual-path-diff-v4.0.8.json`;
- `compatibility-ledger-v4.1.md`;
- `docs/phase0-migration-notice.md`;
- `docs/phase0-rollback-plan.md`;
- `reports/package-conformance-v4.0.9.json`;
- `reports/phase0-entrypoint-safety-matrix.json`.

Before release, an auditable clean checkout must run:

```sh
git clean -xfd
npm ci
npm run validate:phase0
npm run package:conformance
npm pack
```

`git clean -xfd` must never be run over an uncommitted implementation worktree. Perform this step
only after the candidate commits exist, in a disposable checkout. Install the resulting archive in a
completely separate directory and retain the smoke evidence.

Required sign-offs are baseline approval, security containment review, row-level Compatibility
Ledger approval, and release gate approval. Existing sealed baselines cannot be edited. A future
baseline is added only with `npm run baseline:update -- --target <version> --reason "..."`, the
`baseline-update-approved` pull-request label, and CODEOWNERS review.

Publishing to npm and creating the release tag are deliberate maintainer actions after this local
gate. They are not performed by the validation command.
