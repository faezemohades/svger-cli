# Phase 03.0 — Compiler Architecture Specification and Migration Plan

Status: approved Phase 03.0 baseline (Engineering Review 032); Directive 012 is closed. This
document specifies boundaries and a future implementation sequence only. It changes no production
code and does not authorize an SVG Semantic Model implementation, Compiler IR implementation, parser
integration, framework-adapter rewrite, public API change, or optimizer reactivation. Phase 03.1
design is authorized separately under Directive 013.

Phase 02 is technically certified for experimental parser qualification. Its production-parser
decision remains **none selected**. The parser contract is an architectural boundary, not an
approved runtime implementation. This specification is based on Phase 02 evidence and the local
Phase 02 preservation commit `cb933c6`; it does not assert remote review or repository-governance
certification.

## 1. Purpose and design decisions

The current compiler has a stable application orchestration path, but many generation and
transformation operations still consume SVG source strings. Structural optimizer utilities use a
separate limited custom tree. The purpose of Phase 03 is to define a future route from admitted SVG
source through explicit semantic and compiler representations to framework output, while preserving
the existing public behavior during any later migration.

The intended boundaries are:

```text
Untrusted bytes
      │
      ▼
Input decoding and mandatory SVG security admission
      │ Admitted source
      ▼
XML parser adapter (implementation selected by a separate gate)
      │ ordered XML document + source locations
      ▼
SVG semantic interpretation
      │ SVG semantic model
      ▼
Versioned, parser-independent Compiler IR
      │ deterministic transformation passes
      ▼
Framework adapters and emitters
      │ planned artifacts
      ▼
Existing transactional artifact writer
```

Key design decisions for future review:

- Security admission remains before parser construction, semantic interpretation, cache lookup based
  on admitted content, and all framework generation. No parser or IR layer replaces the scanner's
  security role.
- XML syntax, SVG meaning, compiler-specific normalized values, and framework output are distinct
  representations. A framework adapter must not need to understand parser-specific nodes.
- The original admitted source remains the lexical authority whenever source fidelity, source maps,
  diagnostics, or localized edits matter. A decoded tree is not a source-preserving serialization.
- New passes are explicit and deterministic. A pass must name the semantic invariant it preserves
  and must not silently enable a legacy optimizer.
- The public CLI, service, integration, and package contracts remain stable during initial
  migration. Any intended change is separately classified and reviewed under existing compatibility
  policy.
- Parser selection remains deferred. Phase 02.6's `XmlParser` contract is a proposal boundary and
  does not imply that a production implementation exists.

## 2. Current architecture inventory

The following describes the current code paths, not a desired runtime redesign.

| Area                                    | Current evidence                                                                                                                                                                                                                                                                  | Consequence for migration                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compiler construction and public facade | `createSVGCompiler()` creates scoped configuration, processor, cache, and application service. CLI and legacy builder delegate to this path.                                                                                                                                      | Retain this as the public application boundary; add compiler internals behind it only after a separate implementation gate.                                                       |
| Build orchestration                     | `SVGCompilerApplicationService` resolves configuration, discovers sources, computes output names/collisions, reads and admits files, checks cache, calls `SVGProcessor`, then plans/commits artifacts.                                                                            | Keep discovery, configuration, cache, diagnostics, and transaction ownership out of SVG semantics and framework emitters.                                                         |
| Input security                          | `readSVGInputFile()` enforces bounded UTF-8 decoding. `applySVGInputSafety()` performs admission and returns a string. Safety is also applied in service and integration paths.                                                                                                   | Preserve all entrypoint coverage. A future typed admission value must be created only by the runtime security authority; the Phase 02 type-only brand is not runtime enforcement. |
| Component generation                    | `SVGProcessor.generateComponent()` and `FrameworkTemplateEngine` accept source strings. The template engine extracts root attributes and inner markup, then framework-specific methods construct React/Preact/Solid, Vue, Svelte, Angular, Lit, Vanilla, and React Native output. | All frameworks currently depend on a shared source-string contract; inventory their observed output before replacing that contract.                                               |
| Framework-specific transforms           | JSX-family output applies source-level attribute/style conversions. Framework template construction also handles root dimensions, default values, markup escaping, and selected whitespace normalization; root `xml:space="preserve"` changes whitespace handling.                | Classify each transformation as semantic, framework-specific, or lexical before moving it. Preserve framework output contracts and test generated code with native compilers.     |
| Lexical XML transforms                  | `xml-attribute-transform.ts` applies bounded source-local attribute transformations. Basic cleaning and numeric formatting use source-level transforms.                                                                                                                           | These may remain source edits initially; do not force a whole-document serialize/parse round trip.                                                                                |
| Structural optimizer utilities          | `svg-tree-parser.ts` is a limited custom SVG tree used by optional tree/path/style/transform optimizer modules and serializers. The normal `SVGProcessor` pipeline registers basic cleaning and numeric transformation; it does not automatically register all tree-based stages. | Treat optional optimizer behavior as separately gated compatibility work. Do not reactivate it as a side effect of adopting an IR.                                                |
| Diagnostics and artifacts               | Diagnostics have stable codes and redaction; build planning handles naming, export contracts, collisions, deterministic artifact paths, and transactional output.                                                                                                                 | Keep these application concerns downstream of generation and preserve their current contracts.                                                                                    |

