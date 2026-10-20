# Phase 03.1 — Compiler IR Schema and Consumer Design

Status: design-only work under Directive 013. This document specifies a conceptual schema,
semantic-state vocabulary, consumer traceability, ownership rules, and conformance/migration
strategy. It adds no production types, parser, interpreter, adapter, optimizer, or runtime
dependency. Examples below are illustrative design notation, not TypeScript source intended for
compilation.

Phase 02 remains experimentally certified with **no production parser selected**. Phase 03.0 is
approved in [the architecture specification](phase3-architecture-specification.md). This document
must be read with the [Phase 02.6 parser contract](phase2-parser-decision.md); it does not supersede
the security admission boundary, resource ceilings, source-offset rules, or parser-selection gate.

## 1. Design outcomes

The Compiler IR is not the XML parser AST under a new name. It is an internal, versioned,
parser-independent representation of validated compiler input and known SVG semantics, with
explicitly preserved opaque content wherever semantics are not understood.

This design makes five commitments:

1. **Fidelity is explicit.** The exact admitted source is retained as the lexical authority. The IR
   preserves child/attribute order, original QNames, expanded names, logical values, opaque
   extensions, and provenance; it does not promise that serializing an IR reproduces source bytes.
2. **Interpretation is partial and typed.** A value is marked resolved only when a named interpreter
   and its coverage are available. Unsupported or incomplete CSS/reference semantics remain opaque
   or partial; they are not treated as absent, safe to delete, or fully resolved.
3. **Unknown content passes through conservatively.** Unknown SVG elements, foreign-namespace
   elements, and unknown attributes are retained. A pass that cannot preserve their relevant
   semantics must leave them unchanged or report an unsupported transformation, never silently
   discard or rewrite them.
4. **Representations share immutable storage where sound.** The Semantic Model is a typed
   interpretation/view over the syntax document, not necessarily a second full tree. The IR may
   retain references to immutable source strings/spans and syntax nodes; duplication is justified
   only when representation ownership or a pass requires it.
5. **Migration is shadow-first and opt-in.** Candidate output is compared in an isolated location,
   never written to the production output directory until a separate implementation gate authorizes
   a specific adapter promotion.

## 2. Schema contract

### 2.1 Conceptual document and node forms

The following sketches the minimum conceptual distinctions. Exact field names and serialization are
deferred until an implementation gate; the meaning and invariants here are binding design
requirements.

```text
CompilerDocument {
  irVersion
  source: SourceHandle
  root: ElementNode
  indexes: SemanticIndexes
  analysisCoverage: AnalysisCoverage
  diagnostics: ordered Diagnostic[]
}

Node = ElementNode | TextNode | CdataNode | CommentNode | GeneratedNode

ElementNode {
  expandedName: { namespaceUri: URI-or-null, localName: string }
  originalQualifiedName: string
  namespaceBindings: ordered NamespaceBinding[]
  attributes: ordered Attribute[]
  children: ordered Node[]
  interpretation: KnownSvg | UnknownSvg | ForeignOpaque
  provenance: SourceProvenance
}

Attribute {
  expandedName
  originalQualifiedName
  logicalValue: decoded XML string
  lexicalValue: optional exact source slice
  provenance: SourceProvenance
  interpretation: KnownProperty | OpaqueProperty
}

TextNode { logicalText, provenance }
CdataNode { logicalText, delimitersPreservedAsKind, provenance }
CommentNode { text, provenance }
GeneratedNode { generatedValue, generatingPass, optionalSourceAnchor }
```

`UnknownSvg` and `ForeignOpaque` are interpretation states on normal ordered element records, not
permission to erase descendants. They preserve names, attributes, child order, namespace context,
and source provenance. This avoids a second incompatible node hierarchy and allows unknown subtrees
to pass through known stages without being reinterpreted as known SVG.

Namespace declaration attributes remain in the ordinary ordered attribute sequence at their source
positions. An element's in-scope namespace-binding view may index those same immutable records, but
must not create a second unordered copy that loses declaration order or provenance.

Comments are retained as nodes in the internal document even when a later output policy omits them.
Processing instructions and DTDs remain rejected by the existing admission policy; if a future
admission policy admits any such syntax, the IR schema and security review must be amended before
that input is accepted. The parser's XML declaration is document metadata, not an SVG child.

### 2.2 Value and provenance forms

Values must distinguish lexical source from interpretation. For example, a geometry value should not
be represented solely as a JavaScript number if its original unit, percentage, exponent form, or
invalid-but-preserved spelling may affect compatibility. The conceptual forms are:

