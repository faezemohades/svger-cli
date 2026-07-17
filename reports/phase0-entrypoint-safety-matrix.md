# Phase 0 entry-point safety matrix

The executable matrix is `tests/phase0/entrypoint-safety-matrix.test.mjs`; its machine-readable
result is `reports/phase0-entrypoint-safety-matrix.json`. “Sandbox” means that an existing symlink
artifact cannot redirect a write outside its declared output root and the external target remains
unchanged.

| Entry point               | Reject default | Explicit strip | Output sandbox | Evidence / scope                                               |
| ------------------------- | -------------- | -------------- | -------------- | -------------------------------------------------------------- |
| CLI `build`               | Pass           | Pass           | Pass           | Executed as a child process.                                   |
| CLI `generate`            | Pass           | Pass           | Pass           | Executed as a child process.                                   |
| CLI `optimize`            | Pass           | Pass           | Pass           | Executed as a child process.                                   |
| Direct `SVGProcessor` API | Pass           | Pass           | Pass           | Covers direct generation and file processing.                  |
| Legacy builder API        | Pass           | Pass           | Pass           | Covers the compatibility facade build path.                    |
| `SVGService`              | Pass           | Pass           | Pass           | Covers the primary service build path.                         |
| Vite                      | Pass           | Pass           | Pass           | Transform and artifact build hooks.                            |
| Rollup                    | Pass           | Pass           | Pass           | Transform and artifact build hooks.                            |
| Webpack                   | Pass           | Pass           | Pass           | Loader and plugin artifact hooks.                              |
| Babel                     | Pass           | Pass           | Pass           | Program visitor artifact flow.                                 |
| Jest transformer          | Pass           | Pass           | N/A            | Transformer returns code and performs no filesystem writes.    |
| Next.js                   | Pass           | Pass           | Pass           | Options and execution delegate to the tested Webpack contract. |

Watch-mode event lifecycles are intentionally not opened and held by this finite gate test. Legacy
watch delegates every event to the tested builder path; service watch delegates every event to the
tested `SVGProcessor.processSVGFile` path. The containment and sandbox contracts therefore execute
at the mutation boundary. Independent long-running watch lifecycle characterization remains a
post-Phase-0 concern and does not authorize Phase 1 work.