The inventory shows that “generator” is not a set of independent parser consumers: framework output
is centralized in one template engine, while security admission, string transformations, and
optional tree optimizers are separate concerns. Migration tests should therefore compare by public
entrypoint and framework, not just by an internal template method.

## 3. Proposed representation boundaries

These are design responsibilities, not production types to add under this directive.

### 3.1 Admitted source

Represents exact UTF-8-decoded source that has passed the mandatory security policy. It retains the
exact immutable JavaScript string, byte length, source identity, and admission-policy version. The
runtime factory must remain owned by the security boundary. A TypeScript brand can reduce accidental
misuse but cannot replace runtime validation or protect against deliberate casts.

Admission owns invalid-encoding, size, XML lexical well-formedness policy, DTD/entity rejection,
active-content and external-reference policy, CSS admission, and configured input ceilings. Its
diagnostics retain existing stable public error codes. `strip` behavior, when explicitly requested,
must produce a newly admitted safe string and report the existing warning behavior; it must not
allow unsafe original text to proceed into parsing.

### 3.2 XML document

Represents XML syntax without SVG-specific interpretation: one root element, source-ordered
attributes and children, distinct text/CDATA/comment nodes, expanded namespace names plus original
qualified spelling, and explicitly typed source spans. Parser cursors are diagnostic positions, not
edit ranges. The implementation must satisfy the Phase 02 contract and a later parser-selection gate
before production use.

This layer must not apply framework rules, discard text as formatting, infer SVG viewport behavior,
or serialize the document as a substitute for original source. Parser diagnostics are sanitized and
failures are atomic.

### 3.3 SVG semantic model

Interprets the XML document under SVG and XML semantics. It is responsible for relationships and
meaning that cannot safely be inferred from a tag-name string alone, including:

- expanded SVG/XML namespace identity, inherited `xml:space`, and ordered mixed content;
- root viewport attributes, dimensions, `viewBox`, and preserve-aspect-ratio values without
  confusing lexical spelling with interpreted values;
- identifier definitions and reference edges (`href`, `xlink:href`, URL-valued presentation/CSS
  properties), with unresolved and external references represented explicitly rather than silently
  rewritten;
- presentation attributes, inline styles, embedded style rules, CSS custom properties, cascade
  ordering, and `!important` preservation where a pass relies on style meaning;
- accessibility-relevant title/description nodes, `aria-*`, role, focus, and metadata content;
- text, CDATA, comments, and whitespace preservation sufficient for the relevant output contract.

Unknown elements, attributes, CSS values, and namespace extensions should remain opaque and
preserved unless a reviewed pass proves a transformation safe. Semantic interpretation must not
mistake “not understood” for “unused.”

### 3.4 Compiler IR

The Compiler IR is an internal, versioned, parser-independent representation of the subset of SVG
semantics required by compiler passes and framework adapters. It is not the XML parser's AST and is
not a public package type. Its schema should distinguish:

- ordered element and text content, including preserved opaque/foreign content;
- expanded names and original names where output compatibility requires qualified spelling;
- source provenance for nodes and attributes (raw spans only when qualified), plus generated-node
  provenance;
- logical values from original lexical forms when normalization or edits could lose information;
- definitions and reference relationships without assuming that every reference is resolvable;
- accessibility and styling data without prematurely flattening cascade or deleting source nodes.

IR versioning must be explicit. In-memory construction should validate the version and required
invariants. Persistent cache serialization is out of scope until schema stability, invalidation,
security, and compatibility rules are separately approved. Do not equate parser package version with
IR version.

### 3.5 Passes, adapters, and artifacts

Transformation passes consume a documented IR version and return a new value or an owned immutable
result. Each pass declares determinism, supported constructs, diagnostics, whether it can add/remove
nodes, whether it needs references/styles resolved, and which invariants it preserves. Source-local
edits must be expressed against retained original source spans and checked for range validity and
overlap. A whole-tree serializer is not implicitly source-preserving.

