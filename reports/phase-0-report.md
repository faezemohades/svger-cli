# Phase 0 implementation report

Directive: SVGER-REF-2026-07-17-FINAL

Candidate: v4.0.9

Candidate source commit: `3fbf14b12763c3bd6849877c9d5609477b1c7a37`

Date: 2026-07-17

Implementation status: **complete**

Local release readiness: **passed**

Official Phase 0 release gate: **pending**

Publication status: **not published**

Phase 1 authorization: **not granted**

## Outputs by issue

### SVGER-P0-001 — Behavioral baseline

Created and sealed `baselines/v4.0.x/` from v4.0.8 commit `0d48aff`. The archive contains canonical
fixtures and recorded outputs, CLI behavior, resolved configuration and schema, public/integration
exports, a performance trace, dual-path observations, and `baseline.lock.json`. The verifier passes
for all 14 locked files and rejects changed, missing, or unexpected files.

CI additionally rejects any edit, deletion, or rename in a sealed directory. New baselines require
the official reason-bearing `baseline:update` command, the `baseline-update-approved` pull-request
label, and CODEOWNERS review. The initial Phase 0 capture records its provenance and reason in its
lock.

### SVGER-P0-002 — Dual-path characterization

Added `tests/phase0/dual-path-characterization.mjs` and the checked-in report
`compatibility/dual-path-diff-v4.0.8.json`.

Recorded result:

- both paths resolve successfully for the canonical corpus;
- `Basic.tsx` and `Styled.tsx` have identical names, bytes, and SHA-256 hashes;
- diagnostics differ in presentation and detail;
- `SVGService` alone creates `index.ts`.

### SVGER-P0-003 — Compatibility ledger

Created `compatibility-ledger-v4.1.md` with 12 classified behaviors using only `preserve`,
`deprecate`, `intentionally-break`, and `auto-migrate`. Every row records the observed divergence,
selected behavior, breaking-change assessment, rationale, user impact, migration, deprecation
timeline, contract test, and approver.

The ledger is intentionally marked **Pending maintainer approval**. The directive forbids Phase 1
merge before that approval.

### SVGER-P0-004 — Immediate sanitization gate

Added the temporary raw-input gate in `src/security/input-safety.ts` and wired it into the CLI,
legacy builder, `SVGService`, direct processor APIs, watch and optimize flows, Webpack
plugin/loader, Vite, Rollup, Babel, Next.js, and Jest.

- Reject is the default.
- Script elements, event handler attributes, and JavaScript URI values fail with
  `E_UNSAFE_SVG_CONTENT`.
- Explicit strip policy is available by API option or `--unsafe-input-policy strip` and always
  warns.
- The warning and documentation identify stripping as temporary and incomplete.
- Jest safety failures run before mock/fallback behavior.
- CLI optimize now exits nonzero when any file is rejected, including unsafe input and output
  sandbox violations.

The core containment suite passes 26 assertions. A separate executable entry-point matrix records
reject, strip, and sandbox results for CLI build/generate/optimize, direct processor, legacy
builder, `SVGService`, Vite, Rollup, Webpack, Babel, Jest, and the Next.js delegation contract. All
applicable cells pass; Jest sandboxing is not applicable because its transformer performs no
filesystem writes. Long-running watch lifecycle orchestration is explicitly scoped as a delegated
contract in `reports/phase0-entrypoint-safety-matrix.md`.

### SVGER-P0-005 — Filesystem and input boundaries

- Added a configurable 10 MiB default limit with `E_SVG_INPUT_TOO_LARGE`.
- Added `--max-input-size <bytes>` and matching API/integration options.
- All generated component and index writes resolve through an output-root guard.
- Lexical escapes, physical-parent escapes, and existing symlink artifact destinations fail with
  `E_OUTPUT_PATH_ESCAPE`.

### SVGER-P0-006 — Patch release gate

Prepared v4.0.9 metadata, changelog, migration notice, security policy, exact release-gate
definition, and rollback plan. The package smoke test also detected and fixed installed-layout
version lookup before the final gate passed.

`npm run validate:phase0` final result: **PASS**.

| Gate                           | Result                                                   |
| ------------------------------ | -------------------------------------------------------- |
| Baseline verification/policy   | 14/14 locked files verified; policy pass                 |
| TypeScript                     | Pass                                                     |
| ESLint budget                  | 0 errors; 14/14 approved warnings; one approved category |
| Jest                           | 10 suites, 155/155 tests passed                          |
| Framework standalone suite     | 11/11 passed                                             |
| Configuration standalone suite | 10/10 passed                                             |
| End-to-end standalone suite    | 8/8 passed                                               |
| Integration verification       | 7/7 passed                                               |
| Dual-path characterization     | Pass                                                     |
| Security containment           | 26 core assertions plus entry-point matrix passed        |
| Package consumer smoke         | Pass; 757 files, 616,991 bytes                           |
| Package conformance            | Pass; 606 intentional assets; forbidden content absent   |
| Production dependency audit    | 0 vulnerabilities                                        |
| Diff whitespace check          | Pass                                                     |
| Version consistency            | package and lock metadata all v4.0.9                     |

The tarball smoke validates inspection, clean installation, executable binary, root and subpath ESM
imports, runtime/config version, declarations, shebang, and a real component build. Package content
was reduced from 794 to 757 entries by excluding compiled fixtures and internal documentation. The
full `npm pack --dry-run` and `tar -tf` evidence is archived in
`reports/package-conformance-v4.0.9.json`.

## Gate decision

The Phase 0 implementation is complete and locally release-ready for v4.0.9. The official Phase 0
gate is not closed. No commit, npm publication, Git tag, GitHub release, push, merge, or formal
approval was performed. Clean-checkout verification is also pending until the implementation is in
auditable commits; running `git clean -xfd` in the current uncommitted worktree would destroy the
candidate.

Phase 1 must remain closed until both conditions are recorded:

1. v4.0.9 is published and independently verified as the Phase 0 patch release; and
2. maintainers formally approve `compatibility-ledger-v4.1.md`.
