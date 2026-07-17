# ADR P2-201: XML parser selection for the three-model SVG pipeline

- Status: **Proposed — approval required before integration**
- Date: 2026-07-17
- Directive: `SVGER-REF-2026-07-17-FINAL`
- Issue: `SVGER-P2-201`
- Target: SVGER-CLI 4.2
- Decision owners: compiler architecture, security, release engineering, licensing

## Decision summary

Use an exactly pinned `@xml-tools/parser@1.0.11` as the XML lexical and concrete-syntax parser,
then construct an SVGER-owned immutable `ParsedXMLAST` directly from its CST and token vector.

Do **not** integrate the parser until this ADR and its qualification checklist receive named,
timestamped approval. Do **not** use `@xml-tools/ast`: its public contract permits partially valid
nodes and states that it does not retain full syntactic information. SVGER requires an ordered,
location-complete syntax model with fail-closed validity.

The selected boundary is:

```text
UTF-8 source bytes
  → size/BOM/encoding gate
  → @xml-tools/parser CST + token vector
  → fail closed on any lexErrors or parseErrors
  → reject prohibited XML constructs
  → SVGER-owned immutable ParsedXMLAST
  → namespace and SVG semantic validation
  → SVGSemanticModel
  → normalization
  → CompilerIR
```

This is a provisional architecture decision, not parser integration authorization.

## Context

The current compiler performs structural SVG work with regular expressions and mutable string
rewrites. That cannot reliably distinguish syntax from text, resolve namespaces, retain diagnostic
locations, or prove structural invariants. P2-202 requires explicit transitions between
`ParsedXMLAST`, `SVGSemanticModel`, and `CompilerIR`, and forbids regex-based parsing, traversal, or
structural transformation.

The parser boundary must therefore provide enough syntax and location information to build the
first model without making the external parser's mutable or recovery-oriented AST part of SVGER's
architecture.

SVGER currently advertises zero runtime dependencies for its core. That preference reduces supply-
chain and install surface, but an in-house XML parser would create a substantially larger security
and correctness obligation. For XML, the zero-dependency preference is subordinate to fail-closed
parsing, location-aware diagnostics, namespace correctness, and fuzzable deterministic behavior.

## Binding requirements

The selected design must satisfy these requirements before P2-202 can begin:

1. XML 1.0 document parsing with one root element.
2. Preservation of document order, element/attribute spelling, comments, CDATA, processing
   instructions, character/entity references, and source offsets in `ParsedXMLAST`.
3. Namespace declarations and qualified names preserved for a separate, deterministic namespace
   resolution pass.
4. No network, filesystem, catalog, or external-entity resolution.
5. DOCTYPE and external identifiers rejected for SVG compilation.
6. Only the five predefined XML named entities and numeric character references accepted; custom
   named entities rejected without expansion.
7. Any lexer recovery, parser recovery, missing token, invalid token, duplicate attribute,
   undeclared prefix, multiple root, or trailing non-whitespace content is fatal.
8. Exact source ranges on every diagnostic-capable syntax node.
9. Pure deterministic output for identical bytes and options.
10. License, package, support-matrix, and security-corpus review before dependency adoption.

## Candidates evaluated

Versions were resolved from the TLS-verified npm registry on 2026-07-17.

| Candidate | Evaluated version | License | Runtime footprint | Summary |
| --- | ---: | --- | --- | --- |
| `@xml-tools/parser` | 1.0.11 | Apache-2.0 | `chevrotain@7.1.1` → `regexp-to-ast@0.5.0` | CST and token vector with offsets; recovery must be rejected |
| `saxes` | 6.0.0 | ISC | `xmlchars` | Strict namespace-aware SAX parser; lexical/source-span fidelity is insufficient |
| `@xmldom/xmldom` | 0.9.10 | MIT | No declared dependency | Namespace-aware mutable DOM; serializer and location model are not lossless enough |
| `fast-xml-parser` | 5.10.1 | MIT | Five declared dependencies | Ordered JS output available; namespace and exact-token model are insufficient |
| `libxmljs2` | 0.37.0 | MIT | Native build/prebuild toolchain | Strong XML feature set; native portability and external-library surface are excessive |
| In-house parser | N/A | Project MIT | No package dependency | Rejected security/correctness burden and long-term maintenance risk |

Primary references:

