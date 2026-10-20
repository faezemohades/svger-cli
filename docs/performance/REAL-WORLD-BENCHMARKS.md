# Performance Evidence Policy

The performance tables formerly published in this file described a 2026-01-02 run of older v4.0.0
code and included competitor estimates that were not independently reproduced. They are withdrawn as
current product claims and are not release evidence.

For the qualified Svelte legacy-versus-IR fixture, use the measured values and methodology in
[Phase 04.4 stabilization](../phase4.4-production-stabilization.md). That record identifies the
input size, element count, Node version, warm-up/sample settings, output sizes, and the important
result: IR remains slower than legacy for that fixture.

For new local measurements, use the opt-in [evaluation workflow](../EVALUATION.md). Results include
environment and fixture metadata and are informational observations, not cross-platform performance
guarantees. Do not compare against competitors unless the complete method, exact versions, data, and
raw results are independently available.