Framework adapters consume IR, framework options, and language settings. They own framework syntax,
escaping, imports, component props, and output extension, but not filesystem paths, output collision
policy, or transaction handling. Existing artifact contracts remain authoritative. Emitted files
then return to the existing application artifact plan and transaction writer.

## 4. Semantic invariants

The following are mandatory compatibility constraints for any future implementation. Tests should
link each invariant to each consumer or pass that may affect it.

| Invariant              | Required behavior                                                                                                                                              | Minimum future evidence                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Security admission     | Every public input route admits before parse/generation; no direct raw-string parser bypass; reject and explicit strip modes preserve established diagnostics. | Entrypoint matrix across CLI, public service, processor, and integrations; hostile corpus; no artifact on reject.      |
| Namespace identity     | Semantic matching uses namespace URI plus local name; original QName and declarations remain available for output/fidelity.                                    | Default/prefixed namespace, unprefixed-attribute, `xml`, and `xlink` fixtures; parse and generated-output checks.      |
| Ordered mixed content  | Text, nested elements, CDATA, and comments retain their order; adjacent text is not normalized without an explicit semantics-aware pass.                       | Mixed text/tspan/CDATA/comment fixtures with text extraction and framework output comparisons.                         |
| Whitespace             | Never globally trim text; apply inherited `xml:space`; distinguish XML normalization from formatting whitespace and framework escaping.                        | `xml:space="preserve"` inheritance/override fixtures, line endings, leading/trailing text, framework native compilers. |
| Style semantics        | Do not reorder or flatten styles unless cascade, specificity, custom properties, and `!important` are accounted for.                                           | Inline/presentation/style-sheet precedence tests, custom property references, namespaced selectors where supported.    |
| References and IDs     | Preserve identifier spelling and graph edges; do not remove or rename a definition until all local references and external-reference policy are considered.    | `href`, `xlink:href`, `url(#id)`, duplicate/unresolved IDs, style references, hostile external URLs.                   |
| Accessibility          | Preserve title/description, `aria-*`, role, focus and relevant metadata unless an explicit reviewed option says otherwise.                                     | Output assertions and accessibility-attribute corpus across all framework adapters.                                    |
| Lexical/source mapping | Raw spans address the exact retained source in UTF-16 units with exclusive end; parser cursors are not edit ranges; unknown spans are absent, not guessed.     | CRLF, LF, surrogate pairs, entities, comments, attributes, CDATA, malformed locations, edit overlap.                   |
| Determinism            | Same input, options, package versions, and adapter produce byte-identical artifacts and stable diagnostics.                                                    | Repeat builds, reordered discovery inputs, all supported language modes, cache-on/off equivalence.                     |
| Failure atomicity      | Invalid input or failed transformation emits no partial document or artifact; diagnostics do not leak source snippets or secrets.                              | Failure injection at admission, parser, semantic model, pass, adapter, and transaction boundaries.                     |

“Pixel equivalent” alone is insufficient: text extraction, DOM/accessibility behavior, CSS cascade,
component props, output naming, generated language validity, and source diagnostics are observable
compatibility surfaces.

## 5. Determinism, ownership, and resource lifecycle

- A build owns each file's admitted source, parsed document, semantic model, and IR result. Results
  are immutable after publication to the next stage; mutable builders, if any, are stage-local.
- Parser state is per invocation. No process-global current document, mutable configuration, or
  source-bearing diagnostic cache is permitted.
- Cache keys must include admitted content plus all semantic/compiler/framework/language/IR/pass
  version inputs that affect generated bytes. Cache hits must not bypass admission or compatibility
  checks.
- Existing file discovery, bounded scheduler, cache, artifact collision policy, abort behavior, and
  transactional writes remain application-service responsibilities.
- Phase 02 measurements are single-document, host-specific reference data. They do not set a
  concurrent memory budget. Any implementation proposal must measure parser + semantic model + IR
  simultaneously, source retention, cleanup, and concurrent in-flight builds on supported Node
  versions.
- A future concurrency budget must state max in-flight file count, maximum admitted source bytes,
  per-file representation lifetime, cancellation points, and total memory envelope. It may not be
  obtained by multiplying a standalone parser heap estimate and presenting it as validated.
- Synchronous parser cancellation limits remain as recorded in Phase 02. Async/chunked processing,
  worker isolation, or long-lived IR caches require new design and tests.

## 6. Incremental implementation plan (future gate required)

