# Phase 04.5 — Release Readiness Decision

Status: **No-Go.** Local technical release checks pass on the current working tree, but the
candidate is not releasable: clean-checkout remote CI and governance review are outstanding, and
SEC-INC-001 remains open. Exact-minimum Node behavior has now passed locally. Directive 038's
focused `sharp` mitigation is implemented locally but awaits clean-install and remote validation. No
publication or release-policy change is authorized.

## Candidate and scope

Reviewed local HEAD: `5f9917b5fe1d6d3eb900db8b7ad2dc6dc2766110`, branch
`feat/phase2-secure-xml-parser`. The release gate was run against the current working tree, which is
not clean and contains uncommitted changes. The accepted production contract remains unchanged:
legacy generation is the default, Svelte `ir-v1` remains opt-in, and experimental emitters for other
frameworks are not production routes.

This is a local readiness assessment, not a release attestation, maintainer approval, or permission
to publish.

## Verification evidence

| Check                                | Result                             | Evidence / limitation                                                                                                                                                                                   |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run quality:release`            | Pass                               | Re-run after Directive 038 changes on 2026-10-20 with Node `v20.20.2` / npm `10.8.2`; included `quality:full`, package smoke and archive conformance.                                                   |
| Packed archive                       | Pass                               | Latest `quality:release`: 753 files, 635,977 bytes; 4,646 bytes below the 640,623-byte limit. Exact Node 18.17.0 package smoke: 639,982 bytes, 641 bytes below the cap.                                 |
| Installed-package public entrypoints | Pass locally                       | Smoke imports and exercises the root, Vite, Webpack, Rollup, Babel, Next.js and Jest exports/aliases from the packed artifact; verifies installed-package Svelte JS/TS opt-in behavior.                 |
| Node 18 compatibility                | Local minimum pass; remote pending | `test:phase1:smoke` and `test:package` passed on exact Node `18.17.0` / npm `9.6.7` using the existing workspace dependency tree; clean `npm ci` and CI remain pending.                                 |
| Node 20 release gate                 | Pass                               | `quality:release` passed on Node `20.20.2`.                                                                                                                                                             |
| Node 22 / 24 full suites             | Pass locally                       | `quality:full` passed on Node `22.22.3` / npm `10.9.8` and Node `24.22.0` / npm `11.19.1` before the final package-smoke test expansion; the final release gate passed on Node 20 after that expansion. |
| Node 26 and cross-platform CI        | Pending                            | Workflow specifies Node 26 fast smoke on Ubuntu/Windows/macOS and Node 22/24 platform jobs. No clean-checkout run for this candidate was available.                                                     |
| Security admission and transactions  | Pass locally                       | Included in the final full quality gate, including Phase 00 security, entrypoint, recovery, and transaction regressions.                                                                                |
| Release authorization                | Correctly denied                   | `npm run release:authorization` exits nonzero: publishing remains disabled by SEC-INC-001. This is an expected policy hold, not a test defect.                                                          |

The final package smoke expansion is test-only. It does not add package exports or runtime code.

## Blocking release conditions

1. **SEC-INC-001 remains open.** There is no confirmation that the exposed npm and GitHub tokens
   were revoked and account activity reviewed. The release policy still says
   `publishingAuthorized: false`; the authorization guard correctly blocks publication. Account-side
   closure must be confirmed by the account owner without sharing replacement credentials.
2. **GOV-001/GOV-002 and remote review remain open.** `git ls-remote` shows remote `main` at
   `0722aa2872402576891aeeb5552391c9e0efe5bc` and no remote ref for the local candidate branch. The
   candidate has no clean-checkout workflow result or maintainer approval. Previously recorded
   repository findings state branch protection is not enforced and this session lacks permission to
   configure it. A local pass cannot substitute for the protected review workflow.
3. **Minimum-runtime CI evidence is pending.** The repository declares Node `>=18.17.0` and the
   exact Node `18.17.0` smoke plus package installation passed locally. The clean-checkout workflow
   must still verify the runtime with its CI dependency installation; support policy must remain
   unchanged unless separately approved.
4. **Dependency mitigation implemented; clean-install verification pending.** `sharp` was removed
   from automatic optional installation and lockfile resolution. Rasterization now refuses Node
   versions below `20.9.0`, checks the separately installed package metadata for `sharp >=0.35.5`
   before loading native code, then verifies the runtime-reported version matches. This preserves
   the Node `>=18.17.0` contract for ordinary SVG generation while disabling rasterization on
   Node 18. Focused regression coverage rejects vulnerable versions and confirms the dependency is
   absent from the manifest/lockfile. The ordinary npm audit and a temporary install of patched
   sharp did not complete in this proxy environment, so no clean aggregate audit or successful
   render using sharp `0.35.5` is claimed. The current `node_modules` still contains the old
   `0.34.5` as an extraneous install; the runtime policy rejects it before loading native code. A
   clean `npm ci` and visual tests with a patched installation remain pending.

## Decision and next actions

**No-Go for release.** The local software quality and package checks are green, but release criteria
also require resolved security/governance conditions, an exact supported-runtime result, and
clean-checkout remote CI. Do not publish, alter the release authorization policy, switch the
compiler default, or widen the package-size budget under this decision.

To reconsider Go, verify Directive 038's `sharp` mitigation from a clean install, obtain
account-owner confirmation for SEC-INC-001, push this reviewed candidate through the repository's
authorized review process, verify required branch protections and maintainer approval, and record
passing clean-checkout workflow results for the declared runtime/platform matrix, including Node
18.17.0.

## Directive 038 local implementation update — 2026-10-20

- Removed `sharp` from automatic optional installation and lockfile resolution; `pixelmatch` and
  `pngjs` remain optional. Rasterization requires separately installed `sharp >=0.35.5`.
- The loader denies rasterization below Node `20.9.0`, verifies the installed sharp package version
  before loading its native entrypoint, and verifies runtime version metadata agrees. The Node
  `>=18.17.0` support contract for ordinary SVG generation is unchanged.
- Added policy tests for Node boundaries, vulnerable and prerelease sharp versions, absence from
  manifest/lockfile, and deterministic minified output. The default Phase 00 visual regression
  explicitly skips when safe optional rasterization is unavailable; the separate visual test command
  remains available when compatible dependencies are installed.
- Verified exact Node `18.17.0` / npm `9.6.7` locally using the official Linux x64 release archive
  and published SHA-256 (`f36facda28c4d5ce76b3a1b4344e688d29d9254943a47f2f1909b1a10acb1959`; [Node.js release archive](https://nodejs.org/dist/v18.17.0/)). `npm run test:phase1:smoke` and `npm run test:package` passed. The minimum
  runtime package smoke measured 639,982 bytes. `npm run quality:release` on Node `20.20.2` / npm
  `10.8.2` passed and measured 635,977 bytes (753 files) in package smoke and archive conformance.
  Both results remain below the existing 640,623-byte cap.
- The exact-minimum test used the existing workspace dependency installation, not a clean `npm ci`.
  The aggregate `npm audit --omit=dev --audit-level high` timed out after 25 seconds, and installing
  patched sharp in a disposable directory stalled at the proxy. The positive render path with sharp
  `0.35.5` and a clean-install advisory audit remain unverified here.

Directive 038's code and local verification work is prepared, but release remains **No-Go** pending
clean installation/CI, positive safe-renderer verification, account-owner closure of SEC-INC-001,
and authorized GOV-001/GOV-002 review and repository controls.

## Security references

- [sharp librsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)
- [sharp libheif advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c)
- [sharp 0.35.0 changelog and Node.js requirement](https://github.com/lovell/sharp/blob/main/docs/src/content/docs/changelog/v0.35.0.md)
