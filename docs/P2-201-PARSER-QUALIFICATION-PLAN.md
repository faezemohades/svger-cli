# P2-201 Parser Qualification Plan

Date: 2026-07-18

Status: Proposed - documentation-only

Branch: `phase/2-parser-selection-adr`

Related ADR: `docs/ADR-P2-201-XML-PARSER-SELECTION.md`

## Verdict

```text
P2-201 ADR RESEARCH: CONTINUES
PARSER INSTALLATION: NOT AUTHORIZED
PRODUCTION IMPLEMENTATION: NOT AUTHORIZED
QUALIFICATION PLAN: DRAFTED FOR REVIEW
FORMAL APPROVAL: PENDING
```

This plan defines the evidence required before `@xml-tools/parser@1.0.11` can be adopted by
SVGER-CLI. It does not add dependencies, does not modify the lockfile, and does not authorize
P2-202 production work.

## Registry And Tarball Evidence

The following metadata was read from the TLS-verified npm registry on 2026-07-18 using
`env -u NODE_TLS_REJECT_UNAUTHORIZED`. The tarballs were then downloaded and extracted in a
disposable directory outside the repository. No repository dependency file was modified.

| Package | Version | License | Direct dependencies | SHA-256 | Files | Install scripts |
| --- | ---: | --- | --- | --- | ---: | --- |
| `@xml-tools/parser` | 1.0.11 | Apache-2.0 | `chevrotain@7.1.1` | `ff9d96ab22f7ca0b5f11d4a2b4b6ad65ee62c73e186d1b13021a475e6e12afd5` | 9 | None |
| `chevrotain` | 7.1.1 | Apache-2.0 | `regexp-to-ast@0.5.0` | `9cbea943f1aef15a1054d3e3d8f0cfb3736720ae77a926df9a83207f6bf522af` | 240 | None |
| `regexp-to-ast` | 0.5.0 | MIT | None | `19a7f98b1610fb450eb0f584374ecae2d200f84c102f1ea6860c249b2c910c08` | 6 | None |

The direct parser version must be pinned exactly if adopted. The lockfile graph must be reviewed
and bound to the accepted ADR before any production integration begins.

Initial extracted evidence is recorded in `reports/phase2-parser-supply-chain-evidence.md`. Final
approval still requires repository/source correspondence, SBOM delta, vulnerability audit, and a
complete published-file inventory attached to the qualification PR.

## Qualification Boundary

The qualification change must be isolated from production compiler code. It may use a temporary
test harness under a dedicated experimental path only after explicit review approval. The harness
must prove parser behavior against source bytes and must not export third-party CST or token types
as SVGER public or internal architecture.

Allowed before ADR acceptance:

- Corpus design.
- Threat modeling.
- License and SBOM review.
- Benchmark design.
- Documentation-only ADR review.

Blocked before ADR acceptance:

- Adding `@xml-tools/parser` to `package.json`.
- Modifying `package-lock.json`.
- Adding production parser adapters.
- Creating the production `ParsedXMLAST` implementation.
- Replacing existing compiler parsing behavior.
- Merging or releasing Phase 2 behavior.

## Required Corpus

The qualification corpus must include the following groups before the ADR can move to `Accepted`.

| Corpus group | Minimum contract |
| --- | --- |
| Valid SVG basics | Single-root SVGs, empty elements, nested elements, attributes, text nodes |
| Lexical preservation | Comments, CDATA, processing instructions, XML declaration, entity references, character references |
| Namespace coverage | Default namespace, prefixed names, namespace shadowing, undeclared prefixes, duplicate expanded attributes |
| Malformed XML | Mismatched tags, duplicate raw attributes, missing closers, invalid names, invalid control characters, trailing non-whitespace |
| Entity and DTD containment | DOCTYPE, internal subset, external ids, parameter entities, custom named entities, recursive entity patterns |
| Security corpus reuse | Phase 0 unsafe SVG cases, raw-script cases, `on*` attributes, `javascript:` URI cases |
| Size and resource limits | Boundary-sized files, oversized files, deeply nested nodes, large attribute sets, large text/CDATA |
| Determinism | Repeated parse output and diagnostic snapshots from identical bytes |
| Location fidelity | Source ranges for document, elements, attributes, text, CDATA, comments, PI, and references |
| Platform matrix | Node 22/24 on Ubuntu, Windows, and macOS; Node 26 smoke; Node 18 legacy smoke only |

## Named Fixture Contracts

Every corpus requirement must be represented as a named fixture in the qualification harness. The
first required fixture set is:

