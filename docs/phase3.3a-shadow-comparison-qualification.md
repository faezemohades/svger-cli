# Phase 03.3A — Experimental Shadow-Comparison Qualification

Status: Directive 018 harness and qualification tests implemented in the experimental boundary. This
is a comparison mechanism for captured results, not framework shadow generation, production compiler
routing, parser selection, or Phase 03.3B authorization.

## Scope and non-writing boundary

`experiments/phase3/shadow-comparison-harness.mjs` accepts fixture records containing already
captured legacy and candidate runs. It accepts no generator callback, filesystem path for output,
writer, cache, or production service. Its only imports are Node's buffer/crypto primitives and the
versioned experiment contract. It compares in-memory artifact content and returns a report; it does
not write reports, artifacts, snapshots, or baselines. A source-level import contract and spy-based
regression assert that writer/cache hooks are not called and input fixture data is unchanged.

The harness is not a sandbox for untrusted executable candidate code. Any future generator runner
must be a separately reviewed layer and must supply captured results without production writer/cache
access. Timeout and process-failure states are represented as captured run outcomes; the harness
does not launch or terminate subprocesses.

## Version 1 contract and classification

The report schema is `svger-shadow-comparison-v1`. Fixture IDs are restricted and unique; fixtures,
mismatches, diagnostic codes, and artifact records are sorted deterministically. Artifact paths are
represented in reports by SHA-256, and artifact bytes by digest and byte length. Context and
semantic projections are canonicalized and digested; raw source, semantics, artifact bytes, paths,
and diagnostic messages are not returned. Only diagnostic codes matching the bounded `E_*` form are
retained; all other values are replaced with `E_REDACTED`.

The comparison distinguishes non-blocking generated-byte changes from blocking contract failures:

- Blocking: missing legacy/candidate runs or named outputs; invalid results; timeout or runner
  failure; inadequate repeated-run samples or nondeterministic results; security-decision changes;
  output on security rejection; lost text, namespace, reference, or accessibility semantics;
  invalid, mismatched, or unverified framework validity.
- Non-blocking: artifact bytes differ while the compared output remains present and semantic,
  security, determinism, and framework-validity checks agree. The byte delta remains visible for
  review and is not a baseline update.

At least two captured runs per side are required to call a result stable. The run fingerprint covers
outcome, security decision/code, artifact path/content digests, semantic projection digests,
framework validity, and sanitized diagnostic codes. A single sample is never described as
deterministic. A difference in any fingerprint field across repeated samples is classified as
nondeterministic.

The required `semantics` projection has four caller-supplied fields: `text`, `namespaces`,
`references`, and `accessibility`. These are deliberately explicit comparison inputs, not claims
that this harness independently derives or validates SVG semantics. The caller supplies
`frameworkValidity` as `valid`, `invalid`, or `not-checked`; this harness does not invoke native
framework compilers. A future shadow-generation qualification must establish the provenance and
correctness of those projections and validity results.

## Reproducible checks

Run from the repository root after the existing dependency installation:

```sh
node tests/phase3/shadow-comparison-harness.test.mjs
```

The test covers report ordering, repeat-run determinism, byte-only changes, missing named output,
the four semantic categories, security mismatch/rejection output, absent and malformed runs,
timeouts, runner failures, insufficient samples, nondeterminism, framework validation states,
redaction of fake token/source/artifact/diagnostic data, input immutability, and non-invocation of
writer/cache spies. It also checks that the harness has no filesystem/writer/cache imports.

## Limitations and authorization boundary

The harness compares supplied projections and content; it does not establish their semantic
correctness, execute either compiler, produce native compiler diagnostics, measure runtime or
memory, or isolate candidate code. Hashes are comparison evidence, not proof that outputs are safe
or equivalent. The mismatch schema is experimental and not a public API. No snapshots are
automatically updated and no production files, package exports, runtime dependencies, application
cache, or artifact writer are changed. Phase 03.3B framework shadow generation, Phase 03.4
migration, Phase 03.5 default switch, production parser selection, and publishing remain
unauthorized.
