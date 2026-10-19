# Phase 01 — Initial Quality & Governance Inventory

Inventory performed for Directive 010 before governance implementation changes.

## Existing controls

- `npm run validate:phase0` and `npm run validate:phase1` are comprehensive local gates with
  dependency order and fail-fast shell chaining. Both use clean TypeScript builds; the Phase 00 path
  includes Jest, framework/config/E2E/integration coverage, security, semantic, visual, recovery,
  concurrency, integrated workflow, and package-smoke checks.
- `scripts/check-lint-budget.mjs` enforces zero ESLint errors and a 14-warning cap restricted to
  `@typescript-eslint/no-explicit-any`.
- `tests/phase0/package-smoke.test.mjs` packs and inspects the actual npm archive, verifies the
  reviewed SVG corpus and size/file budgets, installs offline into a consumer, and checks CLI,
  imports, and declarations.
- `scripts/verify-baseline.mjs` verifies locked baseline hashes. The Phase 1 traceability contract
  maps P1-101 through P1-116 to source and executable tests. A public API baseline and compatibility
  ledger are present.
- CI uses `npm ci` and covers multiple operating systems and Node versions.

## Gaps found

1. There is no canonical fast/full/release-candidate gate taxonomy. CI uses `validate:phase1` for its
   full matrix rather than a named combined Phase 00+01 certification gate; Phase 00 can therefore
   drift out of routine CI.
2. Active GitHub workflows lack explicit repository-wide least-privilege permission defaults and
   use mutable action tags. Existing CI has a `release: published` trigger and an npm publish job;
   `release.yml` is active on tags/manual dispatch and publishes npm and container artifacts. Both
   conflict with the SEC-INC-001 hold.
3. `test:package` excludes sensitive filenames and internal paths but does not inspect packed file
   contents for credential-shaped values. The baseline and package-size gates do not yet have a
   consolidated failure-injection contract.
4. Compatibility and issue traceability have focused contracts, but there is no single governance
   contract proving that deliberately injected lint, regression, package-budget, credential-artifact,
   and public-contract failures return nonzero.
5. `scripts/validate-cicd.sh` is a legacy checklist, not a reliable gate: it asserts removed CI files
   (Docker/Jenkins), uses a hand-written YAML check, may install dependencies, and contains
   environment-dependent optional checks.
6. Performance/resource tests provide environment-qualified samples and caps; there is no separate
   reproducible performance-baseline policy. Measurements should remain informational unless a
   stable workload and threshold are approved.

## Scope and sequence

The first implementation increment adds executable governance contract tests for these gaps. The
tests must fail against the inventory state before workflow, gate, and package-policy changes are
made. Existing Phase 00 tests and budgets remain authoritative. Publishing workflows stay disabled
until SEC-INC-001 is closed. Phase 02 parser migration and Phase 03 CompilerIR work are explicitly
out of scope.