| ID | Category | Expected decision | Expected diagnostic | AST absent | I/O zero | Timeout | Platforms |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| `XML-VALID-BASIC-001` | valid-svg | accept | None | No | Yes | 1000 | linux, windows, macos |
| `XML-LEXICAL-CDATA-001` | lexical | accept | None | No | Yes | 1000 | linux, windows, macos |
| `XML-LEXICAL-COMMENT-001` | lexical | accept | None | No | Yes | 1000 | linux, windows, macos |
| `XML-LEXICAL-PI-001` | lexical | accept | None | No | Yes | 1000 | linux, windows, macos |
| `XML-MALFORMED-001` | malformed | reject | `E_XML_PARSE_FAILED` | Yes | Yes | 1000 | linux, windows, macos |
| `RECOVERY-INSERTED-TOKEN-001` | recovery | reject | `E_XML_RECOVERY_FORBIDDEN` | Yes | Yes | 1000 | linux, windows, macos |
| `RECOVERY-SKIPPED-TOKEN-001` | recovery | reject | `E_XML_RECOVERY_FORBIDDEN` | Yes | Yes | 1000 | linux, windows, macos |
| `DOCTYPE-SYSTEM-001` | security | reject | `E_XML_DOCTYPE_FORBIDDEN` | Yes | Yes | 1000 | linux, windows, macos |
| `ENTITY-INTERNAL-001` | security | reject | `E_XML_CUSTOM_ENTITY_FORBIDDEN` | Yes | Yes | 1000 | linux, windows, macos |
| `ENTITY-EXTERNAL-001` | security | reject | `E_XML_EXTERNAL_ENTITY_FORBIDDEN` | Yes | Yes | 1000 | linux, windows, macos |
| `ENTITY-BOMB-001` | security | reject | `E_XML_ENTITY_EXPANSION_FORBIDDEN` | Yes | Yes | 1000 | linux, windows, macos |
| `NAMESPACE-UNDECLARED-PREFIX-001` | namespace | reject | `E_XML_NAMESPACE_UNDECLARED_PREFIX` | Yes | Yes | 1000 | linux, windows, macos |
| `NAMESPACE-DUPLICATE-EXPANDED-ATTR-001` | namespace | reject | `E_XML_NAMESPACE_DUPLICATE_ATTRIBUTE` | Yes | Yes | 1000 | linux, windows, macos |
| `LOCATION-CRLF-UNICODE-001` | location | accept | None | No | Yes | 1000 | linux, windows, macos |
| `DETERMINISM-REPEAT-100` | determinism | accept | None | No | Yes | 5000 | linux, windows, macos |
| `RESOURCE-MAX-DEPTH-001` | resource | reject | `E_XML_RESOURCE_LIMIT_EXCEEDED` | Yes | Yes | 1000 | linux, windows, macos |
| `RESOURCE-MAX-ATTRIBUTE-001` | resource | reject | `E_XML_RESOURCE_LIMIT_EXCEEDED` | Yes | Yes | 1000 | linux, windows, macos |
| `SUPPLYCHAIN-INTEGRITY-001` | supply-chain | accept | None | N/A | N/A | 1000 | linux |

## Acceptance Checks

The future qualification harness must produce machine-readable evidence with these checks:

| Check | Required result |
| --- | --- |
| Parser errors | Any `lexErrors` or `parseErrors` fails closed |
| Recovery artifacts | Any inserted, missing, incomplete, or recovery-created token fails closed |
| I/O containment | Network and filesystem calls are instrumented and remain zero |
| DTD/entity policy | DOCTYPE, external ids, parameter entities, and custom entities are rejected |
| Predefined references | `lt`, `gt`, `amp`, `apos`, and `quot` are preserved or decoded only by SVGER policy |
| Character references | Invalid XML scalar values are rejected |
| Namespace policy | Namespace binding errors are fatal in the semantic transition design |
| Determinism | Repeated outputs and diagnostics are byte-for-byte identical |
| Performance evidence | Cold parse, corpus throughput, p95 latency, and peak RSS are recorded, not approved |
| Supply chain | License inventory, SBOM diff, exact lockfile graph, and audit result are attached |

## Required Evidence Files

The qualification PR should add or update these evidence files after it is explicitly authorized:

| Evidence | Purpose |
| --- | --- |
| `reports/phase2-parser-qualification.md` | Human-readable qualification result |
| `reports/phase2-parser-qualification.json` | Machine-readable matrix and artifact hashes |
| `reports/phase2-parser-license-review.md` | License, notice, SBOM, and package-footprint review |
| `reports/phase2-parser-benchmark-baseline.json` | Raw performance measurements for P2-207 budgeting |
| `docs/ADR-P2-201-XML-PARSER-SELECTION.md` | Status and named approval record |

## Approval Gate

P2-201 cannot become `Accepted` until every row has a named approver and timestamp.

| Review | Required approver | Status | Evidence |
| --- | --- | --- | --- |
| Compiler architecture | Pending | Pending | ADR plus qualification report |
| Security and DTD/entity policy | Pending | Pending | Corpus and no-I/O instrumentation |
| License and supply chain | Pending | Pending | License review and SBOM diff |
| Support matrix | Pending | Pending | Remote matrix evidence |
| Release/package footprint | Pending | Pending | Package impact and conformance review |
| Performance and resource behavior | Pending | Pending | Benchmark and resource-limit evidence |

If any review rejects the selected parser, the ADR remains `Proposed` and `saxes@6.0.0` becomes the
first fallback candidate for a revised ADR.