```text
SourceProvenance =
    RawSourceSpan { sourceId, startUtf16, endUtf16Exclusive }
  | GeneratedOrigin { passId, optionalAnchorSpan }
  | CompositeOrigin { orderedOrigins[] }
  | UnknownOrigin

Interpreted<T> =
    Resolved { value: T, interpreterId, interpreterVersion, sourceOrigin }
  | Unresolved { reason, sourceOrigin }
  | Opaque { reason, originalValue, sourceOrigin }
  | Invalid { stableCode, originalValue, sourceOrigin }
```

Raw spans use Phase 02's zero-based UTF-16 code-unit offsets into the retained exact source,
inclusive start and exclusive end. Parser event cursors and line/column values are never edit spans.
An absent span means “not established”; a consumer must not infer one from decoded/normalized
values. Generated nodes have explicit origin and must not masquerade as source-backed nodes.

`Resolved` is valid only with a named interpretation contract and an implementation coverage
version. A build may contain both resolved and opaque values. Coverage is recorded at the smallest
useful scope (per feature/property/subtree), rather than a document-wide Boolean that could imply
more understanding than was performed.

### 2.3 Fidelity classes and opaque pass-through

The schema distinguishes these guarantees; no general round-trip serializer is implied:

| Fidelity class       | Guarantee                                                                                                                           | Permitted use                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `source-retained`    | Exact admitted source string remains available. Decoded tree values may differ lexically from source.                               | Diagnostics, fallback generation, and lexical analysis.                            |
| `span-backed`        | Each exposed span identifies an exact raw slice in the retained source.                                                             | Validated localized edits and source mapping.                                      |
| `opaque-subtree`     | An unmodified opaque subtree can be copied from one qualified contiguous raw span, including its original spelling and descendants. | Pass-through where the target output syntax permits the original markup.           |
| `semantic-preserved` | A transformation changes syntax but preserves the explicitly enumerated semantic invariants.                                        | Framework code generation and reviewed IR passes.                                  |
| `not-preservable`    | Required lexical or semantic information is absent or an adapter cannot express it.                                                 | Fail/skip the specific pass with a stable diagnostic; never silently drop content. |

An opaque subtree's raw span is usable only when token-span qualification proves the range includes
the complete start/end tokens and content for that source shape. If a range cannot be established,
opaque structural data remains available, but exact source-slice pass-through is not claimed.
Framework adapters may need to escape or transform markup to produce valid target-language source;
they may claim semantic pass-through only after framework-native compilation and behavior tests.

Unknown or foreign content is immutable to generic passes. A pass may inspect it only if it declares
and tests the relevant namespace/extension semantics. If the reference graph is incomplete because
an opaque extension may contain IDs or references, destructive definition/reference cleanup is
disabled for that document or scope. Unknown content is not evidence that a definition is unused.

### 2.4 Schema-enforced invariants versus semantic validation

| Enforced by schema/construction                                                                                                                                    | Requires semantic validation or pass-specific proof                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discriminated node/value variants; ordered arrays; explicit namespace URI/local name/QName; explicit provenance; version tag; readonly-after-publication contract. | Exactly one admitted root; well-formed namespace bindings; XML normalization; unique/ambiguous IDs; reference resolution completeness; CSS cascade; SVG geometry interpretation; inherited `xml:space`; accessibility-name resolution; transformation preservation. |
| Source span unit and endpoint convention are named fields, not implicit integer coordinates.                                                                       | Span bounds and raw-source/token correspondence; non-overlap and edit validity; complete opaque subtree range.                                                                                                                                                      |
| Unknown content has an explicit interpretation marker and remains represented.                                                                                     | Whether a particular pass may safely traverse, clone, rewrite, or omit it.                                                                                                                                                                                          |
| Generated provenance has a pass identifier distinct from source spans.                                                                                             | Whether generated output maps back to an appropriate source anchor.                                                                                                                                                                                                 |

TypeScript readonly declarations are not runtime freezing. Any eventual implementation must publish
deeply immutable records or prove exclusive ownership and prohibit mutation after stage handoff.

## 3. Semantic interpretation states

### 3.1 Common coverage vocabulary

Each subsystem exposes a status rather than guessing:

| State            | Meaning                                                                                               | Safe default for transforms                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `resolved`       | A named interpreter fully handled the value under its declared coverage.                              | Transform only within that coverage and preserve provenance.                                                        |
| `unresolved`     | Meaning depends on data or references not available/uniquely identified.                              | Preserve source/value; prohibit dependent deletion or canonicalization.                                             |
| `opaque`         | Syntax/value is retained but not interpreted by this compiler version.                                | Pass through unchanged; do not infer defaults or absence.                                                           |
| `invalid`        | The admitted XML is structurally safe, but the feature value is outside the defined semantic grammar. | Preserve original spelling where target permits; emit stable warning/error according to the future public contract. |
| `not-applicable` | The feature does not apply to this node/property.                                                     | No inference beyond the feature specification.                                                                      |

