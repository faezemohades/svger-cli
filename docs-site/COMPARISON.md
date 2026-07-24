# SVGER-CLI Comparison and Claim Governance

Date reviewed: 2026-07-24

Source version: 4.0.9

## Purpose

This document governs comparison claims used by the GitHub Pages documentation site. Older copies of
this file described SVGER-CLI v2.0.7 and made broad benchmark claims that were not tied to the
current release evidence. The documentation site now treats comparisons as capability orientation,
not as unqualified marketing proof.

## Current Implementation Differentiators

| Area | SVGER-CLI v4.0.9 position |
| --- | --- |
| Framework coverage | React, React Native, Vue, Angular, Svelte, Solid, Preact, Lit, Vanilla |
| CLI coverage | `build`, `generate`, `watch`, `optimize`, `config`, `plugins`, `lock`, `unlock`, `clean`, `recover`, `migrate` |
| Integration coverage | Webpack, Vite, Rollup, Babel, Next.js, Jest |
| Safety default | Unsafe SVG input is rejected by default; explicit strip mode is opt-in |
| Output safety | Output path sandboxing and transaction recovery are part of the v4.0.9 source state |
| Package shape | Curated runtime/docs/examples/assets; internal reports, tests, coverage, source maps, and `.github` are excluded |
| Parser refoundation | P2-201 parser selection is research/ADR only; no production parser dependency is installed |

## Competitor Comparison Rules

Allowed:

- compare supported framework breadth;
- compare public CLI/integration surfaces;
- compare package contents from reproducible `npm pack` evidence;
- cite benchmark numbers only when the evidence file, dataset, date, and source commit are named.

Not allowed:

- claim a fixed percentage advantage without current benchmark evidence;
- describe browser benchmark simulations as release-grade performance evidence;
- claim future parser or Phase 2 production behavior before the ADR is formally accepted;
- say the project has zero dependencies if a future parser dependency is adopted.

## Current Public Claim Language

Recommended wording:

```text
SVGER-CLI is a multi-framework SVG component compiler with built-in optimization,
official build-tool integrations, reject-by-default input safety, and package conformance evidence.
```

Avoid:

```text
Always 85% faster than competitors.
Zero dependencies forever.
Phase 2 parser support is available.
```

## Evidence Sources

- `package.json`
- `src/cli.ts`
- `src/types/index.ts`
- `src/types/integrations.ts`
- `docs/SUPPORT-MATRIX.md`
- `reports/package-conformance-v4.0.9.md`
- `reports/phase2-start-report.md`
- `reports/docs-site-review-2026-07-24.md`
