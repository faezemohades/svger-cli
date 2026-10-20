# Phase 03.3B-3 — Independent Svelte Artifact Oracle Qualification

Status: Directive 022 was approved experimentally by Engineering Review 042. Directive 023 now
qualifies a separate bounded source oracle and cross-oracle normalization; see the
[03.3B-4 record](phase3.3b-4-static-source-oracle-qualification.md). The analyzer observes captured
Svelte-JavaScript output independently from source-side IR. It is not a candidate emitter, execution
environment, general SVG analyzer, production parser, or production compiler route.

## 1. Scope and implementation boundary

`experiments/phase3/svelte-artifact-oracle.mjs` analyzes bounded Svelte-JavaScript component text
using the installed `svelte/compiler` parser AST. The module has no filesystem, process, network,
writer, cache, or production-service interface. The capture worker invokes it in the existing
bounded child process after native Svelte compilation. It never evaluates component scripts,
expressions, event handlers, or generated JavaScript.

`shadow-capture-v2` records retain the original source-side IR projection and a separate
`artifactSemanticEvidence` object. That object binds the observation to the artifact SHA-256, the
path SHA-256, analyzer name/version, Svelte parser/version, per-dimension coverage, projection, and
sanitized diagnostic codes. The comparison report uses schema `svger-three-way-artifact-oracle-v1`
and reports three independent edges:

| Edge                | Comparison                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| Source → Legacy     | Source-side IR expectations against the parsed legacy artifact.             |
| Source → Candidate  | Source-side IR expectations against the parsed supplied candidate artifact. |
| Legacy ↔ Candidate | Parsed legacy artifact against parsed candidate artifact.                   |

The report contains projection digests, artifact/path digests, analyzer identity, coverage states,
and bounded mismatch codes only. It does not return SVG source, Svelte source, attribute/text
values, generated JavaScript, or compiler messages. Candidate artifacts remain supplied fixtures; no
candidate implementation is run or identified.

## 2. Supported static projection

The qualified subset requires exactly one unambiguous top-level `<svg>` element and statically
represented markup beneath it. The analyzer records:

- ordered decoded text with effective inherited `xml:space` (`default` or `preserve`);
- SVG expanded-name observations for elements and attributes, including recognized `xml`, `xlink`,
  and XML namespace declarations;
- static attribute values, ordered elements, and attribute sets normalized by expanded name;
- non-empty literal `id` definitions and literal `href`/`xlink:href` edges classified as resolved,
  unresolved, ambiguous, or blocked external;
- literal `role`, `aria-*`, `tabindex`, and `focusable` attributes, plus static SVG `title` and
  `desc` text;
- literal root `viewBox`, `width`, and `height` values, preserving their authored string values.

The source and artifact sides use the same structural projection fields where the evidence is
comparable. Attribute lexical order is ignored; element order and text order are retained. Geometry
is compared as literal root values, not interpreted viewport/rendering behavior.

The following lower coverage and block promotion: any script block, stylesheet, CSS style attribute,
CSS URL reference, Svelte expression or spread, Svelte block/conditional/each/render/raw-HTML node,
event/binding/action/class/style directive, unknown namespace prefix, `foreignObject` namespace
transition, invalid `xml:space`, unsupported node, limit exceedance, parse error, or
ambiguous/missing SVG root. Static observations may still be returned when coverage is partial, but
absence of an observation is never treated as semantic absence.

Parser resource bounds are 4 MiB UTF-8 artifact input, 100,000 observed AST nodes, depth 256, 256
attributes per element, and 100,000 total attributes. In capture use, analysis runs inside the
existing child-process limits: 192 MiB V8 old space, enforced timeout, bounded stdin/stdout/stderr,
and the temporary workspace/guard checks. A large parse that exceeds the outer worker deadline or
output envelope is classified as capture failure, not a successful partial analysis.

## 3. Three-way result and promotion rule

Every semantic dimension carries `complete`, `partial`, or `unresolved` coverage on each side. A
complete, equal pair is `match`; a differing pair is a blocking `mismatch` even when either side is
partial; equal values with incomplete evidence remain `partial` and block promotion. Mismatches are
represented by digest pairs and codes for text, namespace, static-attribute, reference,
accessibility, and geometry changes. Artifact evidence is rejected if its content/path digests,
schema, analyzer identity, parser version, or capture framework/language mode do not match the
captured record.