- [`@xml-tools/parser` source and CST contract](https://github.com/SAP/xml-tools/tree/master/packages/parser)
- [`@xml-tools/ast` source and documented AST tradeoffs](https://github.com/SAP/xml-tools/tree/master/packages/ast)
- [`saxes` source and XML/namespace behavior](https://github.com/lddubeau/saxes)
- [`@xmldom/xmldom` source and DOM behavior](https://github.com/xmldom/xmldom)
- [`fast-xml-parser` source and options](https://github.com/NaturalIntelligence/fast-xml-parser)
- [`libxmljs2` native binding source](https://github.com/marudor/libxmljs2)
- [W3C XML 1.0](https://www.w3.org/TR/xml/)
- [W3C Namespaces in XML](https://www.w3.org/TR/xml-names/)

## Evaluation matrix

Scores are 1 (poor) through 5 (strong) against SVGER's requirements, not general parser quality.

| Criterion | XML Tools CST | Saxes | xmldom | Fast XML Parser | libxmljs2 | In-house |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ordered lexical fidelity | 5 | 3 | 2 | 3 | 2 | 5 |
| Exact location/span support | 5 | 3 | 2 | 2 | 2 | 5 |
| Namespace foundation | 3 | 5 | 5 | 2 | 5 | 1 |
| Fail-closed XML grammar | 3 | 5 | 3 | 3 | 5 | 1 |
| DTD/entity containment | 4 | 5 | 2 | 3 | 2 | 1 |
| Deterministic pure-JS behavior | 5 | 5 | 4 | 4 | 3 | 4 |
| Security qualification surface | 3 | 4 | 3 | 3 | 3 | 1 |
| License compatibility | 4 | 5 | 5 | 5 | 5 | 5 |
| Install/support-matrix cost | 3 | 4 | 5 | 2 | 1 | 5 |
| Fit for SVGER-owned ParsedXMLAST | **5** | 3 | 2 | 2 | 2 | 4 |

### Why `@xml-tools/parser`

The parser returns a CST plus a Chevrotain token vector. Tokens carry source offsets and line/column
information, while the CST retains XML constructs and ordering. This permits SVGER to create its
own frozen discriminated-union AST without reconstructing token boundaries through regex or string
searches.

The parser is intentionally fault tolerant and may return partial syntax. That default is not
acceptable for compilation. The SVGER adapter must treat a non-empty `lexErrors` or `parseErrors`
array, recovery-inserted token, or incomplete range as a fatal `E_INVALID_SVG_INPUT`. The external
CST must never cross the parser adapter boundary.

The parser preserves qualified names but does not make its namespace behavior SVGER's semantic
contract. Namespace declarations and prefix-to-URI resolution belong in the transition from
`ParsedXMLAST` to `SVGSemanticModel`, where undeclared prefixes, duplicate expanded attribute names,
and illegal namespace bindings fail deterministically.

### Why not `@xml-tools/ast`

Its public API documents an immutable AST with partial position information, optional properties,
and `InvalidSyntax` nodes so it can represent partially valid XML. It also states that full
syntactic information is not retained. Those are useful editor-oriented properties but conflict
with the lossless, fail-closed compiler boundary. SVGER will consume only the parser CST/token
vector and own all three compiler models.

### Why not `saxes`

`saxes` is strict, namespace-aware, compact, and has a strong default DTD/entity posture: it reports
DOCTYPE without processing it unless a caller explicitly supplies entity behavior. It is the
runner-up and the fallback if XML Tools fails qualification.

Its event API exposes the current parser position but does not provide a complete ordered token
vector with exact start/end spans and original lexical images for every construct. Recovering those
details with source searches would recreate a structural string parser and violate P2-202.

### Why not `@xmldom/xmldom`

The DOM is namespace-aware and can attach line/column metadata, but it is mutable, reports less
complete source ranges, and serialization normalizes lexical details. Its DTD/internal-entity
surface is broader than SVGER needs. Adapting DOM mutations into immutable syntax and semantic
models adds ambiguity without improving the required source fidelity.

### Why not `fast-xml-parser`

It can preserve tag order and offers entity limits, but its primary abstraction is XML-to-JavaScript
objects rather than a full token/CST boundary. Namespace prefixes may be transformed or removed,
and exact range coverage is not the central contract. Its broader entity/DOCTYPE configuration and
larger dependency graph provide no advantage for the strict SVG subset.

### Why not `libxmljs2`

Native libxml bindings provide mature XML and namespace behavior, but introduce native compilation,
prebuilt binary distribution, OS/architecture variance, and a much larger release/supply-chain
surface. They also do not preserve original lexical form sufficiently for the first compiler model.

### Why not an in-house parser

An in-house XML grammar would preserve the marketing claim of zero runtime dependencies, but would
make SVGER responsible for Unicode XML names, namespace rules, malformed-input recovery boundaries,
entity behavior, location accounting, and ongoing security research. That contradicts the purpose
of the architectural refoundation.

## Required parser adapter contract

The future adapter must be the only module importing `@xml-tools/parser` and must expose a narrow
project-owned API:

```ts
interface XMLSourceRange {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

interface ParsedXMLDocument {
  readonly kind: 'document';
  readonly children: readonly ParsedXMLNode[];
  readonly root: ParsedXMLElement;
  readonly range: XMLSourceRange;
}

interface XMLParserPort {
  parse(source: Uint8Array, options: Readonly<XMLParserOptions>): ParsedXMLDocument;
}
```

The complete `ParsedXMLNode` union is designed in P2-202. It must distinguish element, attribute,
text, CDATA, comment, processing instruction, XML declaration, character reference, and predefined
entity reference nodes. Collections and nodes are recursively frozen. External parser nodes,
Chevrotain tokens, and mutable maps are not exported.

## Binding DTD and entity policy

For SVG compilation:

| Construct | Decision |
| --- | --- |
| XML declaration | Accept only supported XML 1.0 encoding declarations; preserve syntax |
| DOCTYPE, internal subset | Reject before model construction |
| `SYSTEM` / `PUBLIC` external identifier | Reject |
| External general/parameter entity | Reject; never resolve |
| Custom internal named entity | Reject; never expand |
| `&lt;`, `&gt;`, `&amp;`, `&apos;`, `&quot;` | Accept as predefined XML references |
| Decimal/hex character reference | Accept only valid XML scalar values |
| XInclude | Treat as an ordinary foreign element initially; never fetch or include |

The parser adapter must perform no network or filesystem calls and must accept source bytes, not a
path or URL. The existing Phase 0 raw-content gate remains in front of this experimental parser
until the Phase 3 semantic sanitizer is approved and released.

## Determinism rules

- Pin the direct parser version exactly; no caret or tilde range.
- Commit and review the lockfile dependency graph.
- Copy token images and numeric ranges into project-owned frozen nodes.
- Preserve source order in arrays; never rely on object property enumeration for document order.
- Normalize line endings only at the explicit serialization boundary, not during parsing.
- Never include absolute paths, timestamps, random values, process IDs, or locale-sensitive sorting
  in model output.
- Version the parser adapter and include its exact version in the Phase 1 pipeline fingerprint.

## Security and correctness qualification gate

Before this ADR may become `Accepted`, an isolated parser qualification change must prove:

1. Zero network and filesystem access under instrumented execution.
2. Rejection of DOCTYPE, external identifiers, parameter entities, custom entities, recursive
   entities, expansion bombs, multiple roots, mismatched tags, duplicate attributes, undeclared
   prefixes, invalid namespace bindings, invalid Unicode names, NUL/control characters, and inputs
   over the configured byte limit.
3. Correct preservation of comments, CDATA, processing instructions, namespaces, mixed content,
   attribute order, character references, non-BMP characters, and all source ranges.
4. No recovery result is accepted when either parser error collection is non-empty or a token is
   incomplete/recovery-created.
5. Parse results and diagnostics are byte-for-byte deterministic across repeated runs.
6. The Phase 0 security corpus and a new XML adversarial corpus pass on Node 22/24 and the declared
   operating-system matrix; Node 26 and Node 18 follow their documented smoke/legacy policies.
7. The dependency graph has zero known production vulnerabilities and passes license/SBOM review.
8. Cold parse, standard-corpus throughput, p95 latency, and peak RSS are recorded for the P2-207
   budget decision; this ADR does not invent or waive those budgets.

## License and supply-chain decision

`@xml-tools/parser`, Chevrotain, and `regexp-to-ast` report Apache-2.0 licenses. This is acceptable in
principle for an MIT-distributed application, but final adoption requires repository license review,
retained license/notice obligations, SBOM inclusion, exact-version locking, provenance inspection,
and vulnerability scanning. This ADR is not legal approval.

Adopting one direct and two transitive core dependencies requires removing or qualifying the
absolute “zero-dependency” marketing claim. The accurate replacement is “no framework runtime
dependency; security-reviewed XML parser core.” Documentation changes occur with parser integration,
not in this ADR-only branch.

## Consequences

### Positive

- P2-202 can start from ordered, location-aware syntax without structural regex.
- SVGER owns stable compiler models and is insulated from third-party AST changes.
- XML recovery, DTD, and entity behavior become explicit fail-closed policy.
- Exact syntax locations support stable diagnostics and fuzz minimization.

### Negative

- Core is no longer literally zero-dependency.
- The pinned parser uses an older pinned Chevrotain line and requires dedicated qualification.
- Namespace resolution, immutable model construction, and canonical serialization remain SVGER work.
- A CST consumes more memory than a streaming SAX parser.

### Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Fault-tolerant parser accepts malformed XML | Reject every lex/parse/recovery signal before AST creation |
| Dependency becomes unmaintained | Adapter isolation, exact pin, security monitoring, saxes fallback ADR amendment |
| CST memory overhead | Enforce Phase 0 byte ceiling; measure RSS in P2-207 before acceptance |
| Namespace errors deferred too long | Namespace resolution is the first semantic-model transition and is fail-closed |
| Entity expansion or external access | Reject DOCTYPE/custom entities; byte-only API; instrument no-I/O contract |
| License/notice drift | Lockfile, SBOM, license inventory, release conformance check |

## Approval record

| Review | Approver | Timestamp | Decision | Evidence |
| --- | --- | --- | --- | --- |
| Compiler architecture | Pending | — | Pending | This ADR and P2-202 model sketch |
| Security / DTD-entity policy | Pending | — | Pending | Parser qualification corpus |
| License and supply chain | Pending | — | Pending | License inventory and SBOM diff |
| Support matrix | Pending | — | Pending | Remote qualification matrix |
| Release/package footprint | Pending | — | Pending | Install and packed-package impact |

`P2-202` production implementation is blocked until all five reviews are named and this ADR status
is changed to `Accepted`. A rejected qualification returns the decision to `Proposed`, with `saxes`
as the first fallback candidate.
