# Phase 04.1 — Experimental Svelte-JavaScript IR Emitter

Status: Directive 029 implementation accepted by Engineering Review 049. The emitter remains a
trusted local prototype, not a production compiler route or portable candidate attestation. Its
original static-only state is recorded here; Directive 030's compatibility work is tracked in
[Phase 04.2A](phase4.2a-svelte-component-compatibility.md).

The findings below describe the Phase 04.1 baseline before Directive 030; where they say props are
unsupported or tests are standalone, those statements are historical and are superseded by the Phase
04.2A qualification record.

## Scope and contract

`experiments/phase4/svelte-js-ir-emitter.ts` accepts an IR v1 value, validates/copies/freezes it
using the existing IR validator, verifies the static subset, and returns a deterministic `.svelte`
artifact. It is not imported by `src/`, package exports, the CLI, service, integrations, cache, or
transactional writer. The emitter does not read or write files and does not invoke a sandbox. The
input fixtures are admitted through the existing security boundary and lowered with the experimental
Phase 03 parser/IR path before they reach the emitter.

The emitted component is JavaScript-mode Svelte markup with no generated TypeScript or dynamic
bindings. It preserves source-ordered static attributes/children, text and CDATA character data,
comments inside the SVG root, SVG namespace identity, `xml:space`, `xlink:href`, local `href`
references, IDs, and static ARIA metadata. Namespace declarations are emitted in a canonical SVG
form; xlink is included only when used. XML character data that resembles a Svelte `{expression}` is
entity-escaped so it remains literal text. Output is compact so the emitter does not insert
whitespace between mixed-content nodes.

This is deliberately a static component, not yet a drop-in replacement for the legacy Svelte
component API: the legacy generator exposes props such as `className`, `style`, `width`, `height`,
`fill`, and `stroke`, while this prototype emits source attributes as static markup. Runtime prop
compatibility is not claimed. The legacy generator remains unchanged and authoritative.

The accepted subset is intentionally strict. Unknown/foreign elements, generated nodes, document-
level comments, unresolved or duplicate IDs, non-local hrefs, unresolved ARIA IDREFs, CSS `url()`
references, unsupported namespace attributes, Svelte directive-like attributes, invalid XML
characters, and unresolved `xml:space` fail explicitly. Validation errors use `E_SVELTE_IR_INVALID`;
unsupported constructs use `E_SVELTE_IR_UNSUPPORTED`; reference defects use `E_SVELTE_IR_REFERENCE`;
and source/output ceilings use `E_SVELTE_IR_LIMIT`. Artifact output is bounded to 16 MiB, and
accepted IR source is capped at the existing 10 MiB admission ceiling.

The source and artifact oracles remain independent checks. The emitter does not import either
oracle, assert its own semantic validity, or claim promotion eligibility. No capture envelope is
forged to label this direct in-process prototype as sandbox-generated output.

## Differential evidence

The regression starts with an admitted SVG fixture, lowers it to validated IR v1, emits the
candidate, and checks it through Svelte 4's native compiler and the existing static source/artifact
oracles. The candidate artifact has complete, valid analysis, and all six declared projection
dimensions equal the source projection for the primary fixture. Additional fixtures cover literal
brace escaping, canonical namespace output, and local xlink references.

The legacy generator is run on the same source and its output is also compiled and analyzed. Legacy
and candidate projections agree on observed text values and order, but differ in effective
`xml:space`: the candidate preserves inherited `preserve` and the nested `default` override while
the legacy output loses the inherited mode. Legacy artifact coverage is partial for namespaces,
attributes, references, accessibility, and geometry because its prop-driven markup is not statically
understood by the current artifact oracle. Its observed accessibility projection differs from the
candidate/source projection: the candidate retains static `role` and `aria-labelledby` metadata
while the legacy wrapper does not emit those source attributes in its current output. These are
concrete compatibility differences, not a promotion result. The candidate's static-only prop
behavior is also an acknowledged difference requiring a later, framework-specific design decision.

Negative tests assert explicit failure for malformed IR, unknown elements, dangling and duplicate
IDs, CSS URL references, and an output limit violation. A 750-path workload records generation time,
output size and a process heap delta for local observation; there is no environment-sensitive
performance threshold. The emitter streams escaped markup into a bounded chunk buffer so output
growth stops at the configured ceiling rather than constructing an arbitrarily large final string.

## Reproduction

From the repository root, after installing the existing lockfile dependencies and building `dist/`:

```sh
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts \
  experiments/phase4/svelte-js-ir-emitter.ts \
  --outDir experiments/phase4/.build --rootDir experiments \
  --module ES2022 --moduleResolution Bundler --target ES2022 --strict \
  --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node tests/phase4/svelte-js-ir-emitter.test.mjs
```

The suite depends on the existing `dist/` build for the public processor and mandatory admission
path. It does not install dependencies or use the sandbox feasibility boundary.

## Verification status and limitations

On 2026-10-19 under Node 20.20.2, the experimental TypeScript compilation and Phase 04.1 test
passed. The 750-path workload reported approximately 22 ms generation time, 32,936 output bytes, and
a 3.4 MB process heap delta in the final focused run; these values are informational and
host-specific, not thresholds. `npm run quality:full` passed, including the existing Phase 00 and
Phase 01 suites and package smoke. `npm run test:phase2:parser`, all three existing Phase 03
parser-to-IR/comparison/capture suites, and `npm run package:conformance` also passed. Archive
conformance reported 754 files and 634,361 packed bytes, within the existing 640,623-byte ceiling.
Prettier and `git diff --check` passed on the final changed implementation/test/document files.

The Phase 04.1 test is an explicit command and is not yet wired into `quality:full`; it was run
separately after the final formatting pass. No new package script or manifest change was needed.

No production source, package exports, runtime dependencies, output routes, or persistent caches
changed. Candidate bytes are never written to a production destination. The prototype does not
provide runtime prop compatibility, CSS cascade interpretation, browser rendering proof, dynamic
Svelte syntax, framework expansion, isolated execution, or a portable signed provenance envelope.
Phase 04.2 framework expansion, Phase 04.3 production integration, and later stabilization/release
work remain outside Directive 029.
