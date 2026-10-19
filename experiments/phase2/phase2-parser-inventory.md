# Phase 02.1 — Current XML/SVG Parser Inventory

Status: inventory complete for the Phase 02.1/02.2 evaluation checkpoint. No production parser
selection or parsing-path change is made by this document. This is a baseline snapshot; later
QUAL-001–004 work added exact-pinned development-only parser dependencies and an isolated
experimental adapter without changing production parsing.

## Current trust and processing path

```text
file / CLI / service / integration input
        │
        ├─ readSVGInputFile: byte cap + fatal UTF-8 decode (for file inputs)
        ▼
applySVGInputSafety → scanSVGSecurityBoundary
        │  bounded lexical structure/security scan; reject or explicit strip policy
        ▼
optimizer pipeline ── source-preserving lexical transforms (basic path)
        │              └─ optional legacy custom-tree optimizers (higher levels)
        ▼
framework template extraction / JSX attribute conversion
        ▼
public artifact writers and integrations
```

The existing safety scan is a mandatory trust boundary, not a general-purpose XML DOM. Any future
parser must run only after that boundary and cannot become a route that skips or relaxes it. File
inputs have a 10 MiB default cap and fatal UTF-8 decoding; string inputs are byte-counted before the
scan. The scanner separately enforces XML/security structure limits.

## Structural interpretation inventory

| Component                                                                                                                        | Current responsibility and technique                                                                                                                                                                                                                                              | Fidelity / migration impact                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/security/input-safety.ts`                                                                                                   | File byte-size enforcement, bounded reads, UTF-8 decode; calls the scanner for in-memory and file content. `applySVGInputSafety` implements reject/explicit strip policy.                                                                                                         | Keep as the outer boundary. A parser adapter must not be called before its checks, and parser failures must not turn rejected input into an artifact.                                                                                                                |
| `src/security/svg-xml-safety.ts`                                                                                                 | Handwritten bounded lexical XML scanner. Tracks element stack/namespaces, XML characters/entities, active constructs, URL/CSS hazards, source offsets, and strip edits. Builds no DOM, resolves no external resources, and rejects DTDs under the existing policy.                | Security-sensitive, high-risk to rewrite. Preserve as mandatory policy enforcement unless a separately reviewed change proves equivalent behavior. It is not an SVG semantic tree and does not provide a reusable AST.                                               |
| `src/optimizers/xml-attribute-transform.ts`                                                                                      | Conservative lexical start-tag walker for quoted attributes. Rewrites selected attribute names/values by source spans; separately handles comments, CDATA, processing instructions, inter-element whitespace, and XML comments. Returns original source when markup is ambiguous. | Existing source-preserving path. Replacing it with parse/serialize would affect quote style, attribute spacing/order, entities, and untouched source slices. A token/span layer or narrowly scoped patches would be needed to retain these properties.               |
| `src/core/framework-templates.ts`                                                                                                | Uses `extractSVGRootParts` from the lexical walker to obtain root attributes and original inner markup; whitespace policy is applied, then framework-specific text/attribute/template adaptations run. It does not create a general XML tree.                                     | Public generated output across React, React Native, Preact, Solid, Vue, Svelte, Angular, Lit, and Vanilla depends on this behavior. A new parser must preserve inner mixed content and avoid framework-specific markup regressions.                                  |
| `src/processors/svg-processor.ts`                                                                                                | Enforces safety before optimization and rechecks optimized output. Basic stage is source-oriented.                                                                                                                                                                                | Central integration seam; should remain behind the safety boundary. Current-level and optional optimizer behavior both need characterization before migration.                                                                                                       |
| `src/optimizers/svg-tree-parser.ts`                                                                                              | Custom recursive string parser into `SVGNode`; recognizes only a fixed element allow-list, regex-parses attributes, uses regex-based matching for closing tags, trims text, and skips unsupported subtrees. It is not a complete XML parser.                                      | Used by opt-in/higher-level optimization stages. It can lose unknown elements, mixed text, comments, whitespace, quote/source form, and other distinctions. Replacing the AST alone is insufficient: mutating stages and serializers also need compatibility review. |
| `src/optimizers/tree-serializer.ts`                                                                                              | Serializes custom nodes; double-quotes and escapes attributes, uses a configured self-closing form, and omits comments in minified mode.                                                                                                                                          | Serialization is intentionally not lexical round-tripping. A standards AST serializer will also not restore original spelling, whitespace, entity notation, or CDATA boundaries unless source spans are retained.                                                    |
| `src/optimizers/tree-stages.ts`, `advanced-stages.ts`, and tree consumers such as `path-deduplicator.ts` / `shape-conversion.ts` | Parse → mutate custom tree → serialize only when a stage reports changes. Several wrappers catch errors and return original content.                                                                                                                                              | Broadest internal migration surface. Retain stage semantics and error policy; separately decide whether to preserve old behavior or disable/requalify unsafe/lossy stages. No such behavior change is authorized by this inventory.                                  |
| `src/integrations/{webpack,vite,rollup,babel,jest-preset}.ts`, service/application and builder entry points                      | Read or receive SVG content, then route into shared safety/service/processor or component-generation paths. The integrations are entry adapters, not independent structural parsers.                                                                                              | Verify every entry path still reaches the same mandatory safety boundary and generated output contract. Avoid duplicating parser instances or introducing integration-specific parse semantics.                                                                      |

## Dependency map and migration boundary

```text
input adapters ──► input-safety ──► svg-xml-safety (mandatory trust policy)
                                      │
                                      ▼
                           processor / application service
                             ├─ lexical transforms ──────────► template engine
                             └─ optional tree stages ─► custom SVGNode ─► serializer
                                                                        │
                                                                        ▼
                                                           public framework artifacts
```

There is no general-purpose XML parser dependency in the production dependency set. Saxes and
`@xmldom/xmldom` were later added as exact-pinned development-only qualification dependencies;
neither is used by production code. `svg-tree-parser` is an internal custom parser, not a
standards-complete parser. The optimizer index exports several optimizer APIs, so internal tree
behavior may also be consumed through the package's public surface; Phase 02 qualification must
check exports before treating those modules as freely replaceable.

## Migration-impact assessment

1. Keep source authorization and parser structure conceptually separate. The 10 MiB default file
   limit, UTF-8 policy, unsafe-input policy, active-content checks, URL/CSS checks, namespace
   checks, and post-optimization verification remain owned by the existing safety boundary during
   parser qualification.
2. Use an XML parser for well-formed structure and namespace-aware events/tree only after security
   admission. Candidate-specific DTD behavior still needs explicit testing; no library default is an
   adequate security policy.
3. Do not infer source fidelity from a correct DOM. XML parsing can normalize line endings, expand
   predefined/numeric references, coalesce text, and represent CDATA as text; serialization can
   alter quote delimiters, entity spelling, attribute spacing/order, empty-element spelling, and
   comments. If these distinctions matter, keep the original source plus token/source spans.
4. Prioritize framework extraction and any future common semantic model for a structural adapter.
   Treat the legacy custom-tree optimizer and serializer as separate compatibility work, because
   their behavior includes both tree mutations and lossy serialization.
5. Candidate evidence in this original inventory was desk research only. Subsequent isolated Phase
   02.3–02.4 tests and 02.5 measurements are recorded in
   [the qualification record](phase2-parser-qualification.md) and
   [the performance report](phase2-parser-performance.md).

## Not changed

No production parser dependency, scanner, optimizer, framework template, integration, public export,
or parser path was changed. Phase 02.5 experiments remain isolated; Phase 02.6 parser
contract/selection is still future work.