This prevents two unsafe inferences: a byte change cannot hide a semantic change, and matching
legacy/candidate outputs cannot hide a source-to-legacy loss. Promotion also remains blocked if any
required dimension is not completely established on the relevant edge. The Phase 03.2C IR sidecars
remain partial for references/accessibility; Directive 023 adds a distinct static source oracle for
a bounded syntax subset without upgrading those general-purpose sidecars. Promotion remains
explicitly unauthorized even where all observed fields match.

## 4. Qualification fixtures

`tests/phase3/shadow-capture-qualification.test.mjs` covers:

| Fixture                               | Evidence                                                                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static unchanged Svelte markup        | Svelte compiler accepts it; complete supported static projection matches the expected literal text, namespace, attributes, local reference, accessibility fields, geometry, and `xml:space`. |
| Invalid Svelte script syntax          | Native compiler result is invalid; artifact parser failure is separately recorded with a stable bounded code.                                                                                |
| Dynamic text and reference expression | Svelte syntax may compile, but text/reference coverage is partial and the comparison is non-promotable.                                                                                      |
| Ambiguous multiple SVG roots          | Analyzer returns a partial result and `E_ARTIFACT_AMBIGUOUS_SVG_ROOT`.                                                                                                                       |
| Valid altered component               | Changed circle/path structure, `viewBox`, title, and accessible label produce blocking source-to-candidate mismatches for namespaces, attributes, geometry, text, and accessibility.         |
| Legacy generated Svelte component     | Dynamic props/spread and script cause partial coverage, so successful compilation does not imply static semantic completeness.                                                               |

The existing Phase 03.3A comparison remains available for artifact-byte, framework-validity, and
security comparisons. The new `artifactOracle` report is an additional independent result, not a
replacement for those contracts. Tests also verify that report JSON excludes the fixture source and
altered artifact content, and that the analyzer source itself has no filesystem, process, network,
write, or code-evaluation interfaces.

## 5. Known limits

This is intentionally a static subset. It does not prove browser DOM behavior, CSS cascade, external
stylesheet effects, rendering/pixel equivalence, accessible-name computation, assistive technology
behavior, Svelte runtime behavior, or equivalence of dynamic expressions. CSS `url(#id)` is not
interpreted; its evidence remains partial. Namespace transitions into foreign content remain
unresolved. The separately qualified source oracle handles static local-reference/ARIA-IDREF syntax
only within its declared grammar; it does not upgrade the broader Phase 03.2C sidecars or establish
browser resource/accessibility semantics.

The Svelte parser's AST is used only as a parser result. The analyzer does not invoke `compile()`
for semantics, execute output, resolve resources, or serialize a replacement document. Native
compiler success remains a separate fact. The existing same-user Node child is not an OS sandbox and
is not authorization to run arbitrary candidate code.

## 6. Reproduction and verification record

From the repository root with the existing lockfile installation:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts \
  --outDir experiments/phase3/.build --rootDir experiments \
  --module ES2022 --moduleResolution Bundler --target ES2022 --strict \
  --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node tests/phase3/shadow-capture-qualification.test.mjs
node tests/phase3/shadow-comparison-harness.test.mjs
```

Target runtime: Node 20.20.2; Svelte parser/compiler: 4.2.19. The full-quality and package
conformance checks passed on 2026-10-19 after the final prototype/test changes. `quality:full`
passed, including fast quality checks, privacy, Jest, Phase 00, Phase 01, and package smoke. The
lint budget remained at 0 errors and 14/14 approved warnings. Package smoke and standalone archive
conformance both measured 754 files and 634,361 compressed bytes, 6,262 bytes below the 640,623-byte
ceiling. The parser qualification, parser-to-IR differential, shadow-comparison harness, and
capture/oracle suites also passed. `git diff --check` and final formatting checks are recorded after
documentation is finalized. These local results do not establish clean-checkout CI, management
acceptance, or promotion eligibility.

## 7. Authorization boundary

Directive 022 authorized only this bounded Svelte-JavaScript static artifact-analysis prototype and
its experimental three-way comparison; Engineering Review 042 accepted that work. Directive 023 adds
only the source-side static subset and parity qualification recorded separately. Neither directive
authorizes another framework runner, candidate emitter, untrusted-code execution, production route,
optimizer change, dependency, public API, package export, promotion, or publishing action. Broader
shadow generation requires a new gate and OS-level candidate containment review.
