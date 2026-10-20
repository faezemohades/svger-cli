# Directive 040 — Pre-publication Workstream Review

Status: prepared on the separate `feat/phase040-docs-benchmark` branch based on frozen candidate
`98ac8c8c43a51475907b5e67790e61a567cce45c`. This is a local engineering record, not release
approval. The candidate branch remains frozen; proposed package version 4.1.0 is unpublished and
release remains NO-GO.

## Implemented

- Updated package metadata, lockfile root version, runtime version fallback, planned changelog,
  README, framework and optional-dependency guides, and generated TypeDoc reference to planned
  version 4.1.0. The v4.0.9 export-map baseline and release authorization policy are unchanged.
- Replaced stale docs-site claims and simulated performance content with static support and
  limitation pages, links/navigation checks, and a local-file-only viewer for versioned evaluator
  JSON. Opening the site starts no benchmark, test, network request, or command.
- Added opt-in `npm run evaluate:local`: bounded deterministic fixture sizes, configurable warmups
  and samples, median/p95/throughput, output bytes/digests, informational process-memory snapshots,
  build/runtime/fixture metadata, native Svelte compilation, determinism, compatibility tests,
  semantic projections, and existing non-destructive security regressions. Security is pass/fail;
  timing thresholds are informational. Two local builds can be compared without upload.
- Corrected the Phase 04.4 fixture count to 2,251 XML elements: 750 groups each contain a group,
  path, and text element, plus the SVG root. Historical timings remain clearly scoped to the
  recorded Node 20.20.2 local run and show IR slower than legacy.

## Verification on 2026-10-20

Environment: Node.js 22.22.2 / npm from the same local installation, Linux x86_64.
`npm run quality:release` passed after preserving the existing package budgets. It included
TypeScript, zero-error lint with the approved 14 warnings, Jest, framework/config/E2E/integration,
Phase 00/01, Phase 04, package smoke, archive conformance, the evaluator contract test, and
docs-site link checks.

The generated npm archive report is
[package-conformance-v4.1.0.json](../reports/package-conformance-v4.1.0.json): 753 files and 608,877
compressed bytes, 31,746 bytes below the approved 640,623-byte ceiling. The package smoke's fixed
754-file limit is also satisfied. No new dependency or export was introduced. The first full run
correctly rejected an attempted 755-file archive after documentation was added to the package
allowlist; those additions were removed from the allowlist and no budget was raised.

The evaluator was also run end-to-end with its default 50/750 group fixtures, 8 warm-ups, and 40
samples per mode. On Node 22.22.2 / npm 10.9.7, the latest run measured the 50-group (151-element)
fixture at 0.643 ms legacy median / 3.943 ms IR median; the 750-group (2,251-element) fixture
measured 10.086 ms legacy / 75.562 ms IR median. The latter p95 values were 12.426 ms and 85.575 ms,
respectively. Compile, determinism, compatibility, and listed security regression checks passed.
Static semantic coverage was partial and is reported separately; a quality pass is not a claim of
complete semantic coverage. The security checks are regression evidence, not comprehensive security
certification. These are local, host-specific observations and do not override or replace the Phase
04.4 Node 20.20.2 benchmark record. The JSON report was written to `/tmp`, not retained in the
repository. A one-group smoke run also passed earlier; it is not performance evidence.

## Directive 041 — focused qualification follow-up

Engineering Review 062 accepted the Directive 040 work locally and authorized focused validation
only. The report viewer now validates the nested v2 report structure, rejects malformed JSON and
files over 5 MiB before rendering, and uses `textContent` for all report-derived strings. The
evaluator does not accept commands from report data: it uses fixed compatibility/security command
arguments and deterministic synthetic fixtures. Repeated fixture hashes and output digests are
retained in the versioned report. Reports are unsigned, self-reported evidence; a valid schema does
not authenticate evaluator provenance. Supplied comparison builds are executed without sandboxing
and must be trusted. Cross-report benchmark comparisons are descriptive because host/runtime
conditions can differ. Security output explicitly names the checked non-destructive regressions and
disclaims comprehensive security certification. README and docs-site status/performance claims are
aligned; the public 4.0.9 compatibility baseline and release authorization remain unchanged, and
planned 4.1.0 remains unpublished.

Directive 041 verification is recorded after running its targeted contracts, local evaluation,
documentation checks, release-quality suite, package conformance, and `git diff --check`. It does
not authorize publication, Phase 05, or remote repository actions.

## Remaining release boundary

This work does not perform publication, remote GitHub actions, branch-protection changes, release
authorization changes, default compiler switching, or Phase 05 implementation. SEC-INC-001,
GOV-001/GOV-002, remote clean CI, dependency verification, maintainer review, and the release NO-GO
decision remain as recorded in [Phase 04.5 readiness](phase4.5-release-readiness.md).
