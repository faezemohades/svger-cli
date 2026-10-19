# Phase 00 Quality-Gate Tracking

## QG-003 — Package smoke budget

The package smoke test preserves the measured compressed tarball size of **628,062 bytes** as its
reference point and enforces the approved provisional maximum of **640,623 bytes**. These values
are intentionally tracked separately: the reference records the inspected package; the maximum is
the release gate. The smoke test also retains offline local-tarball installation, public entrypoint
and CLI checks, and consumer TypeScript declaration compilation. The package remains constrained
to the reviewed 606-file SVG asset corpus and its existing entry-count/headroom gates.

## Phase 00.4 — SVG input security hardening

Implemented a bounded XML scanner and one reject/strip policy shared across generation paths. The
compiler validates input before cache reuse, the cache fingerprint invalidates results produced by
the previous regex-only gate, and file-based entry points check size before bounded reads.
`tests/phase0/svg-security-corpus.test.mjs` measures 9 MiB valid and adversarial scans, and covers
finding limits, CSS/XML edge cases, strip overlap, optimizer output, cache poisoning, encoding, and
file-size checks. `tests/phase0/entrypoint-safety-matrix.test.mjs` covers the public CLI/service and
integration paths. See `docs/phase0-svg-input-security.md` for restrictions. Phase 00.4 was approved
under Engineering Review 007.

## QG-001 — Dual-path artifact characterization

Resolved in Phase 00.3. The compiler facade and `SVGService.buildAll()` now produce matching
filenames and byte-identical artifacts for the characterized flat build.
`tests/phase0/dual-path-characterization.mjs` enforces that parity. Differences in progress output
and the legacy facade deprecation warning remain intentional.

## QG-002 — Repository-wide lint baseline

Resolved for Phase 00.8. `npm run lint` reports zero errors. The four formatting errors present at
the start of final stabilization were corrected in `src/commands/migrate-command.ts`,
`src/commands/recover-command.ts`, `src/plugins/color-replacer.ts`, and
`src/plugins/watermark-remover.ts`.

The deliberate warning policy permits only `@typescript-eslint/no-explicit-any`, capped at the
current 14 findings. `npm run lint:budget` enforces zero errors, that single warning category, and
the 14-warning ceiling. The current findings are in `src/core/performance-engine.ts` (4),
`src/core/style-compiler.ts` (5), `src/optimizers/advanced-stages.ts` (3),
`src/plugins/color-replacer.ts` (1), and `src/plugins/watermark-remover.ts` (1). These warnings
remain visible and are not disabled or suppressed.
