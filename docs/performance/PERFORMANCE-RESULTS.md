# Current Performance Results

No universal throughput or memory guarantee is published. The checked-in detailed result is the
fixture-specific Svelte benchmark in
[Phase 04.4 stabilization](../phase4.4-production-stabilization.md): Node.js 20.20.2, 70,877-byte
input, 2,251 SVG elements, eight warm-ups, and 40 alternating samples. Its medians were 10.768 ms
for legacy and 77.829 ms for IR after a previous IR median of 123.395 ms. The IR median reduction
was approximately 36.9% relative to the earlier IR run; IR was still slower than legacy.

The later opt-in local evaluator run on 2026-10-20 used Node.js 22.22.2 / npm 10.9.7, the same
2,251-element fixture (750 groups), eight warm-ups, and 40 samples. Legacy measured 10.086 ms median
and 12.426 ms p95; IR measured 75.562 ms median and 85.575 ms p95, or about 7.5× the legacy median.
This confirms that the IR route was slower in both recorded environments. These measurements are not
directly interchangeable benchmark guarantees: runtime, host load, fixture shape and build identity
matter, and the result does not imply cross-platform behavior.

To reproduce or evaluate other fixtures, use `npm run evaluate:local` as documented in
[the evaluation guide](../EVALUATION.md). Preserve the JSON output and environment metadata when
sharing results. Do not treat the interactive site demo or a single host's measurements as a
cross-platform guarantee.
