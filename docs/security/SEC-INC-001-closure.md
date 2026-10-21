# SEC-INC-001 — Credential Exposure and Incident Closure Record

**Project:** SVGER-CLI
**Incident ID:** SEC-INC-001
**Incident type:** Credential exposure — npm and GitHub
**Status:** OPEN — Pending owner verification and closure approval
**Release impact:** Publication prohibited
**Document date:** 2026-10-20

## 1. Incident summary

npm and GitHub credentials were previously exposed during project development and release
preparation.

The repository's release authorization policy prohibits npm publication until the affected
credentials are revoked, relevant account activity is reviewed, and the incident receives
authorized closure approval. The `prepublishOnly` lifecycle correctly rejects attempted publication
while SEC-INC-001 remains open.

## 2. Scope

Affected credential categories:

- npm access or automation token
- GitHub authentication token

The exact token values must not be reproduced in this document. Account owners must determine the
scope of each credential's permissions and exposure period.

## 3. Containment and revocation

| Control | Status | Evidence reference |
| --- | --- | --- |
| npm credential revoked | Pending owner confirmation | Pending |
| GitHub credential revoked | Pending owner confirmation | Pending |
| Other potentially affected credentials assessed | Pending | Pending |
| Active repository files reviewed for exposed credentials | Targeted preliminary review complete; broader review pending | See §§10–11 |
| Relevant historical exposure assessed | Reachable Git refs scanned; broader review pending | See §§10–11 |

## 4. Account activity review

The account owners must verify:

- npm package publication history during the potential exposure period;
- unexpected npm package or account changes;
- GitHub repository commits, branch updates, releases, and settings changes;
- GitHub Actions runs and changes involving repository secrets or workflows; and
- available account security and access events.

Record findings and evidence references. Do not include sensitive session, token, or account-security
data.

## 5. Engineering controls

Required verification:

- Release authorization remains enforced.
- Package publication remains blocked throughout the investigation.
- Active source files and configuration contain no exposed credentials.
- Security-sensitive logs and generated artifacts are excluded from publication.
- Any necessary remediation changes pass repository quality and security checks.

## 6. Findings and residual risks

**Confirmed unauthorized activity:** Not yet determined.

**Residual risks:** Pending investigation.

**Required remediation:** Pending owner and engineering reviews.

Absence of a reported security event must not be interpreted as proof that no unauthorized activity
occurred.

## 7. Closure criteria

SEC-INC-001 may be considered resolved only when:

- affected credentials have been revoked;
- account activity has been reviewed;
- repository exposure has been assessed and remediated where necessary;
- remaining risks have been documented and accepted by authorized personnel; and
- an accountable security owner has approved incident closure.

## 8. Authorization

**Account-owner attestation:** Pending

**Engineering verification:** Pending

**Security-owner approval:** Pending
**Closure date:** Not assigned

**Incident status: OPEN**

## 9. Release handoff

Closing SEC-INC-001 is necessary but not sufficient to authorize publication. The independent
GOV-001/GOV-002, remote CI, dependency verification, and maintainer approval requirements remain in
force.

No modification to publication authorization is permitted solely on the basis of this document.

## 10. Preliminary engineering verification — 2026-10-20

- Static inspection confirms `package.json` runs `release:authorization` before `build` in
  `prepublishOnly`. The guard requires policy schema version 1 and
  `publishingAuthorized: true`; `governance/release-policy.json` currently sets it to `false`.
  The guard, lifecycle ordering, and policy were not modified. The guard was not executed in this
  environment because npm is unavailable.
- A workspace scan for common npm and GitHub token-shaped strings found one match, in
  `tests/phase3/shadow-comparison-harness.test.mjs`. Source context confirms it is a synthetic
  redaction-test fixture, not a live credential. No matching values were copied into this record.
  The tracked-file name check found no `.npmrc`, `.env*`, credential-named, or token-named files.
- The same token-pattern search over Git-reachable history identified only that synthetic test
  fixture. This limited pattern scan does not cover every possible secret format, unreachable Git
  objects, external logs, chat history, or account-side exposure. Those reviews remain outstanding.
- `release-log.txt` was absent from this checkout. Package metadata has an explicit file allowlist;
  internal reports and generated API documentation are rejected by the archive conformance check.
  A fresh package/archive check was not run because npm is unavailable.