An admission/security rejection is not an `invalid` semantic value: rejected input never reaches the
model. A semantic status cannot override an existing security diagnostic or allow unsafe content.

### 3.2 IDs and references

The Semantic Model builds an index of ID definitions and typed reference occurrences while retaining
original attribute/style text. A reference occurrence records its source, syntax kind,
local/external classification, and target result:

| Reference result   | Definition                                                                                | Dependent transformations                                                               |
| ------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `resolved`         | Exactly one in-scope local target is identified under the supported reference grammar.    | A transform may use the edge if its own semantics are covered.                          |
| `unresolved`       | A local target is absent.                                                                 | Keep occurrence and possible target-bearing content; do not rewrite to another target.  |
| `ambiguous`        | Multiple definitions or duplicate IDs make the target non-unique.                         | Preserve all candidates; disable target-sensitive rewrites.                             |
| `blocked-external` | URI is external or would require resource access; admission policy remains authoritative. | Never fetch; retain or reject according to the existing security boundary.              |
| `opaque-reference` | A possible reference appears in unsupported CSS, foreign content, or an unparsed value.   | Mark graph coverage partial and prohibit removal of potentially referenced definitions. |

The index reports `complete`, `partial`, or `not-built` coverage and the grammars included (for
example, direct `href`/`xlink:href` and supported local `url(#id)` forms). It must not claim full
reference resolution merely because the simple attribute forms were scanned. Any ID removal,
renaming, deduplication, or rewrite requires complete coverage for all syntax that can reference the
affected definitions. Otherwise the pass must preserve the resource/ID and leave the occurrence
untouched.

### 3.3 CSS and presentation attributes

Presentation attributes and CSS declarations are represented separately, in source order, with
original spelling, logical value, provenance, and property-specific interpretation state. CSS
declaration records retain declaration order, duplicate declarations, custom properties, and
`!important`; parsing a declaration does not imply resolving the cascade.

The planned CSS coverage levels are:

- `lexically-retained`: source/value is preserved, no CSS grammar claim;
- `declarations-parsed`: declarations and ordering are parsed, but selector matching/cascade may be
  incomplete;
- `cascade-resolved`: explicitly enumerated selector, inheritance, specificity, origin, and
  `!important` rules have executable coverage for the relevant subtree;
- `partial` / `opaque` / `invalid`: a construct, selector, property, or value is outside coverage or
  malformed under the selected CSS grammar.

Inline style parsing alone is not `cascade-resolved`. Presentation attributes are not merged into
inline style unless a complete rule for precedence is implemented. External stylesheet references
remain subject to admission rejection. Custom properties and `var()` references remain opaque until
the supported variable-resolution scope is explicitly defined and tested.

Color shortening or attribute/style conversion may operate only on a value whose grammar and
property semantics that pass supports. It must preserve declaration precedence and unknown values.
The pass cannot claim equivalence based only on string similarity or visual snapshots.

### 3.4 `xml:space`, root geometry, and accessibility

| Domain             | Model contract                                                                                                                                                                                  | What does not count as resolved                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `xml:space`        | Per-element state is `default`, `preserve`, `invalid`, or inherited/unknown, plus the source of the effective value. `default` resets inherited preserve; children inherit the effective state. | Checking only the root attribute; trimming text because it “looks like formatting.”                                 |
| Root geometry      | Keep lexical `width`, `height`, `viewBox`, and `preserveAspectRatio`; parse each independently into dimension/value states while retaining unit and provenance.                                 | Converting percentages/physical units to pixels without a viewport/context; inventing defaults from parser absence. |
| Rendering defaults | Framework-specific defaults currently inserted by templates (for example fallback viewBox/fill) are a code-generation policy, distinct from source SVG semantics.                               | Claiming an inserted `viewBox` or `currentColor` came from the input.                                               |
| Accessibility      | Preserve `<title>`, `<desc>`, role, `aria-*`, focus-related attributes, and relevant metadata as authored. Name/description relations have resolved/unresolved/ambiguous/opaque states.         | Inferring accessible name from one title without evaluating competing ARIA references and target-specific behavior. |

