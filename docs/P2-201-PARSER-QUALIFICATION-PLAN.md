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

## Registry Evidence

The following metadata was read from the TLS-verified npm registry on 2026-07-18 using
`env -u NODE_TLS_REJECT_UNAUTHORIZED`.

| Package | Version | License | Direct dependencies | Integrity |
| --- | ---: | --- | --- | --- |
| `@xml-tools/parser` | 1.0.11 | Apache-2.0 | `chevrotain@7.1.1` | `sha512-aKqQ077XnR+oQtHJlrAflaZaL7qZsulWc/i/ZEooar5JiWj1eLt0+Wg28cpa+XLney107wXqneC+oG1IZvxkTA==` |
| `chevrotain` | 7.1.1 | Apache-2.0 | `regexp-to-ast@0.5.0` | `sha512-wy3mC1x4ye+O+QkEinVJkPf5u2vsrDIYW9G7ZuwFl6v/Yu0LwUuT2POsb+NUWApebyxfkQq6+yDfRExbnI5rcw==` |
| `regexp-to-ast` | 0.5.0 | MIT | None | `sha512-tlbJqcMHnPKI9zSrystikWKwHkBqu2a/Sgw01h3zFjvYrMxEDYHzzoMZnUrbIfpTFEsoRnnviOXNCzFiSc54Qw==` |

The direct parser version must be pinned exactly if adopted. The lockfile graph must be reviewed
and bound to the accepted ADR before any production integration begins.

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

If any review rejects the selected parser, the ADR remains `Proposed` and `saxes@6.0.0` becomes the
first fallback candidate for a revised ADR.
