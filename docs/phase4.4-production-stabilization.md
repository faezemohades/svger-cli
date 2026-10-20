# Phase 04.4 — Production Stabilization and Optimization

Status: Directive 036 implementation and local qualification complete; submitted for management
review. The legacy compiler remains the default; the production Svelte IR compiler remains explicit
opt-in. This record does not authorize a default switch, other-framework IR routing, release
publication, or Phase 04.5.

## Stabilization evidence

The exact-state `npm run quality:full` gate passed on Node `v20.20.2`, including typechecking, the
approved lint budget, deterministic Jest, all Phase 00/01 contracts, existing framework and
integration tests, package smoke, and the Phase 04 emitter/runtime/minified-build tests.

The production Svelte integration suite verifies the implicit legacy default, explicit legacy
equivalence, `svelteCompiler: "ir-v1"` opt-in, configuration-file precedence, separate pipeline
fingerprints, JS/TS artifacts, and unsupported-framework diagnostics. IR failures remain explicit:
unsupported constructs and malformed XML fail without output artifacts or cache writes. Existing
security corpus, entrypoint safety matrix, transaction recovery, and atomic output tests pass in the
same full gate. The Svelte native compiler and SSR tests cover component prop defaults/overrides and
rendered output; minified/unminified public-service parity and stack-location contracts also pass.

No framework outside Svelte was routed to production IR. No cache model, concurrency model, public
package export, or runtime dependency was added by this stabilization change.

## Measured optimization

The production-path benchmark compares `SVGProcessor.generateComponent()` in legacy and IR modes
using the same deterministic 70,877-byte SVG (750 groups, 2,251 elements), no optimizer stages,
eight warm-ups per mode, and 40 alternating samples per mode. It reports median, p95, min/max and
output bytes; timings are informational and are not CI thresholds. Re-run after `npm run build`:

```sh
node experiments/phase4/production-svelte-benchmark.mjs
```

On Node `v20.20.2`, the pre-change run measured legacy median/p95 of `10.330/15.060 ms` and IR
median/p95 of `123.395/139.577 ms`. Stage timing showed the lowerer validated and deeply froze its
IR, then the emitter repeated the full recursive validation and defensive copy of that same
immutable IR. `validateAndFreezeIR()` now tracks its own successfully validated, deeply frozen
results in a `WeakSet`; subsequent use of that exact object returns it without retaining completed
documents or trusting caller-supplied brands. New or modified objects still receive the full
validation and defensive copy.

The post-change reproducible script run, using the same Node version, fixture, warm-up, sample
count, and alternating order, measured legacy median/p95 of `10.768/15.352 ms` and IR median/p95 of
`77.829/92.749 ms`. The IR median improved by approximately 37% against the pre-change run, with
identical output byte counts before and after (`75,670` IR bytes; `71,164` legacy bytes). The IR
path remains materially slower on this large fixture because it builds and validates semantic IR in
addition to emitting source; this result supports retaining it as opt-in and is not evidence for a
default switch. Security checks, limits, diagnostics, artifact planning and transactional writes are
unchanged.

Focused regression coverage asserts that the same deeply validated IR is reused, while the full
Phase 03 IR conformance suites continue to exercise validation, defensive copy, immutability,
provenance, and malformed-input rejection. No optimization was made to the security scanner or
validation rules because their behavior is security-sensitive and the measured repeat-validation
elimination already provided a material improvement.

## Package and release boundary

The approved public package contract and archive conformance remain required. `quality:full`
includes the installed-package smoke test; `npm run package:conformance` remains the archive
inventory/size gate. Both passed: the archive contained 753 files and measured 636,351 bytes, 4,272
bytes below the 640,623-byte cap. This work does not authorize publication or alter release policy.
Phase 04.5 release readiness and remote CI remain separate review gates.
