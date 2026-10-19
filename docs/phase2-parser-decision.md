# Phase 02.6 — Internal XML Parser Contract and Selection Decision

Status: Directive 011F contract and Directive 011G final verification complete; final management
certification is ready for review. **No production parser is selected.** This record defines an
implementation-neutral internal contract for a future review; it does not authorize production
integration, a Compiler IR migration, or Phase 03 implementation.

The type-only reference contract is
[`parser-contract-v1.ts`](../experiments/phase2/parser-contract-v1.ts). Its compile-time fixture is
[`parser-contract-v1.compile.ts`](../experiments/phase2/parser-contract-v1.compile.ts). Both files
are outside `src/`, are not built into `dist/`, are not exported, and have no runtime behavior.

## Decision

Choose option 3: keep the current production parsing path and make no production parser dependency
selection. The experimental evidence proves that bounded structural parsing is technically feasible
and helps quantify representation costs. It does not establish a maintained library that satisfies
SVGER's strictness, security, fidelity, Node-floor, and stewardship requirements together.

| Candidate                     | Finding                                                                                                                                                                                                                                                                                                    | Decision                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Saxes `6.0.0` plus an adapter | Strong experimental event parser; useful tree and source-span prototype. Upstream repository is archived/read-only, so there is no acceptable upstream security/update path.                                                                                                                               | Do not select for production.             |
| `@xmldom/xmldom` `0.9.12`     | Convenient DOM and lower measured parse latency on the large fixture. The maintainer's policy says malformed XML is not yet reported reliably; a finite passing corpus cannot establish strict well-formedness. Its DOM representation also retains materially more memory and loses lexical distinctions. | Do not select for production.             |
| Maintained successor or fork  | No successor with verified stewardship, update policy, compatibility, and vulnerability-response ownership was qualified in this work package. No internal fork is proposed.                                                                                                                               | Not selected; would require a new review. |

This is not a rejection of structural parsing as an architecture. It is a decision not to bind the
production system to an unmaintained or insufficiently qualified implementation. Faster xmldom
timings are not evidence that it meets the strict malformed-input contract.

