# GitHub Pages Documentation Review

Date: 2026-07-24

Branch: `agent/docs-site-v409-review`

Live site reviewed: `https://faezemohades.github.io/svger-cli/`

## Verdict

```text
LIVE GITHUB PAGES STATUS: STALE BEFORE THIS CHANGE
DOCUMENTATION SOURCE: docs-site/
DOCS-SITE LANDING PAGE: UPDATED FOR v4.0.9 SOURCE
COMPLETE COMMAND REFERENCE: ADDED
LIVE RUNTIME EVIDENCE: ADDED
CLI COMMAND ACCURACY: UPDATED
FEATURE COVERAGE: UPDATED
SECURITY/GOVERNANCE STATUS: ADDED
PHASE 2 PRODUCTION IMPLEMENTATION: STILL BLOCKED
```

## Findings

The deployed site was behind the repository implementation:

| Area | Finding | Resolution |
| --- | --- | --- |
| Version | Live content referenced older v4.0.3/v4.0.7 copy | Landing page now states v4.0.9 source status |
| CLI commands | Live quick start used obsolete `convert` and `batch` examples | Replaced with `generate` and `build` |
| Command surface | Recovery, migration, config explain, plugins, safety, and build modes were incomplete | Added compact landing table and full `commands.html` reference |
| Runtime proof | Live site did not prove documented commands actually run | Added live smoke, formal validation, and benchmark evidence |
| Frameworks | Framework list was present but not tied to `FrameworkType` | Added current nine-target framework matrix |
| Integrations | Build tool docs existed but were not summarized as public export paths | Added export path and API matrix |
| Security | Reject-by-default input handling and output safety were not visible enough | Added safety and filesystem containment section |
| Governance | Phase 0/Phase 1/Phase 2 gates were absent from public docs | Added release and governance status |
| Claims | Browser benchmark and comparison claims were too broad | Rewrote claim governance and benchmark notes |

## Files Reviewed

- `docs-site/index.html`
- `docs-site/commands.html`
- `docs-site/README.md`
- `docs-site/COMPARISON.md`
- `docs-site/BENCHMARK_TESTING.md`
- `docs-site/optimizer.html`
- `docs-site/benchmark-demo.html`
- `src/cli.ts`
- `src/types/index.ts`
- `src/types/integrations.ts`
- `src/services/config.ts`
- `package.json`
- `docs/SUPPORT-MATRIX.md`
- `docs/OPTIONAL-DEPENDENCIES.md`
- `reports/package-conformance-v4.0.9.md`
- `reports/phase2-start-report.md`

## Output

- Replaced the GitHub Pages landing page with an implementation-indexed v4.0.9 documentation portal.
- Added a complete commands, recipes, capabilities, live evidence, benchmark, and limitation page.
- Updated documentation-site maintenance instructions.
- Replaced outdated comparison copy with claim-governance rules.
- Replaced benchmark testing notes with correct scope and release-evidence rules.
- Added live runtime evidence reports under `reports/`.

## Live Runtime Evidence

Runtime proof was executed after rebuilding the CLI from source:

| Evidence | Result |
| --- | --- |
| Live smoke assertions | `15/15` |
| Framework tests | `11/11` |
| Configuration tests | `10/10` |
| E2E tests | `8/8` |
| Integration checks | `7/7` |
| Security containment | `27` assertions |
| Safety matrix | Pass |
| Phase 1 smoke contracts | Pass |

The evidence is recorded in:

```text
reports/docs-site-live-evidence-2026-07-24.md
reports/docs-site-live-evidence-2026-07-24.json
```

Known runtime limitation documented: `svger optimize` currently operates on directories. Single-file
optimizer input exits with `ENOTDIR` and should not be taught as a verified happy path until fixed
or formally reclassified.

## Remaining Release Reality

The site now documents the source state accurately, but npm publication is a separate release gate:

```text
svger-cli source version: 4.0.9
npm latest at review time: 4.0.8
svger-cli@4.0.9 registry verification: pending
```

Therefore documentation must not claim that Phase 0 is officially closed until v4.0.9 is published
and independently verified.