Root geometry parsing may classify a supported numeric grammar and preserve the original unit; it
does not imply full rendering-unit resolution. Accessibility fields are retained even if a framework
adapter does not surface a dedicated prop for them. Unknown metadata remains pass-through content.

## 4. Consumer traceability

This map describes the present consumer and the proposed ownership. Existing tests are
characterization evidence, not proof that a future IR implementation passes them; every migration
must add a paired legacy/candidate assertion or explain an approved compatibility change.

### 4.1 Parsing, semantic transforms, and optimization

| Current consumer / transformation                                                                | Proposed owner and input                                                                                        | Output behavior and fidelity dependency                                                                                                        | Semantic requirements                                                                                            | Existing regression evidence                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readSVGInputFile` and `applySVGInputSafety`                                                     | Security Admission; bytes/string before XML Document.                                                           | UTF-8 bounded source and reject/explicit strip behavior; exact admitted string retained.                                                       | Existing security corpus, DTD/entity/active-content/external-reference/CSS policies and limits remain mandatory. | `tests/phase0/security-containment.test.mjs`, `svg-security-corpus.test.mjs`, `entrypoint-safety-matrix.test.mjs`.                                                                 |
| `FrameworkTemplateEngine.parseSVG` / `extractSVGRootParts`                                       | XML Document and SVG Semantic Model, then adapter input.                                                        | Current code extracts root attrs/inner source; new design must preserve root/children and not globally normalize text.                         | Root name/namespaces, attr decoding, mixed text, `xml:space`, dimensions, `viewBox`.                             | `tests/phase0/generator-language-contracts.test.mjs`, `svg-semantic-preservation.test.mjs`, `artifact-export-contracts.test.mjs`.                                                  |
| `prepareFrameworkMarkup`                                                                         | Framework adapter escaping for target-language embedding; semantic text remains IR data.                        | Escape only for host-language safety; do not transform style text or text content semantics.                                                   | Text/CDATA boundaries, XML entities, braces/template delimiters, comments and style elements.                    | Generator-language framework compiler fixtures; `svg-visual-equivalence.test.mjs` text/CDATA fixture.                                                                              |
| `convertAttributesToJSX`                                                                         | JSX framework adapter (`react`, `react-native`, `preact`, `solid`) over attribute records.                      | Map supported SVG attributes to target names. Unknown QName/foreign attrs pass through or fail explicitly if target cannot represent them.     | Namespace/QName, attribute values, framework-specific JSX rules.                                                 | Generator-language contract; `tests/unit/frameworks.test.js`; semantic-preservation.                                                                                               |
| `convertInlineStylesToReact`                                                                     | JSX adapter only, after a reviewed CSS declaration interpreter.                                                 | Current code emits a JS style object for a limited syntax. Future behavior must retain unsupported declarations rather than drop/reorder them. | CSS declaration grammar, precedence, custom properties, value quoting and `!important`.                          | Generator-language contract and semantic-preservation tests; current visual test includes stylesheet text, not complete cascade coverage.                                          |
| `basicCleaningStage`: XML comment removal, formatting-whitespace normalization, color shortening | Explicit source-edit pass or IR transform with declared mode.                                                   | Comment/whitespace/color change only when enabled; localized edits require qualified spans.                                                    | Comment-vs-CDATA distinction, inherited `xml:space`, text preservation, color grammar/property coverage.         | `svg-semantic-preservation.test.mjs`, `svg-visual-equivalence.test.mjs`, security corpus.                                                                                          |
| `numericStage` and `transformSVGAttributeValues`                                                 | Typed numeric-property IR pass for supported grammars; lexical source-edit backend only if spans are qualified. | Normalize eligible numeric values deterministically; preserve unknown units/invalid values and original when not eligible.                     | Attribute namespace/name, path/points grammar, precision/tolerance policy, rendering/visual invariants.          | Semantic preservation and visual-equivalence across existing `OptLevel`s.                                                                                                          |
| Optional tree-based style, transform, path, shape, group, hidden-node, and definition optimizers | Separate semantic IR pass registry; not implicitly activated by parser/IR adoption.                             | Each pass must declare node effects, IDs/references affected, source fidelity, and failure behavior.                                           | Full relevant geometry/style/reference context; safe definition liveness; accessibility and text effects.        | Existing unit tests where present plus new semantic/reference/visual conformance required; optimizer modules are not covered as production defaults by current processor pipeline. |
| `extractViewBox`                                                                                 | Geometry interpreter or compatibility helper; current method is regex-based.                                    | Preserve exact source value and distinguish missing/invalid/parsed.                                                                            | XML decoding, root-only attribute scope, case-sensitive XML names.                                               | Framework tests and generator-language contracts.                                                                                                                                  |

| Additional current consumer                       | Proposed owner and input                                                                                                                      | Output behavior and fidelity dependency                                                                                                                                                               | Semantic requirements                                                                                                                                                                                          | Existing regression evidence                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `prepareSVGForFramework`                          | Framework adapter preprocessing for JSX frameworks.                                                                                           | Current pipeline runs attribute-name conversion plus inline-style conversion for React, React Native, Preact, and Solid; future behavior belongs to those adapters and must be explicit per target.   | Supported framework set, namespace-qualified names, CSS coverage, stable unknown-attribute behavior.                                                                                                           | Generator-language contract and framework compiler fixtures; broaden semantic cases per adapter.                                                |
| `applyActivePlugins` (`after-parse` hook name)    | Future typed transformation/plugin boundary, not XML parsing.                                                                                 | Current hook receives and returns source text plus config/original text/metadata before template-engine parsing. Future hook contracts must say whether they transform source, Semantic Model, or IR. | Plugin trust, deterministic output, preserved admission, diagnostics, reference/style context. Any changed source is readmitted before parsing; structured passes are constrained to their typed capabilities. | `src/__tests__/plugin-manager.test.ts`, `tests/phase0/configuration-pipeline-consistency.test.mjs`, security containment and entrypoint matrix. |
| `generateFrameworkComponent` direct processor API | Compatibility facade/orchestration; future path delegates to the same admission, analysis, IR and adapter contracts as the canonical service. | Current method has its own safety check, calls performance optimization, then rechecks output before generation. It must not drift from canonical semantics.                                          | Same admission policy, optimization option semantics, cancellation, stable diagnostics.                                                                                                                        | `tests/phase0/security-containment.test.mjs`, `entrypoint-safety-matrix.test.mjs`, processor/generator tests.                                   |

The structural optimizer family includes `style-optimizer`, `transform-optimizer`,
`transform-collapsing`, path optimization/simplification/deduplication, shape conversion,
`remove-unused-defs`, hidden/empty removal, attribute movement, and tree serialization. The custom
`svg-tree-parser.ts` does not become the general XML document contract by being wrapped in the IR.
Each such pass requires its own behavior, fidelity, and security review before any reactivation.

### 4.2 Framework adapter and artifact traceability

All existing framework generators share `FrameworkTemplateEngine.generateComponent()` and
`parseSVG()`; they currently take source strings rather than XML/IR inputs. Framework-specific
adapters should own only syntax, framework props/imports, escaping, and framework runtime
conventions. They must not own security admission, XML interpretation, filesystem output, or
collision policy.

| Framework / current generator                      | Current emitted contract to preserve                                                                            | Future adapter requirements                                                                                                                         | Regression coverage now                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| React / `generateReactComponent`                   | JSX/TSX default export, forwardRef, `SVGProps`, size/dimension/fill defaults, class/style/props forwarding.     | Preserve root/accessibility attrs and valid SVG child semantics; distinguish inherited source values from template defaults.                        | Jest templates, framework suite, Phase 00 generator-language compiler, artifact contract, React visual equivalence. |
| React Native / `generateReactNativeComponent`      | `react-native-svg` imports and component-name/attribute conversion for supported SVG tags.                      | Explicit element/attribute capability map; unsupported/foreign subtree must not be corrupted by regex casing.                                       | Framework suite and Phase 00 language/generator contract; add native consumer build/equivalence for migration.      |
| Vue / `generateVueComponent` + `relocateVueStyles` | SFC template, `<script setup>` or Options API, TS/JS mode, props/defaults, relocated style blocks.              | Complete SFC-safe escaping, scoped/style behavior, directives and attr binding; preserve SVG namespaces and accessibility.                          | Vue compiler fixture in artifact contracts/generator language; suite checks options.                                |
| Svelte / `generateSvelteComponent`                 | SFC script exports, props, markup and rest-props behavior, TS/JS mode.                                          | Svelte compiler-valid markup and correct attribute/property binding; retain text and style semantics.                                               | Svelte compiler fixture in generator-language tests; framework suite.                                               |
| Angular / `generateAngularComponent`               | Angular decorator/template, standalone or module option, `OnPush`, `@Input`s, TS-only.                          | Angular template parse/compile, template-string escaping, binding/property vs attribute semantics, namespace support.                               | Angular compiler fixture and language-contract tests; framework suite.                                              |
| Solid / `generateSolidComponent`                   | JSX/TSX with Solid `Component`/`JSX` types and props.                                                           | Correct Solid DOM property/attribute behavior and preservation of unknown SVG markup.                                                               | Framework suite and JSX/TSX generator compiler fixtures.                                                            |
| Preact / `generatePreactComponent`                 | JSX/TSX default export, Preact `h`/component types, props.                                                      | Preact-specific JSX names, SVG semantics, and language-valid output.                                                                                | Framework suite and JSX/TSX generator compiler fixtures.                                                            |
| Lit / `generateLitComponent`                       | Custom element, Lit properties/styles, `html`/`svg` template construction, TS/JS mode.                          | Safe Lit template rendering with correct SVG namespace, expression boundaries, and SVG attrs.                                                       | Framework suite, artifact contract, generator-language Lit compiler fixture.                                        |
| Vanilla / `generateVanillaComponent`               | Function returning `SVGSVGElement`; creates root with `createElementNS`, applies options, inserts inner markup. | Replace or constrain raw `innerHTML` only under a security-reviewed, namespace-correct strategy; preserve or explicitly reject unsupported content. | Framework suite and generator-language runtime/build fixture; security entrypoint tests.                            |

The artifact contract remains outside adapters: `getFrameworkArtifactContract()`, build planning,
module specifiers, barrel generation, deterministic sorting, collision diagnostics, and
`commitOutputTransaction()` own artifact behavior. Current regression evidence includes
`tests/phase0/artifact-export-contracts.test.mjs`, `generator-language-contracts.test.mjs`,
`integrated-workflow-certification.test.mjs`, and package smoke. Every adapter promotion must
preserve the appropriate entrypoint, extension, export, TypeScript/JavaScript, output naming,
collision, and transaction behavior.

## 5. Ownership, sharing, and resource plan

### 5.1 Lifetime boundaries

| Representation         | Created by / owned during                | Retention and release rule                                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw bytes              | Input reader                             | Decode once within byte ceiling; release after fatal UTF-8 decoding.                                                                                                                                                             |
| Admitted source        | Security Admission                       | Immutable exact string; shared by reference while diagnostics, spans, opaque pass-through, cache key, or a source-backed edit need it. Release after all consumers and output writes complete.                                   |
| XML Document           | Qualified parser adapter                 | Per-file immutable syntax tree; live through semantic indexing/lowering. Release once no IR/provenance/diagnostic needs syntax-node references. No process-global document cache.                                                |
| Semantic indexes/state | Semantic interpretation                  | Prefer sidecar/index references to immutable XML records. Release after required passes or encode necessary facts into IR. Do not retain a duplicate full semantic tree by default.                                              |
| Compiler IR            | IR lowering                              | Per-file immutable result live through selected passes and all requested framework adapters. Release after artifact strings have been committed or rejected.                                                                     |
| Generated artifacts    | Framework adapters / application service | Generate deterministically; write through existing artifact plan and transaction. Keep only as long as required for the per-build commit and report.                                                                             |
| Cache entry            | Existing application cache               | Cache emitted deterministic artifacts under keys including all output-affecting versions/options. Admission still runs before cache lookup; no raw AST or partially interpreted semantics in persistent cache under this design. |

JavaScript does not provide ownership transfer in the Rust sense. “Transfer” means a documented
logical handoff: the producer stops mutating, consumers treat the value as immutable, and only the
per-file coordinator retains the top-level references. Readonly types alone are not proof of runtime
immutability.

### 5.2 Sharing rules and duplication controls

Immutable sharing is acceptable for the exact source string, namespace/name strings, unchanged
logical values, source provenance, and syntax-node references when their lifetime is explicit. Never
store mutable parent pointers, mutable `Map`s, or pass-local scratch fields on shared syntax nodes.
Per-pass indexes are private and disposable.

The preferred lowering shape is a shared immutable XML Document plus semantic sidecar/indexes, then
one IR allocation that carries the subset of semantic facts needed downstream. It is not preferred
to retain a full XML tree, a second full SVG Semantic Model tree, and a third full IR tree
simultaneously unless measurements show that this is required and within budget. The semantic model
remains a distinct conceptual boundary even when implemented as sidecar annotations over shared
syntax nodes.

The pipeline should release the parser tree after IR lowering when possible. It may retain the
source string and spans for opaque slices, exact diagnostics, or localized edits. Source-backed
string slices and decoded values can themselves retain or duplicate memory depending on runtime
behavior; no zero-copy assumption is valid until measured on supported Node releases.

### 5.3 Limits and measured versus proposed budgets

The existing security admission caps stay unchanged. Phase 02.6 records proposed parser hard
ceilings that future implementations may lower but not raise without review:

| Resource                      | Existing / contract ceiling | Interpretation                                                 |
| ----------------------------- | --------------------------: | -------------------------------------------------------------- |
| UTF-8 input bytes             |                      10 MiB | Security admission ceiling; use actual admitted byte length.   |
| Nesting depth                 |                         256 | Admission/parser ceiling.                                      |
| Elements                      |                     100,000 | Admission/parser ceiling.                                      |
| Attributes per element        |                         256 | Admission/parser ceiling.                                      |
| Aggregate attributes          |                     200,000 | Parser-contract ceiling.                                       |
| Decoded text plus CDATA bytes |                      10 MiB | Parser-contract ceiling, subject to precise admission mapping. |

Phase 02.5 measurements are reference-host characterization, not this architecture's budget. The 187
KiB structural fixture retained about 2.65 MiB for the standalone Saxes adapter tree, about
6.77–6.90 MiB for standalone xmldom, and about 2.79–2.82 MiB for the standalone source-span index.
Tree-plus-spans together was not measured. The 9.44 MiB mostly-text workload had only two warm
latency samples. Candidate guardrails (≤3.2 MiB standalone structural retained heap, ≤40 MiB
single-parse incremental peak RSS, ≤30 ms structural p95, ≤350 ms near-cap median) are not active
gates and are not valid estimates for combined XML + semantic + IR ownership or concurrent builds.

Before implementation, measure simultaneous representations, generated artifacts, cleanup, and
concurrency under an explicitly named host/runtime/workload. Keep configured scheduler concurrency
as an application-level limit; do not imply that the Phase 02 serial benchmark certified a batch
memory envelope.

## 6. Shadow comparison and mismatch taxonomy

Shadow generation must be read-only with respect to production artifacts:

1. Run the same source through mandatory security admission once per candidate input; never let the
   experimental branch bypass admission or apply different unsafe-input policy.
2. Produce legacy and candidate results in memory or in separate disposable temporary directories.
   Do not invoke the production writer for the candidate, and do not touch the configured output
   directory, barrel, cache entry, or transaction journal.
3. Record stable, redacted diagnostics and bounded metadata only. Do not include source snippets,
   full input, secret-shaped values, or raw parser messages in mismatch reports.
4. Compare one item at a time, with deterministic fixture IDs, exact tool/runtime versions, config,
   framework/language mode, and input digest. Preserve raw artifacts only in a controlled test
   fixture when explicitly approved.
5. A mismatch is triaged, not auto-accepted. Updating a golden file or changing a threshold does not
   itself resolve the mismatch.

Every candidate/legacy pair is classified along independent axes:

| Axis                  | Categories / evidence                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bytes                 | `identical`; `trivia-only`; `expected-framework-syntax`; `unexpected-byte-diff`; report first differing location and spans when available.                                                                                                |
| Semantic structure    | `equivalent-under-declared-invariants`; `expected-semantic-change`; `lost/added/reordered-node`; `attribute/value-change`; `text-or-whitespace-change`; `namespace-change`; `reference-change`; `unknown-content-change`; `unclassified`. |
| Framework validity    | `native-compiler-pass`; `native-compiler-fail`; `runtime-render-pass/fail`; exact compiler/version and diagnostics.                                                                                                                       |
| Accessibility         | `equivalent`; `metadata-lost`; `reference-invalid`; `behavior-unverified`; report title/desc/ARIA/role/focus deltas without making an automated accessibility conformance claim.                                                          |
| Visual behavior       | `within-reviewed-tolerance`; `pixel-diff`; `render-failure`; `not-applicable`; exact renderer, dimensions, density, and tolerance. Visual pass cannot override semantic failure.                                                          |
| Diagnostics/security  | `same-code-and-policy`; `expected-more-specific`; `missing-rejection`; `unexpected-rejection`; `unsafe-artifact-attempt`; `redaction-failure`. Any admission bypass or unsafe artifact attempt is a hard stop.                            |
| Determinism/resources | `byte-repeatable`; `diagnostic-repeatable`; `nondeterministic`; latency/heap/RSS observations with workload and sample count; no new thresholds without review.                                                                           |

Store mismatch counts and representative minimized fixtures rather than unbounded artifact dumps.
Any security, data-loss, accessibility metadata loss, or namespace/reference mismatch blocks
promotion even if visual and build tests pass.

## 7. Adapter promotion contract

Promotion is per adapter/framework and requires a separate implementation gate. A proposed adapter
may be opt-in only after all of these are true:

- Mandatory admission is unchanged and shared. Security corpus/entrypoint matrix proves reject and
  explicit strip behavior, stable diagnostics, and no candidate artifact writes on rejection.
- The production parser dependency question is resolved for any adapter path that parses XML. The
  exact package/version passes strict malformed-input, namespace, DTD/entity, resource, source-span,
  Node-floor, license, advisory, and stewardship review.
- The candidate schema version and semantic coverage are explicit; unknown content and partial CSS/
  reference coverage are handled conservatively.
- The framework's native compiler validates generated TS/JS/SFC output for every supported language
  mode, and consumer runtime tests cover behavior that a parser/compiler check cannot establish.
- Mismatch classification has no unresolved security, text/whitespace, namespace, reference,
  accessibility, artifact, or determinism defects. Visual tolerances are approved separately.
- Peak/retained memory, cleanup, cancellation, and in-flight concurrency are measured for the whole
  ownership pipeline; proposed ceilings are converted to gates only by explicit review.
- Opt-in selection does not change the default path, output directory, cache namespace, public
  exports, or artifact transaction behavior. Rollback to the legacy path is one explicit option and
  is tested.
- Full quality, compatibility, Phase 00/01, package/archive, and clean-checkout gates pass. Public
  behavior changes follow the compatibility ledger and maintainer approval process.

An opt-in is not a way to evade parser selection, release policy, public compatibility review, or
security controls. There is no opt-in implementation authorized by Directive 013.

## 8. Consumer-to-invariant regression map

| Regression suite                                                           | Current responsibility evidenced                                                        | Must be retained/extended for candidate path                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `tests/phase0/svg-security-corpus.test.mjs`                                | Safe/rejected corpus, limits, strip behavior, processor rejection.                      | Same admission outcomes/codes before parser allocation and no partial output.                    |
| `tests/phase0/entrypoint-safety-matrix.test.mjs`                           | CLI, processor, service, Vite/Rollup, Webpack, Babel, Jest, Next security behavior.     | Candidate route in every relevant entrypoint; candidate never bypasses policy.                   |
| `tests/phase0/svg-semantic-preservation.test.mjs`                          | Attribute and text/source-semantic preservation fixtures.                               | Ordered XML/IR values, opaque extension and localized span transformations.                      |
| `tests/phase0/svg-visual-equivalence.test.mjs`                             | Optimizer visual checks and React child markup rendering.                               | Multi-framework semantic/visual pairing; visual check remains one axis only.                     |
| `tests/phase0/generator-language-contracts.test.mjs`                       | Framework/language outputs compile with native validators including Vue/Svelte/Angular. | Repeat on candidate for each adapter and supported language mode, with SFC/template diagnostics. |
| `tests/phase0/artifact-export-contracts.test.mjs`                          | Names, extensions, barrels, exports, collisions and framework artifact behavior.        | Byte/artifact contract comparison and no candidate writes in shadow mode.                        |
| `tests/phase0/configuration-pipeline-consistency.test.mjs`                 | Configuration resolution and consistency among public paths.                            | Candidate choice must not alter configuration precedence or option meaning.                      |
| `tests/phase0/integrated-workflow-certification.test.mjs`                  | Secure input through optimization, React TSX generation and transaction commit.         | Candidate full pipeline only after adapter-specific gate; atomic artifact commit.                |
| `tests/phase0/concurrency-resource-lifecycle.test.mjs`                     | Scheduler, cache, writer and processor lifecycle contracts.                             | Add representation-release and concurrent memory evidence before any memory claim.               |
| `tests/phase1/reproducibility.contract.test.mjs` and quality/package gates | Deterministic bytes, public compatibility, archive/security contract.                   | Candidate determinism, cache-version keys, package exclusion/inclusion review.                   |

These suites provide regression anchors; they do not mean every semantic dimension is fully tested
today. New tests must be added for complete references/CSS states, foreign/unknown subtree
preservation, accessibility references, all-framework semantic comparison, and shadow non-writing
behavior before implementation promotion.

## 9. Decisions deferred to a later review

- Exact parser implementation and production-parser stewardship: none selected.
- Concrete compiled TypeScript interfaces, constructors, runtime freezing mechanism, and
  compatibility strategy for in-memory IR versions.
- The supported CSS and reference grammars and the exact point at which each coverage status becomes
  `resolved`.
- Any source-map public API, persistent IR cache format, or opaque subtree serialization mechanism.
- Any optimizer port/reactivation, framework adapter migration, default switch, or package export.
- Exact combined and concurrent memory limits; Phase 02 data is reference characterization only.

Directive 013 acceptance completes the design deliverable, not an implementation stage. Phase 03.2
and later work remains unauthorized until a separate management gate addresses parser selection,
implementation scope, and release/security constraints.
