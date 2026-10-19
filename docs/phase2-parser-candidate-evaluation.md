# Phase 02.2 — XML Parser Candidate Evaluation

Status: desk evaluation and QUAL-001–006 experiments complete, including Phase 02.5 performance
measurements. Phase 02.6 records the final qualification outcome: no production parser is selected.
Node-floor review and an approved maintenance strategy remain prerequisites for any future parser
selection. Exact-pinned parsers are development-only qualification dependencies; no production
parsing path changed. See the [Phase 02.5 report](phase2-parser-performance.md) and
[Phase 02.6 decision](phase2-parser-decision.md).

## Evaluation method

Weights reflect Directive 011: critical criteria receive 12 points each, high-priority criteria 8,
for a total of 100. Scores are preliminary desk-review judgments (1 = poor fit, 5 = strong fit), not
test results. Weighted total is `sum(weight × score) / 5`, reported on a 100-point scale. A critical
criterion scoring below 3 is a qualification blocker regardless of total.

| Criterion                                    | Priority | Weight |
| -------------------------------------------- | -------- | -----: |
| XML well-formedness and correctness          | Critical |     12 |
| DTD/entity/XXE security control              | Critical |     12 |
| Text, CDATA, and whitespace fidelity         | Critical |     12 |
| Namespace correctness                        | Critical |     12 |
| Predictable resource consumption             | Critical |     12 |
| Source locations and diagnostics             | High     |      8 |
| Attribute ordering and source fidelity       | High     |      8 |
| TypeScript compatibility and maintainability | High     |      8 |
| Dependency security and maintenance          | High     |      8 |
| Performance and memory                       | High     |      8 |

## Candidates

### A. `saxes` event parser plus a bounded adapter and retained source

Saxes is a JavaScript/TypeScript evented, non-validating XML parser. Its project documentation
states support for XML 1.0/1.1 and Namespaces, strict well-formedness intent, event callbacks, and
optional line/column/position tracking. It handles the five predefined XML entities, but does not
process DTD-defined custom entities; it does not thoroughly parse DTD contents. It has no native
tree, so a consumer would construct only the internal node representation actually required and
preserve the original string separately for exact source slices.

Implications: good candidate for a structural parsing prototype and source-location adapter; it does
not itself enforce SVGER's fail-closed DTD policy, apply SVG active-content policy, impose the
existing input-size/depth/count limits, or retain lexical source form. Saxes can emit events
incrementally, but the current caller already owns a bounded input string, and building a full tree
still consumes memory proportional to the document. Any `doctype` event must cause rejection; no
entity table mutation or fetch/resolve behavior may be added.

### B. `@xmldom/xmldom` DOM parser/serializer

The scoped package provides a JavaScript DOMParser and XMLSerializer and documents a Node.js floor
(>=14.6) compatible with this project's declared `>=18.17.0` floor. The exact pin
`@xmldom/xmldom@0.9.12` (MIT, no runtime dependencies) passed the same Phase 00 safe/rejected corpus
and a namespace/text semantic fixture when used behind the existing safety boundary. However, the
project describes incomplete standards coverage and explicitly says malformed-input reporting is not
yet reliable. Its security policy documents advisory history; the latest reviewed release notes
include fixes for multiple parser resource-exhaustion issues. Passing this bounded corpus is not a
clean bill of health.

Implications: convenient tree API, but a DOM/serializer pair is not source-preserving; it can change
lexical representation even when the parsed XML meaning is equivalent. Current advisory history,
standards deviations, and reliance on parser options/error handling raise qualification burden.
External I/O and DTD/entity behavior must be proven by tests, not inferred from a DOM API name.

### C. Retain current scanner and custom tree parser as the structural approach

This avoids a new dependency and preserves existing diagnostics and source-oriented helpers. It does
not meet the future parser objective as-is: the security scanner is purpose-built for bounded input
and threat detection, while `svg-tree-parser.ts` is a limited, lossy SVG tree parser rather than a
complete XML implementation. Extending both into a fully correct parser would create substantial
maintenance and conformance-test ownership.

Implications: keep the scanner as the security boundary in all cases, but do not treat it or the
custom optimizer parser as a qualified general-purpose XML parser without a separate conformance
effort.

