# Phase 03.3B-2 — Oracle Coverage and Native Validation Design

Status: Directive 021 design and fixture qualification. No complete semantic analyzer, new framework
runner, candidate emitter, production compiler route, dependency, or public API is added. Candidate
artifacts remain explicitly supplied fixtures; the Svelte-JavaScript compiler path is used only for
controlled validation experiments.

This document records the pre-Directive 022 design assessment. The candidate-artifact oracle gap
described below was addressed experimentally under Directive 022 and accepted by Engineering Review
042; Directive 023 separately qualifies a bounded source oracle and projection parity. See the
[03.3B-3 record](phase3.3b-3-artifact-oracle-qualification.md) and
[03.3B-4 record](phase3.3b-4-static-source-oracle-qualification.md) for current evidence.

## 1. Semantic coverage inventory

The source-side projection is produced by admission, the experimental Saxes adapter, and the Phase
03.2C XML-to-IR-v1 lowerer. Its coverage labels describe what this implementation records; they do
not establish what a generated artifact preserves.

| Dimension                 | Established from admitted source today                                                                                                       | Requires additional interpretation                                                                                                                                | Must remain unresolved / promotion-blocking                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Text and mixed content    | Ordered text and CDATA values with node paths; comments remain represented in the IR but are omitted from the text projection.               | Framework escaping and whether a target consumer exposes the same text; `xml:space` inheritance is present in IR but is not projected as rendered text semantics. | Rendering equivalence, whitespace normalization across each framework, and text hidden or introduced by framework code. |
| Namespaces                | Expanded namespace URI and local name for projected elements and attributes; qualified names remain available in the IR.                     | Whether the framework output preserves namespace declarations, SVG integration points, and foreign content.                                                       | Browser DOM namespace behavior for emitted output and any namespace change made by a candidate emitter.                 |
| IDs                       | Non-empty unprefixed `id` definitions and node paths are recorded; duplicate definitions remain visible.                                     | Full document-wide ID uniqueness, ID rewriting, and references from every SVG/CSS syntax.                                                                         | Whether unrecognized extension content or generated framework code introduces collisions.                               |
| References                | `href` and `xlink:href` occurrences are recorded and classified as resolved, unresolved, ambiguous, or blocked external using collected IDs. | CSS `url(#id)`, `clip-path`, masks, filters, paint servers, style attributes/sheets, ARIA IDREF lists, and references in unknown/foreign vocabularies.            | Any reference kind outside the narrow collected href subset; do not infer “unused” from absence in this projection.     |
| Accessibility             | Selected `aria-*`, `role`, `tabindex`, and `focusable` attributes plus SVG `title`/`desc` text are recorded.                                 | Namespace-aware attribute identity, ARIA IDREF resolution, accessible-name/description computation, focus behavior, and framework prop forwarding.                | Actual accessibility tree equivalence and assistive-technology behavior.                                                |
| Geometry / visual         | Root geometry values remain in the IR as opaque lexical values where present.                                                                | `viewBox`, unit parsing, viewport defaults, aspect-ratio behavior, CSS cascade, and rendered geometry.                                                            | Pixel or layout equivalence from source projection alone.                                                               |
| Styles and CSS references | Style text and presentation attributes remain structurally available in the IR.                                                              | CSS tokenization, selectors, cascade, inheritance, custom properties, `!important`, and URL resolution.                                                           | Any semantic claim for CSS constructs not parsed by a separately qualified CSS analyzer.                                |

The current sidecars explicitly mark IDs/references and accessibility as partial. A dimension may be
called complete only after the accepted grammar is enumerated, every relevant reference producer is
covered, namespace identity is enforced, malformed/duplicate/unresolved cases are represented, and
the evidence is tested against independent fixtures. Unsupported syntax produces `unresolved` or
`opaque`; it is never silently treated as absent or irrelevant.

## 2. Independent-oracle contract

Native compilation establishes that an artifact is accepted by a particular compiler version. It
does not establish SVG semantic equivalence. Source-derived projections are one side of the oracle
only and must not be copied onto candidate records and then compared as though they described the
candidate artifact.

A future candidate-output analyzer must meet this contract before candidate equivalence can be
considered:

1. Bind each result to the exact artifact path/content digest and the compiler/runtime identity.
2. Parse the generated artifact with a framework-aware parser, locate the emitted SVG content, and
   extract its own ordered text, namespace-aware elements/attributes, IDs/references, accessibility
   attributes, and geometry/style observations. It must not receive the source-side projection as
   input or reuse its derived values as candidate evidence.
