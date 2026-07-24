# Docs Site Live Runtime Evidence — 2026-07-24

## Verdict

```text
DOCS-SITE LIVE RUNTIME EVIDENCE: PASS
COMMAND SURFACE DISCOVERY: PASS
SAFE GENERATION SMOKE: PASS
SECURITY REJECTION SMOKE: PASS
OPTIMIZER DIRECTORY SMOKE: PASS
FORMAL CAPABILITY VALIDATION: PASS
KNOWN LIMITATION DOCUMENTED: single-file optimize input currently fails
```

This evidence supports the GitHub Pages documentation refresh for the v4.0.9 source state.

## Runtime environment

| Field | Value |
| --- | --- |
| Date | 2026-07-24 |
| OS | Linux x64 |
| Node | v24.18.0 |
| npm | 11.16.0 |
| Package version | 4.0.9 |
| Source commit | `9454b5f1e6638d92f1a726f58703f82d039e3900` |
| CLI entrypoint | `bin/svg-tool.js -> dist/cli.js` |

## Live smoke assertions

| Assertion | Result |
| --- | --- |
| `svger --version` matches `package.json` | Pass |
| Root help lists every command group | Pass |
| `build --help` lists safety and scheduler options | Pass |
| Command help screens are available | Pass |
| Safe React `generate` writes `Safe.tsx` | Pass |
| Safe Vue `build` writes `Safe.vue` | Pass |
| `<script>` input is rejected | Pass |
| `on*` event handler input is rejected | Pass |
| `javascript:` URI input is rejected | Pass |
| Explicit `--unsafe-input-policy strip` succeeds and warns | Pass |
| Oversized input is rejected | Pass |
| Directory `optimize` succeeds | Pass |
| Unsafe directory `optimize` exits nonzero | Pass |
| ESM API import succeeds | Pass |
| Optimized SVG output is smaller in the smoke sample | Pass |

Summary: `15/15` live smoke assertions passed.

## Formal validation executed

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run build` | Pass | Production TypeScript build completed |
| `npm run typecheck` | Pass | `tsc --noEmit` completed |
| `npm run lint:budget` | Pass | `0` errors, `14/14` approved warnings |
| `npm run test` | Pass | Frameworks `11/11`, config `10/10`, E2E `8/8`, integrations `7/7` |
| `npm run test:security` | Pass | Phase 0 containment assertions passed: `27` |
| `npm run test:safety-matrix` | Pass | Reject/strip/sandbox matrix passed for CLI, APIs, bundlers, Jest, and delegated Next.js paths |
| `npm run test:phase1:smoke` | Pass | Report, canonical application service, and transaction recovery contracts passed |

## Optimizer benchmark evidence

Command:

```sh
node scripts/benchmark-comprehensive.js
```

| Level | Average size reduction | Average processing time | Average memory |
| --- | ---: | ---: | ---: |
| BASIC | 6.26% | 0.51ms | 47.69KB |
| BALANCED | 7.76% | 1.46ms | 158.67KB |
| AGGRESSIVE | 6.86% | 5.07ms | 110.52KB |
| MAXIMUM | 11.75% | 3.22ms | 346.21KB |

The benchmark is valid for optimizer size/time evidence across the repository sample SVGs. Its visual-diff column is not used as authoritative proof because the script catches optional visual comparison failures and falls back to zero.

## Known limitation found during live testing

`svger optimize ./icons/safe.svg ./optimized-single` currently exits with `ENOTDIR` because `OptimizeCommand` reads the input path as a directory. The docs-site now teaches directory input/output for the optimizer and records this current behavior instead of presenting single-file optimization as a verified happy path.

## Documentation changes supported by this evidence

- GitHub Pages landing page updated from stale v4.0.3/v4.0.7 content to v4.0.9 implementation-indexed documentation.
- Complete command and capability reference added.
- Live testing evidence added to the docs-site.
- Optimizer examples aligned with current runtime behavior.
- Benchmark/comparison claims constrained to measured, reproducible evidence.
