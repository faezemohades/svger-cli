# Phase 01 — Quality & Governance Policy

Status: implementation in progress under Directive 010. Phase 00 technical certification remains
closed. Phase 01 is not certified until its failure controls and a clean-checkout CI run are reviewed.

## Canonical gates

| Gate | Intended use | Checks and failure policy |
| --- | --- | --- |
| `npm run quality:fast` | Local iteration and cross-platform smoke | Baseline integrity, TypeScript, zero-error/14-warning lint budget, deterministic Jest, and public package contract. Every failed command returns nonzero and stops the chain. |
| `npm run quality:full` | Pull requests and integration branches | Fast gate plus privacy, framework/config/E2E/integration tests, full Phase 00 and Phase 01 contracts, security/semantic/resource suites, and offline package smoke. |
| `npm run quality:release` | Release-candidate technical certification | Full gate plus archive/package conformance. This does not authorize publication. |

GitHub Actions uses `npm ci`, explicit workflow permissions, and full-SHA-pinned third-party
actions. Ubuntu full jobs run `quality:full`; Windows/macOS run the platform regression gate; the
current Node smoke matrix runs `quality:fast`. Branch protection must require the named full checks
for pull requests and integration branches; that repository setting cannot be enforced from this
checkout and must be verified by maintainers.

Workflow run order is fail-fast within each gate (`&&`). Jest runs in-band for deterministic test
discovery/execution, and its default run is not allowed to pass with zero tests unnoticed because the
governance certification also injects a known failing Jest test and checks the runner's nonzero exit.
Build/test outputs are generated from a clean `dist` build. CI installation starts from the committed
lockfile using `npm ci`; compatibility jobs that intentionally select a TypeScript version are
separate from the locked production test matrix.

## Supply-chain and publication controls

Active CI requires only read access by default. The visual-report comment job receives narrowly
scoped pull-request write permission. Actions are pinned to immutable commit SHAs. Workflow files
that create releases or deploy public documentation have `.disabled` suffixes while SEC-INC-001 is
open; CI has no publish trigger or publish job.

`governance/release-policy.json` is the repository authorization control. Its current value blocks
publishing. `release:authorization`, the npm `prepublishOnly` lifecycle, and all three local release
scripts check this policy before version mutation or publishing. The policy file is CODEOWNERS-
protected. Turning this gate on requires closure of SEC-INC-001 and an approved change; it does not
replace account-side credential revocation or review.

`npm run test:package` inspects the actual generated tarball, including file paths and credential-
shaped contents, verifies the 606 reviewed SVG assets, installs the archive offline, and exercises
CLI, public imports, declarations, and a consumer build. No CI step uploads credentials or package
artifacts to a public registry.

## Regression traceability and public compatibility

`governance/requirement-traceability.json` maps security, semantic behavior, framework generation,
configuration, recovery, concurrency/resource lifecycle, packaging, and public compatibility to
executable test paths. `tests/phase1/traceability.contract.test.mjs` retains the P1-101–P1-116
issue-level mapping.

`compatibility/public-package-contract.v4.0.9.json` records package name, main/types, CLI binaries,
and public subpath exports. `npm run check:public-contract` rejects drift. An intentional public
change must first be classified in `compatibility-ledger-v4.1.md`, receive the required row-level
maintainer approval, update the versioned contract baseline, preserve a migration/deprecation test,
and pass CODEOWNERS review. A changed contract is not made acceptable merely by updating the snapshot.

## Budget and measurement policies

- Lint: zero errors; only the existing 14 `@typescript-eslint/no-explicit-any` warnings are accepted.
  No warning ceiling increase or category suppression is allowed without explicit review.
- Package: compressed npm artifact maximum is 640,623 bytes; package smoke and archive conformance
  both enforce the cap. The 606 public SVG assets and entry-count/headroom policy remain unchanged.
- Performance/memory: run `npm run test:phase0:resources` on the documented fixture workload. It
  records runtime, optional post-GC heap delta, and cache retention; these environment-dependent
  observations are informational, not pass/fail memory thresholds. Stable logical budgets (500
  in-memory entries and configured disk-cache count/bytes) remain deterministic assertions.

## Failure-gate certification

`tests/phase1/governance-failure-gates.test.mjs` injects each failure into a disposable fixture and
requires a nonzero exit from the real gate implementation:

- an ESLint `debugger` violation;
- a deliberately failing Jest regression;
- a package size one byte over the approved maximum;
- a fixture package containing a fake GitHub token pattern;
- a changed public package export map.

The test removes its temporary fixtures in `finally` and verifies they cannot leak into the worktree.
The quality policy test also confirms the SEC-INC-001 release hold remains active. Phase 01 exit
requires these negative controls, the full positive gate, and a clean-checkout run in remote CI.

## Current verification result

On 2026-10-18, `quality:fast`, `quality:full`, and package archive conformance passed locally.
The archive contained 754 files and measured 634,226 compressed bytes, below the enforced
640,623-byte maximum. The governance policy and failure-injection contracts passed, as did
`git diff --check`. This run used the current working tree; a clean-checkout remote CI matrix and
maintainer review remain outstanding, so Phase 01 is not yet certified.

Remote verification on 2026-10-19 confirmed that GitHub `main` still points to
`c38e2117f6f463ec3b45446baa41569e829e1d08`, not this working tree. There is no open PR for these
changes. The latest Actions run reported for that remote commit is from 2026-07-24 and its CI/CD
workflow concluded `failure`; it does not validate this revision. GitHub reports `main` as
unprotected, with required status checks disabled, and the repository has no rulesets. The
branch-protection endpoint returned HTTP 403 (`Resource not accessible by integration`); the
connected GitHub identity has neither admin nor maintain permission. Therefore this session cannot
enable or enforce branch protection. Under Directive 010C, an attempt was made through the
connected integration to create `chore/phase1-quality-governance`, but the remote-ref request
returned HTTP 403 (`Resource not accessible by integration`). No newly authorized push credential
is available in this session, and no stored credential was used. No maintainer approval is
recorded. GOV-001 and GOV-002 remain open until the exact changes are pushed to a review branch,
pass its clean-checkout workflow matrix, and receive approval under repository-enforced protections.