3. Normalize only reviewed representational differences (for example, framework escape syntax) while
   retaining an auditable raw digest. Unknown or unsupported syntax lowers coverage instead of being
   discarded.
4. Compare source expectations to legacy-output analysis and candidate-output analysis separately.
   Report each edge independently: `source → legacy`, `source → candidate`, and
   `legacy ↔ candidate`. A match between two artifacts cannot erase a source-to-output loss shared
   by both.
5. Label every semantic field with `complete`, `partial`, or `unresolved` coverage and record the
   analyzer method/version. Missing evidence, analyzer disagreement, parse failure, ambiguous
   extraction, or unsupported constructs block promotion.
6. Keep compiler validity and semantic analysis as separate evidence dimensions. A valid compile
   with lost text, IDs, references, geometry, or accessibility remains a semantic mismatch.

The existing `captureCandidateFixture()` does not yet satisfy this contract: it derives semantic
evidence from the original SVG source and attaches that same evidence to the supplied artifact. The
semantically altered Svelte fixture below makes this limitation executable. The comparator reports a
byte change, but does not independently discover the changed circle, `viewBox`, title, or accessible
label. That result is explicitly non-promotable and is a test of the current limitation, not a pass
for semantic equivalence.

## 3. Native framework validation matrix

Versions below are the locked/direct qualification toolchain observed on Node 20.20.2: TypeScript
5.9.3, Babel parser 7.29.7, Vue compiler-sfc 3.5.13, Svelte 4.2.19, and Angular compiler/core
17.3.12. Existing Phase 00 generator tests use some of these for syntax, template, or TypeScript
checks; that does not mean the Phase 03 capture harness has qualified a native runner for them.

| Framework    | Emitted modes                       | Existing local check / version                                                                                                                                | Required native acceptance fixture before shadow qualification                                                                                                                                |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React        | JSX and TSX                         | Babel parser 7.29.7; TypeScript 5.9.3 with test shims. No React runtime/type package is installed.                                                            | JS and TS consumer builds with React JSX runtime and real React types; compile SVG props/refs, accessibility props, and nested text.                                                          |
| Preact       | JSX and TSX                         | Babel parser 7.29.7; TypeScript 5.9.3 with test shims. No Preact runtime/type package is installed.                                                           | Preact JSX transform and consumer typecheck with real Preact types; verify SVG attributes, text, and component props.                                                                         |
| Solid        | JSX and TSX                         | Babel parser 7.29.7; TypeScript 5.9.3 with test shims. No Solid compiler/runtime is installed.                                                                | Solid compiler transform plus consumer typecheck; verify SVG namespace, reactive/component wrapper, text, and accessibility output.                                                           |
| Vue          | `.vue` with JS or TS script mode    | `@vue/compiler-sfc` 3.5.13 and TypeScript 5.9.3 in Phase 00 tests. Capture path remains `not-checked`.                                                        | Full SFC parse, script compile/typecheck, template compile, and consumer build for both modes; fixtures include template directives, props, SVG text, and accessibility.                      |
| Svelte       | `.svelte` with JS or TS script mode | Capture worker runs `svelte/compiler` 4.2.19 for JS. Phase 00 has a separate TypeScript preprocessing fixture; capture TS mode is unverified.                 | Preserve current JS compile success/failure coverage; separately qualify the exact TS preprocessor and typecheck. Fixture covers nested SVG text, references, `xml:space`, and accessibility. |
| Angular      | TypeScript `.component.ts` only     | `@angular/compiler`/`core` 17.3.12, TypeScript 5.9.3 template parsing/type checks with shims. Capture currently crashes for JS mode and leaves TS unverified. | Angular compiler-cli/AOT consumer fixture with Angular-compatible TypeScript pinned from peer requirements; compile generated component and template. No JS mode is claimed.                  |
| Lit          | JS and TS                           | Babel parser 7.29.7; TypeScript 5.9.3 with Lit declaration shims. Lit itself is not installed.                                                                | Browser-capable consumer build with pinned Lit and real types; verify tagged-template SVG interpolation, styles, attributes, and accessibility.                                               |
| Vanilla      | JS and TS                           | Babel parser 7.29.7 for JS; TypeScript 5.9.3 semantic check for TS.                                                                                           | Native Node/browser module parse for JS and strict TypeScript consumer build for TS; verify exports and emitted markup.                                                                       |
| React Native | JSX and TSX                         | Babel parser 7.29.7; TypeScript 5.9.3 with `react-native-svg` shims. Native packages/Metro are not installed.                                                 | Metro consumer bundle with pinned React Native and react-native-svg versions, plus real typings; test supported SVG primitives, text, and prop forwarding.                                    |