Directive 012 authorizes this plan, not execution of its implementation phases.

| Future step                           | Intended activity                                                                                                                                             | Exit evidence / authorization boundary                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03.0 — Architecture specification     | Record boundaries, invariants, existing dependencies, lifecycle, compatibility strategy, and open decisions.                                                  | This document reviewed and approved; no production code changed.                                                                                                        |
| 03.1 — Schema and consumer design     | Under a new explicit gate, detail IR nodes/value domains and map every framework transform, optimizer, and public output behavior to the proposed boundaries. | Schema review, traceability matrix, golden fixture inventory, parser-decision dependency explicitly resolved or a parser-independent design exception approved.         |
| 03.2 — Isolated conformance prototype | Only if separately authorized: test a candidate/parser adapter and IR mapping outside default production routing.                                             | Exact parser version, strict malformed-input and security evidence, semantic/source differential results, native framework compilation, resource/lifetime measurements. |
| 03.3 — Shadow generation              | Only after an implementation gate: compare legacy and proposed output without writing proposed artifacts.                                                     | Deterministic reports classify byte differences, semantic differences, and intentionally accepted changes; no silent output path switch.                                |
| 03.4 — Opt-in consumer migration      | Migrate one consumer/framework at a time behind an explicit configuration/feature boundary.                                                                   | Existing CLI/service/integration contracts pass; generated artifacts compile; semantic and visual/accessibility corpora pass; rollback path demonstrated.               |
| 03.5 — Default switch and cleanup     | Only after separate approval: select defaults and retire superseded paths.                                                                                    | Versioned compatibility decision, migration/deprecation record, package checks, full quality gates, clean-checkout CI and maintainer approval.                          |

No 03.1–03.5 implementation step begins automatically when this document is accepted. In particular,
the unresolved production parser selection remains a blocking dependency for any production route
that uses the proposed XML parser boundary.

## 7. Compatibility and test strategy

The migration oracle is layered rather than a single snapshot:

1. **Admission:** reuse Phase 00 security corpus and entrypoint matrix; assert exact established
   diagnostic codes and no output side effects.
2. **XML/source:** reuse Phase 02 accepted/rejected fixtures and add only cases needed by a reviewed
   parser decision; compare ordered nodes, expanded names, raw spans, and original-source slices.
3. **SVG semantics:** add semantic fixtures for dimensions/viewBox, text and whitespace, style
   cascade, IDs/references, accessibility, unknown extension content, and invalid-but-admitted edge
   cases.
4. **Generators:** exercise each framework and TS/JS mode through public generation/service paths;
   validate outputs with target compilers/parsers, not only string snapshots.
5. **Artifacts:** reuse public package/artifact contracts for filename, extension, exports,
   collision diagnostics, source maps if later supported, deterministic bytes, and transactional
   writes.
6. **Integration and release:** repeat security checks through CLI, service, Webpack, Vite, Rollup,
   Babel, Next.js, and Jest surfaces; run full quality and package conformance on a clean checkout.

Golden output snapshots remain useful for byte stability but must be accompanied by semantic
assertions so that a snapshot update cannot conceal lost text, attributes, references, or accessible
metadata. A baseline change requires a classified compatibility decision, never an automatic
snapshot refresh.

## 8. Decisions still required before an implementation gate

- Whether a maintained strict XML parser satisfying the exact Node support floor and stewardship
  requirements can be qualified. Current decision: none selected.
- Whether the initial IR preserves all XML node kinds or a smaller explicitly lossless subset, and
  how non-SVG namespaces/foreign content are represented.
- Which CSS subset is interpreted versus preserved opaquely, including stylesheet selectors, custom
  properties, and external-resource rejection.
- Whether transformations produce IR only, source-local edits, or framework markup directly, and
  what equivalence level is required for each pass.
- How source maps are exposed, if at all, without changing public APIs or using parser cursors as
  source spans.
- Exact Node 18.17.x compatibility, ownership and stewardship for a production parser, and the
  still-open repository security/governance issues documented in the release policy.
- The workload concurrency envelope and whether measurements should use worker isolation or
  process-level limits.

These choices are intentionally not guessed here. They require design review and, where they change
scope, a separate management decision.

## 9. Authorization boundary

Directive 012 is satisfied by an approved, reviewable architecture specification and implementation
plan. This document authorizes no edits under `src/`, no new runtime/development dependencies, no
changes to package exports, no modifications to generator or optimizer behavior, no production
parser switch, no compiler IR code, and no publish/remote repository action. A separate Phase 03
engineering review must authorize each implementation stage and resolve any parser-selection
dependency before production integration.