These checks are preliminary engineering evidence only. They do not verify account-side token
revocation, account activity, historical exposure outside reachable repository history, or incident
closure.

## 11. Targeted workflow, release, and artifact review — 2026-10-20

### Workflows and publishing paths

- The active `.github/workflows/ci.yml` has workflow-level `contents: read` permission, uses
  full-SHA-pinned actions, and contains no npm publication or deployment job. Its package step packs
  and locally installs a tarball for smoke testing; it does not upload the tarball to a registry.
- The active `.github/workflows/visual-regression.yml` uses read permission plus
  `pull-requests: write` for its result-comment job. That job posts fixed test-result text; the
  reviewed workflow contains no npm or deployment credential value and no publish step.
- Release and documentation deployment workflows are present only as `.yml.disabled` files. They
  are not active GitHub Actions workflows in this state. They contain release/deployment steps,
  write permissions, and references to GitHub-provided workflow credentials; no literal credential
  value was found. Keep them disabled. Their action references and permissions require a separate
  review before any reactivation.
- `package.json` routes `prepublishOnly` and all three local release scripts through
  `release:authorization` before build/version/publish operations. Static inspection of the guard
  and policy confirms publication remains disabled. Neither was modified.

### Documentation and secret-handling guidance

- The legacy `.github/CICD-QUICKREF.md` contained a troubleshooting command that would print an
  `NPM_TOKEN` value. This was a risky instruction, not an exposed token. The command was removed and
  replaced with a warning not to print, regenerate, or configure publishing tokens while the hold is
  active.
- `.github/CICD.md` and `.github/CICD-SETUP-CHECKLIST.md` are labeled legacy/superseded and contain
  historical token-name/setup examples, but no credential values were identified. Their banners
  say not to follow publishing setup while SEC-INC-001 is open. Treat these documents as non-current;
  reconcile their conflicting historical instructions before they are reused.
- The credential-pattern scan of workspace text files (excluding dependency/build/cache directories
  and binary artifacts) found no live token-shaped values. The reachable-history scan found only the
  previously noted synthetic test fixture. Pattern matching is not proof that all possible secret
  formats or historical exposure have been ruled out.

### Package and log review

- The `package.json` `files` allowlist does not include `.github/`, `reports/`, or
  `docs/security/`; the archive conformance script also rejects `.github/`, `reports/`, generated
  API docs, tests, source files, and temporary output. `.npmignore` excludes documentation by
  default, with package documentation admitted only by the explicit package allowlist.
- `release-log.txt` and package tarballs are absent from this checkout; no tracked file matching
  common credential/config filenames was found. The modified package-conformance report is under
  `reports/`, which the package policy excludes.
- A fresh `npm pack`/archive inspection could not be run because Node.js and npm are unavailable in
  this environment. The allowlist review is static evidence, not a substitute for inspecting the
  final release candidate's actual tarball.

No account-side credentials or private account records were accessed. No release policy, publishing
guard, workflow activation state, or package allowlist was changed. The only remediation was removal
of the unsafe token-printing command from the legacy quick reference. Account-owner revocation and
activity review, final archive verification, and authorized incident closure remain outstanding.

## 12. Engineering Review 071 handoff — 2026-10-21

| Evidence | Owner | Status |
| --- | --- | --- |
| Targeted repository exposure review and legacy documentation correction | Engineering | Completed within the scope recorded in §11; accepted by Engineering Review 071 |
| Final package-conformance run and actual tarball file-list inspection | Engineering | Pending; Node.js and npm are unavailable in this environment, and no tarball was inspected |
| npm credential revocation, scope assessment, and account-activity review | npm account owner | Pending owner attestation |
| GitHub credential revocation, scope assessment, and account-activity review | GitHub account owner | Pending owner attestation |
| Residual-risk assessment and acceptance | Authorized security owner | Pending |
| Incident closure decision | Authorized security owner | Pending; incident remains OPEN |

The available engineering evidence is limited to the local repository, reachable Git history,
workflow and release-path inspection, and static package inclusion rules described above. It does not
establish account-side revocation or activity, inspect unreachable Git objects or external records,
or prove the contents of a newly packed release artifact. The token-printing instruction was removed
as preventive documentation remediation; this does not itself resolve the earlier credential
exposure.

No release authorization, publishing guard, package allowlist, or unrelated README/package-report
change was modified as part of this handoff. Publication remains prohibited pending incident closure
and the independent release-governance requirements in §9.