## Preliminary weighted comparison

| Criterion (weight)                  | Saxes + adapter | xmldom DOM | Current implementations |
| ----------------------------------- | --------------: | ---------: | ----------------------: |
| Well-formedness (12)                |               5 |          4 |                       2 |
| DTD/entity/XXE controls (12)        |               4 |          2 |                       4 |
| Text/CDATA/whitespace (12)          |               4 |          3 |                       2 |
| Namespaces (12)                     |               5 |          4 |                       3 |
| Resource predictability (12)        |               3 |          2 |                       3 |
| Locations/diagnostics (8)           |               5 |          3 |                       3 |
| Attribute order/source fidelity (8) |               3 |          2 |                       4 |
| TS/maintainability (8)              |               4 |          4 |                       3 |
| Dependency security/maintenance (8) |               1 |          2 |                       5 |
| Performance/memory (8)              |               4 |          2 |                       3 |
| Preliminary weighted score / 100    |        **77.6** |   **56.8** |                **62.4** |

The table scores a _candidate architecture_, not the package in isolation. Saxes receives a lower
source-fidelity score because the adapter must retain the original string and build span-aware
metadata. The current approach scores well for lexical/source preservation and no dependency cost,
but poorly on full XML correctness and tree fidelity. These estimates do not establish security,
performance, or compatibility acceptance.

## Provisional direction and rejected alternatives

The QUAL-004 comparison decision is **retain Saxes only as an experimental reference and postpone
production selection**. Saxes passes the current differential and fidelity checks but its upstream
repository is archived. `@xmldom/xmldom` is actively maintained and passes the bounded shared
corpus, but its documented malformed-input reporting limitation is incompatible with selecting it as
a strict parser without further qualification. Neither candidate currently clears both maintenance
and strictness gates. The custom tree parser remains a behavioral baseline for existing optional
optimizers, not the selected general XML parser.

Keeping/extending the in-house tree parser is also not selected as a general parser because it would
require taking on XML conformance and security maintenance that the repository currently delegates
neither to a standard parser nor test suite.

No candidate is accepted for production until the staged qualification is complete. In particular,
the scores above must be updated from reproducible tests in 02.3 (security), 02.4 (semantic/source
fidelity), and 02.5 (resource/performance). Any dependency decision also requires lockfile, license,
transitive dependency, vulnerability, package-size, and Node compatibility review.

## Qualification evidence and next checkpoint

Evidence reviewed for this desk evaluation and qualification planning:

- Repository state at baseline `5df848b384d3ea74f9fa271cc3fd4f55ec9d5e6f`, including the components
  listed in [the current-state inventory](phase2-parser-inventory.md).
- Saxes project documentation: <https://github.com/lddubeau/saxes>.
- Saxes archive/maintenance status: <https://github.com/lddubeau/saxes> (repository banner and
  activity status).
- Pinned registry metadata: `saxes@6.0.0` (ISC, Node >=12.22.7, one dependency `xmlchars@2.2.0`,
  163,774 unpacked bytes); `xmlchars@2.2.0` (MIT, no dependencies, 58,957 unpacked bytes). The
  combined unpacked package payload is 222,731 bytes; this is not the compressed SVGER tarball
  delta.
- Alternative pin: `@xmldom/xmldom@0.9.12`, MIT, Node >=14.6, no runtime dependencies. It passed the
  shared bounded fixture comparison only behind the mandatory scanner. Its security policy states
  malformed XML is not reported reliably yet; see <https://github.com/xmldom/xmldom/security/policy>
  and the reviewed release notes at <https://github.com/xmldom/xmldom/releases>.
- `@xmldom/xmldom` project documentation and security policy: <https://github.com/xmldom/xmldom> and
  <https://github.com/xmldom/xmldom/security>.
- W3C XML 1.0 Fifth Edition: <https://www.w3.org/TR/xml/>.

The prototype results and current supply-chain gate are recorded in
[the qualification record](phase2-parser-qualification.md). The current mandatory scanner continues
to decide input admission. No Phase 03 semantic model, global normalization, broad serializer
rewrite, or production parser switch is part of this evaluation.