“Native” means the framework's own parser/compiler or supported consumer build with real framework
packages, not only Babel syntax parsing or TypeScript declarations invented by a test shim. Each
runner must identify exact tool versions, Node version, language mode, fixture digests, diagnostics,
timeout/resource bounds, and whether it typechecked, compiled, bundled, or executed. Execution and
visual/browser behavior are separate gates. No runner/dependency is added under Directive 021.

## 4. Svelte JavaScript fixture qualification

The existing bounded worker and exact installed `svelte/compiler` 4.2.19 are used without adding a
runner. The Phase 03.3B-1 test now covers three controlled cases:

| Case                                  | Input to native compiler                                                                      | Expected observation                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid output                          | Exact artifact from a successful legacy Svelte-JS capture, supplied back as a fixture         | `valid`; compiler identity is Svelte 4.2.19; this validates syntax only.                                                                      |
| Invalid output                        | `<script>const = ;</script><svg/>`                                                            | `invalid` with bounded `E_FRAMEWORK_COMPILE`; failure remains blocking.                                                                       |
| Semantically altered but valid output | Svelte markup changes viewBox, shape, title, and accessible label while remaining well-formed | `valid` plus artifact-byte-change; no semantic mismatch is inferred from source-only evidence; promotion remains blocked by partial coverage. |

The third case is intentionally a negative oracle-coverage demonstration. It does not assert that
the changed candidate is equivalent or that current tooling correctly detects its semantic loss.

## 5. Future candidate isolation requirements

The current fixed legacy worker is not a safe execution boundary for untrusted candidate code.
Before executing any candidate emitter, a separately approved design must require, at minimum:

- an ephemeral OS-level sandbox/container or VM under a dedicated unprivileged identity, with no
  access to the developer home, repository credentials, SSH/GPG agents, registry tokens, CI sockets,
  or host process namespace;
- read-only source/toolchain mounts, a fresh bounded writable scratch mount, no access to configured
  output directories/caches, and verified path/symlink/hardlink containment;
- network egress denied by default, with no DNS or metadata-service access; any exception must be
  explicit, allowlisted, and separately reviewed;
- exact lockfile toolchain installed before execution and mounted read-only; no package manager,
  install scripts, dynamic dependency fetch, or host-global module lookup inside the candidate run;
- OS-enforced memory/RSS, CPU, process-count, file-count, file-size, disk, and wall-clock limits;
  kill the complete process tree on timeout and verify cleanup;
- bounded framed input/output channels, output path allowlists, sanitized environment, no inherited
  file descriptors, redacted diagnostics, and atomic classification of crash/timeout/escape
  attempts;
- adversarial containment tests for path traversal, symlink/hardlink escape, child-process escape,
  network access, resource exhaustion, and cleanup failure before any candidate implementation is
  run.

Node heap flags and same-user child processes are defense-in-depth only. Caller-supplied guard paths
and temporary working directories do not establish containment. No candidate code is authorized or
executed by this directive.

## 6. Reproduction and qualification result

From a clean build with the repository lockfile:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts \
  --outDir experiments/phase3/.build --rootDir experiments \
  --module ES2022 --moduleResolution Bundler --target ES2022 --strict \
  --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node tests/phase3/shadow-capture-qualification.test.mjs
```

Recorded environment: Node 20.20.2; Svelte compiler 4.2.19. The test requires two legacy Svelte-JS
captures, a valid supplied capture, an invalid supplied capture, and two semantically altered valid
supplied captures. It verifies the altered case is reported as a byte change while remaining
non-promotable because source projection coverage is partial and candidate-output semantics are not
independently derived. It does not run a candidate emitter or add framework validation paths.

## 7. Exit status and next gate

Directive 021 design and fixture requirements are complete within their authorization. Open gates
remain candidate-output semantic analysis, complete references/accessibility interpretation, and
native validation for the framework/language matrix above. Before broader shadow generation, a
separate directive must authorize implementation of the independent artifact oracle and any
additional test-only compiler dependencies, define the coverage that qualifies for promotion, and
review OS-level candidate containment. Full Phase 03.3B emission, Phase 03.4/03.5, production parser
selection, production routing, public API changes, and publishing remain unauthorized.