At the time of this record, the Saxes repository identifies itself as archived/read-only since
2025-12-31 ([upstream repository](https://github.com/lddubeau/saxes)). The xmldom security policy
states that malformed-input reporting is still not reliable and describes a policy to maintain its
last two minor versions ([security policy](https://github.com/xmldom/xmldom/security/policy)). The
0.9.12 release includes fixes for several parser/resource issues, including malformed end-tag
reporting, but that report remains recoverable rather than fatal; the release notes require a
consumer to escalate it for strict rejection
([0.9.12 release notes](https://github.com/xmldom/xmldom/releases/tag/0.9.12),
[end-tag advisory](https://github.com/xmldom/xmldom/security/advisories/GHSA-6h8r-xr42-gp59)). These
facts inform the no-selection decision; they do not claim that 0.9.12 is affected by every advisory
listed for earlier versions.

## Contract v1 — trust and admission

1. Raw caller input is untrusted. The sole authority that may create `AdmittedSvgSource` is the
   existing SVG security admission boundary (or a future reviewed wrapper around it). A parser
   accepts only that branded value, never a plain string.
2. The brand is a compile-time misuse barrier, not runtime authentication. The admission factory
   must be module-owned, perform actual security checks, and construct the branded value only after
   they succeed. Runtime validation and trusted module boundaries remain necessary.
3. Admission remains mandatory and precedes parsing/tree allocation. Existing rejection policy,
   UTF-8 and XML 1.0 checks, DTD/entity prohibition, active-content/event/external-reference policy,
   and current size/depth/element/attribute limits are not weakened or delegated to the parser.
   Existing security diagnostic codes pass through unchanged.
4. The parser must not resolve network or filesystem resources, load external entities, or add DTD
   entity definitions. Only the XML predefined and numeric character references admitted by the
   security boundary are accepted.

The current `applySVGInputSafety()` returns a string and does not create this brand. Wiring the
production scanner to a typed admission object is intentionally deferred; this contract file does
not change that API.

## Contract v1 — document and namespace semantics

- A successful parse returns exactly one document element. Comments before and after the root are
  retained in ordered `prolog`/`epilog` collections. The XML declaration is document metadata, not a
  child node. DOCTYPE and non-declaration processing instructions remain rejected by admission.
- Element child order is source order. `text`, `cdata`, and `comment` are distinct node kinds;
  adjacent text events are not trimmed, reordered, or coalesced by the parser contract. CDATA node
  value excludes `<![CDATA[` / `]]>` delimiters, while an optional content span can locate that
  value. Consumers, not the parser, apply inherited `xml:space` rendering semantics.
- Elements and attributes carry original qualified spelling, prefix, local name, and expanded
  namespace URI. `null` means no namespace; default namespaces apply to unprefixed elements, not
  unprefixed attributes. Namespace declaration attributes remain in source attribute order.
- Attribute values and text values are logical XML-decoded values. Predefined/numeric references are
  decoded; XML line-ending and attribute-value normalization follow XML 1.0. Original spelling,
  quoting, whitespace, entity notation, and CRLF/LF form are not reconstructed from decoded values.
  The unchanged source remains the lexical authority.
- The parser preserves text/CDATA whitespace and does not infer display or SVG layout semantics.
  Semantic consumers must use the expanded names and preserve relevant whitespace.

The normalization rules above are contract requirements, not all experimentally certified across
every XML token edge case. Before any production adapter is accepted, differential fixtures must
cover line endings, XML attribute whitespace normalization, entity spellings, namespaces, comments,
CDATA, and `xml:space` against the selected implementation.

## Contract v1 — source ownership and locations

`SourceDocument.text` is the exact admitted JavaScript string, retained by reference and never
rewritten or replaced by serializer output. JavaScript strings are immutable. Parse-result nodes and
collections are readonly in the type contract; an implementation must either deep-freeze the owned
tree or guarantee exclusive ownership and no mutation after returning it. The caller releases the
parse tree and source by dropping its result/IR references; the parser exposes no persistent
document cache or disposal handle.

`SourceSpan` uses zero-based UTF-16 code-unit offsets with inclusive `start` and exclusive `end`
into the exact retained source string. A span is valid only when it identifies raw source
characters. In particular, XML-decoded text/attribute values do not get synthetic spans, parser
event cursors are not token spans, and line/column are not substitutes for source offsets. A
`ParserCursor.offset` is an exclusive UTF-16 parser cursor usable for diagnostics only; consumers
must not use it as an edit range. Contract v1 deliberately omits line/column guarantees until a
cross-parser CRLF/non-BMP mapping is separately qualified.

Span retention is selectable:

| Policy               | Guarantee                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`               | Retain exact source and structure, but attach no node/attribute spans. Structural transforms needing edits must use a separately qualified source index.                               |
| `node-spans`         | Raw spans for element start/end tags and text, CDATA, and comments. No promise to preserve attribute trivia independently.                                                             |
| `full-lexical-spans` | `node-spans` plus each attribute's exact name-through-quote span, preceding whitespace/trivia span, and CDATA content span. This is the mode needed for precise attribute-local edits. |

Span policy changes metadata allocation, not admitted syntax or decoded-tree semantics. A future
source-preserving transformer must apply bounded, non-overlapping edits to the retained original
text. It must not serialize the entire parsed tree and claim lexical preservation. Span coverage and
UTF-16 slicing across CRLF and surrogate pairs require executable tests before production use.

## Contract v1 — limits, failures, and lifecycle

The following are proposed parser hard ceilings, aligned to current admission/experimental limits;
caller options may lower them only. Implementations must validate option values at runtime and
reject attempts to raise a ceiling.

| Limit                      | v1 ceiling |
| -------------------------- | ---------: |
| UTF-8 source bytes         |     10 MiB |
| Element nesting depth      |        256 |
| Element count              |    100,000 |
| Attributes per element     |        256 |
| Aggregate attributes       |    200,000 |
| Decoded text + CDATA bytes |     10 MiB |

Parse is synchronous and single-document. A signal already aborted on entry fails before parser
allocation. Implementations check cancellation at internal bounded checkpoints where available, but
cannot promise event-loop-delivered cancellation during one uninterrupted synchronous call. Limit,
cancellation, and parser failures release temporary parser state and partial trees; the outcome is
atomic and never exposes a partially successful document. A later asynchronous/chunked parser would
need a separately defined cancellation contract.

Failures are discriminated outcomes, not partially populated documents. Diagnostics have stable
codes and sanitized messages that never echo source snippets, attribute values, entity text, or
attacker-controlled parser details. Existing admission errors keep their established codes. Parser
errors use the contract's stable parse/namespace/limit/cancellation codes. Exact raw token spans may
be attached when established; otherwise a parser cursor is explicitly marked as a cursor.

The type-level ceilings and outcomes are specified in
[`parser-contract-v1.ts`](../experiments/phase2/parser-contract-v1.ts). Compile-time checks reject a
forged admitted value and a document on the failure branch. This does not test runtime admission or
make the experimental contract file a parser implementation.

## Representation and lifetime decision

The preferred _future investigation_ is a minimal immutable structural tree with selectively
retained lexical spans, but this is not an approved production design. The alternatives remain:

| Strategy                        | Evidence and trade-off                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full structural tree            | Convenient random access; the experimental Saxes adapter retained ~2.65 MiB on the 187 KiB / 4,921-element fixture. Persistent lifetime and allocation are real costs.                                                        |
| SAX events only                 | Lowest retained structure in this comparison (~0.2 MiB); suitable for one-pass consumers, but awkward for random access, reordering, and multiple compiler passes.                                                            |
| Tree plus all source spans      | Supports structure plus precise edits, but source spans alone retained ~2.79–2.82 MiB on the same fixture. The combination was not measured and must not be estimated as merely the maximum of those standalone measurements. |
| Lazy structural materialization | Could reduce average retention if only a small subtree is needed; adds reparsing/indexing complexity and risks repeated work. It was not prototyped or measured.                                                              |

Parser-owned temporary state ends when `parse` returns. The caller owns the immutable parse result;
later Compiler IR may retain a subset of nodes, attributes, source spans, or the source string under
its own explicit lifetime. Parser allocation and long-lived IR memory budgets are separate. A future
concurrent batch budget must account for number of in-flight trees and retained source texts; the
current serial benchmark cannot establish it.

## Performance baseline and proposed limits

The Phase 02.5 measurements are accepted as reference-host characterization only. They used Linux on
an AMD Ryzen 9 7845HX, Node 18.20.6 / npm 10.8.2 and Node 24.13.1 / npm 11.8.0, and disposable
workers with a 384 MiB V8 old-space setting. Full fixture/methodology/results are in the
[Phase 02.5 report](phase2-parser-performance.md) and
[raw observations](../experiments/phase2/performance-results.json).

| Candidate guardrail                   | Status                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| 187 KiB structural fixture p95 ≤30 ms | Candidate only; largest per-config sample is 30 warm iterations.                        |
| 9.44 MiB text fixture median ≤350 ms  | Informational; current measurement has only two warm samples.                           |
| Structural retained heap ≤3.2 MiB     | Candidate only for the standalone Saxes tree on the specified fixture/method.           |
| Incremental peak RSS ≤40 MiB          | Candidate only for one parse on this reference host; not a compiler/concurrency budget. |

These are not active gates. Any later hard budget must name the exact fixture, process/memory
measurement, runtime, host class, and sample count. The current benchmark shows that near-cap text
processing is materially slower than security scanning alone and that full DOM retention is larger
than the minimal experimental tree. No universal latency or memory guarantee follows.

## Verified, proposed, assumed, and deferred

| Class                       | Record                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified experimental facts | The bounded shared security corpus and semantic/source fixtures passed for the isolated prototypes. Both tested Node versions completed deterministic latency, memory, and rejected-input workers. On the tested large structural fixture, Saxes adapter retention was ~2.65 MiB and xmldom DOM retention ~6.8–6.9 MiB. |
| Proposed architecture       | Branded admission type; ordered immutable nodes; expanded names plus qualified spelling; exact source retention; selectable raw spans; stable failures; hard resource ceilings; no implicit serializer round-trip.                                                                                                      |
| Unverified assumptions      | The proposed type contract does not prove all XML 1.0 normalization details, span coverage, runtime immutability, cancellation behavior, concurrent allocation, or exact Node 18.17.x compatibility. It does not prove that future Compiler IR should equal this parse tree.                                            |
| Deferred                    | Any runtime implementation, production parser dependency, source-span adapter promotion, broader XML conformance, cross-parser locations, async cancellation, concurrent parser/IR memory budget, dependency remediation, or Phase 03 compiler work.                                                                    |

## Conditions before production integration

A future management gate must require all of the following before a parser is integrated into a
production path:

1. A maintained implementation with named stewardship, update/compatibility policy, vulnerability
   response, supported Node-floor evidence, license and transitive-dependency review.
2. Independent adversarial XML 1.0/namespace/DTD/entity tests proving strict malformed-input
   failure, no external resolution, bounded resource behavior, and stable diagnostics on the exact
   pinned package version.
3. Differential source/semantic fixtures for text, CDATA, comments, namespaces, attribute order and
   normalization, CRLF, non-BMP offsets, span coverage, and exact preservation edits.
4. A measured representation/lifetime decision including tree-plus-spans together, repeated cleanup,
   and concurrent batch memory under an authorized workload.
5. A reviewed parser implementation/admission adapter with runtime limits and cancellation
   semantics, plus clean-checkout quality, Phase 00/01, parser, package, and compatibility gates.
6. Explicit approval to integrate and expose any needed internal API. The current outcome supplies
   no such approval.

## Roadmap disposition

Phase 02.6 has completed the contract and non-selection decision. Phase 02 remains experimental
qualification-only; no production parser prerequisite is satisfied. Phase 03 implementation is still
unauthorized. If parser-independent compiler design is later desired, management must issue a
separate gate that explicitly permits that work while continuing to prohibit production parser
integration. Dependency audit findings, GOV-001/GOV-002, SEC-INC-001, publishing restrictions, and
the exact Node 18.17.x floor remain independently open as tracked by their existing records.

## Directive 011G final verification record

Verification was performed on the checked-out working tree based on commit
`5df848b384d3ea74f9fa271cc3fd4f55ec9d5e6f`. The worktree was not clean; existing user changes were
preserved and no commit was created. Runtime: Node.js `20.20.2`, npm `10.8.2`, Linux x64. The shell
initially had no Node executable on `PATH`; stale/incomplete bundled Node executables exited with
status 139. A working Node 20 runtime already installed with the local Actions runner was selected,
then `npm ci --no-audit --no-fund` completed successfully (453 packages, exit 0). The first
`quality:full` attempt, before reinstalling dependencies, exited 1 because the existing
`node_modules/@angular/core` install lacked its declared `index.d.ts`; no source or lockfile change
was made to address it. The lockfile-driven install restored the declaration, and the complete gate
then passed.

| Command                                                                                                                                                                                            | Result                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck experiments/phase2/parser-contract-v1.ts experiments/phase2/parser-contract-v1.compile.ts` | Exit 0                                                                                                      |
| `npx prettier --check` on the Phase 02 contract and decision documents                                                                                                                             | Exit 0 after formatting three files                                                                         |
| `npx eslint experiments/phase2/parser-contract-v1.ts experiments/phase2/parser-contract-v1.compile.ts`                                                                                             | Exit 0                                                                                                      |
| `npm run test:phase2:parser`                                                                                                                                                                       | Exit 0; isolated Saxes/xmldom security and fidelity qualification passed                                    |
| `npm run quality:full`                                                                                                                                                                             | Exit 0; full fast, privacy, Jest, framework/integration, Phase 00, Phase 01, and package-smoke gates passed |
| `npm run package:conformance`                                                                                                                                                                      | Exit 0; 754 entries, 634,254 packed bytes                                                                   |
| `git diff --check`                                                                                                                                                                                 | Exit 0                                                                                                      |

The package-conformance report's pack inventory contains no `experiments/` entries and no
`parser-contract-v1` paths. The tarball remains within the existing 640,623-byte ceiling. These
results certify the current working tree, not the bare commit hash; a clean commit and remote CI
review remain separate repository-governance actions. To identify the final uncommitted source
snapshot, SHA-256 of the sorted path-and-content SHA-256 manifest for all tracked and
non-ignored-untracked files is `163aa2994969caaa8a75c3c9611a7600092acbe68b573f533441cb55fd5b3f7c`.
The manifest excludes this decision record itself (which contains the digest), `.git`, and
ignored/generated files.
