# Local benchmark and evaluation

The former browser simulator produced illustrative estimates, not measurements, and has been
retired. Use the opt-in local evaluator from a trusted checkout:

```sh
npm run build
npm run evaluate:local -- --groups 50,750 --warmups 8 --samples 40 --output ./evaluation.json
```

The command compares production Svelte legacy generation with opt-in `ir-v1`, measures median and
p95 time, throughput, output bytes and informational process-memory snapshots, then runs native
Svelte compilation, deterministic-output checks, the Phase 04 compatibility suite, semantic
projections, and existing non-destructive security regressions. Security is pass/fail only; there is
no security score. Timing and memory are not pass/fail thresholds.

Optional `--before-build DIR --after-build DIR` compares two local package roots. Because those
builds are imported and executed, use only trusted code. The tool does not upload results. Its
versioned JSON can be opened manually in `evaluation.html`, which reads the selected local file and
renders report fields as text. It does not execute report content.

Fixture/runtime/build metadata is part of every report. The default workloads have 50 and 750
groups, with each group containing a group, path and text node plus the root. Results are
environment-specific and must not be generalized into universal speed claims.

The latest 2026-10-20 local Node.js 22.22.2 / npm 10.9.7 run measured the 750-group fixture at
10.086 ms legacy median versus 75.562 ms opt-in IR median (about 7.5× slower); p95 was 12.426 ms
versus 85.575 ms. Treat this as a transparent host-specific observation, not a cross-platform claim.
