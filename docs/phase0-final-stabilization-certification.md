# Phase 00.8 — Final Stabilization Certification

## Decision

**Technical baseline: certified. Release authorization: withheld.** Directive 009's engineering
exit criteria pass on the recorded environment. SEC-INC-001 remains open pending account-side token
revocation and activity review, so this record does not authorize publishing. Cross-process output
locking remains an explicitly documented operational limitation.

## Reproduction environment

- Repository baseline: `c38e211` (working tree contains the Phase 00 stabilization work and this
  certification follow-up; no clean-clone claim is made).
- Date: 2026-10-18.
- Runtime: Node.js `22.21.1` on Linux; package engine floor remains Node.js `>=18.17.0`.
- Package/test runner: npm `10.8.2`, invoked via `pnpm dlx npm@10.8.2`.
- Each validation script performed clean TypeScript builds before its relevant test groups.

## Verification results

| Gate | Result | Evidence |
| --- | --- | --- |
| Phase 00 | Pass | `npm run validate:phase0`; includes generator conformance, SVG security, semantic preservation, visual equivalence, integration safety matrix, recovery, resource lifecycle, integrated workflow, and package smoke. |
| Phase 1 regression contracts | Pass | `npm run validate:phase1`; this is regression evidence, not formal Phase 01 completion. |
| Jest | Pass | 10 suites, 155 tests. |
| Framework/configuration/E2E/integrations | Pass | `npm test`; 11 framework targets, 10 configuration checks, 8 E2E cases, and 7/7 integration checks. |
| TypeScript | Pass | `npm run typecheck` in both validation chains; generator and declaration checks also run in their suites. |
| Repository lint | Pass under declared policy | Zero errors; 14 visible `@typescript-eslint/no-explicit-any` warnings, the only approved warning class and within the 14-warning budget. Enforced by `npm run lint:budget`. |
| Privacy and baseline integrity | Pass | `npm run test:privacy`; baseline policy verified 14 immutable files. |
| Distribution artifact | Pass | Offline package smoke: `svger-cli-4.0.9.tgz`, 754 files, 634,074 compressed bytes. |
| Diff hygiene | Pass | `git diff --check`. |

The package remains under the approved **640,623-byte** ceiling by **6,549 bytes**. The package
smoke verifies the CLI, public runtime entrypoints, declarations, integration imports, offline
installation, and an installed CLI build. It verifies the reviewed 606-SVG asset corpus and rejects
source/tests, source maps, `.github`, `.npmrc`, `.env*`, internal reports, and other unintended
development files.

## Integrated workflow

`tests/phase0/integrated-workflow-certification.test.mjs` exercises the public compiler path from a
safe SVG file through input validation and optimization to React TSX generation and transactional
commit. It verifies the component and barrel contents and confirms transaction journals/staging are
removed. A companion unsafe-input case requires `E_UNSAFE_SVG_CONTENT` and confirms that no output
directory is committed.

The existing end-to-end and Jest expectations were aligned with already accepted contracts: malformed
SVG now rejects with actionable diagnostics, plugin hook failures propagate instead of being hidden,
and source SVG units/style attributes are preserved where normalization could change semantics.
Four formatting-only lint errors were fixed. No generator architecture rewrite or new optimization
feature was introduced for final certification.

## Remaining governance and operating constraints

- **SEC-INC-001:** open. Do not publish until the exposed npm and GitHub credentials are revoked and
  account activity is reviewed. No credentials were accessed or changed during certification.
- **QG-002:** closed. The approved warning category and count remain explicit; warnings are not
  disabled or suppressed.
- **Output locks:** process-local only; independent Node.js processes are not mutually serialized.
- **Phase 00.8:** technical exit criteria pass. Release authorization remains blocked by SEC-INC-001.
- **Phase 01:** not formally certified by this record.
