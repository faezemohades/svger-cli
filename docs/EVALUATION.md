# Local compiler evaluation

`npm run evaluate:local -- --output ./local-evaluation.json` runs an opt-in, local comparison of the
production legacy Svelte generator and the opt-in `ir-v1` generator. It does not upload data,
contact a service, publish a package, or alter the default compiler route. The command is not run by
installation, build, tests, or the documentation site.

Run `npm run build` first. Example:

```sh
npm run evaluate:local -- --groups 50,750 --warmups 8 --samples 40 --output ./evaluation.json
```

The generated SVG workloads are deterministic: each group contains one `<g>`, one `<path>`, and one
`<text>` element, in addition to the root SVG (so 750 groups contain 2,251 elements). Group counts
are bounded to 5,000. Warm-up and sample counts are configurable and bounded. The JSON report
records Node/npm and host metadata, package and build digests, fixture digest/bytes/element count,
output bytes/digests, median, p95, range, throughput, and informational process-memory snapshots.
Timing and memory values are descriptive observations, not pass/fail resource limits.

The evaluator also runs Svelte native compilation, repeat-generation determinism, the existing Phase
04 compatibility suite, static semantic projections, and the listed non-destructive SVG
security/input/recovery regression suites. This is limited regression evidence, not comprehensive
security certification. Security is reported only as pass/fail; no security score is computed.
Semantic coverage is reported separately as complete, partial, or failed; partial oracle dimensions
remain unresolved and are never counted as matches. A mismatch fails semantic quality, while
incomplete observation is explicitly partial and cannot be described as a complete semantic match.
The report's `quality.status` does not itself certify complete semantic coverage; inspect
`quality.semanticStatus` and each output's `semanticComparison` before interpreting a result. A
failed quality or security check returns a nonzero exit code.

For two local builds, pass both `--before-build <package-root>` and `--after-build <package-root>`.
Each root must contain `package.json` and `dist/index.js`; only trusted local builds should be used,
because their code is imported and executed directly. This evaluator does not sandbox supplied
builds and must not be used to test untrusted code. No source checkout is executed by the static
report viewer. Use a separate disposable checkout to create comparison builds when needed.

Reports use schema `svger-local-evaluation-v2`; v2 adds explicit semantic-coverage status so it
cannot be conflated with the quality-test status. The optional viewer at
[`docs-site/evaluation.html`](../docs-site/evaluation.html) reads only a JSON file explicitly
selected by the user, rejects files over 5 MiB and malformed JSON, validates the versioned report's
required nested data shapes, and renders values with text-only DOM sinks. Report strings are inert;
the viewer does not interpret markup, execute report contents, or send them anywhere. Keep reports
local unless you have reviewed their host metadata before sharing. Reports are unsigned,
self-reported local evidence: schema validation is not proof of evaluator provenance or
authenticity. Comparisons across different reports are descriptive only; hardware, thermal state,
system load, runtime, build identity, and fixture settings can make results non-comparable.

The benchmark is a repeatable fixture-based comparison, not a universal performance claim. The
latest 2026-10-20 Node.js 22.22.2 / npm 10.9.7 run measured 10.086 ms legacy median versus 75.562 ms
opt-in IR median on 750 groups (2,251 elements), about 7.5× slower; p95 was 12.426 ms versus 85.575
ms. Results depend on runtime, host load, fixture shape, compiler/toolchain version, and build
identity.
