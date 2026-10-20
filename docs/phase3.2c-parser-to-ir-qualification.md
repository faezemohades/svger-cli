# Phase 03.2C — Parser-to-IR Differential Qualification

Status: Directive 017 provenance-hardening corrections implemented in the isolated
Saxes-to-Phase-02-contract-to-IR-v1 experiment; management review is pending. This work does not
select a production parser, authorize Phase 03.3, or change production admission, compiler,
generator, optimizer, package API, or build routing.

## Experimental path and boundary

`experiments/phase3/saxes-xml-document-adapter.mjs` provides the bridge from the existing Saxes
qualification adapter into the implementation-neutral contract in
`experiments/phase2/parser-contract-v1.ts`. The Saxes adapter calls the existing
`applySVGInputSafety` reject-mode boundary before constructing Saxes. It returns no parser document
when admission rejects or parsing fails. The new bridge then aligns the successful parser tree with
the independent lexical token index in `experiments/phase2/xml-source-spans.mjs`; parser cursor
positions are never used as source spans. `experiments/phase3/lower-xml-to-ir.ts` remains unaware of
Saxes types and lowers only `SourceDocument` / `XmlDocument` contract data.

Element start tags, ordinary end tags, ordered attributes, leading attribute trivia, comments,
CDATA, and text receive UTF-16 spans only when the corresponding lexical token can be matched and
validated. Attribute qualification checks ordered QName identity, exact name/equal/quote boundaries,
the matching opening/closing quote, and the parsed value after XML attribute normalization. Literal
tabs and line breaks normalize to spaces; numeric character references are decoded after that step
and preserve referenced whitespace. Text tokens are checked against XML line-ending normalization
and predefined/numeric entity decoding. A cursor mismatch is non-consuming: the current token blocks
all later matching, preventing a later repeated sibling from receiving the mismatched node's
provenance. Noncanonical but well-formed end-tag whitespace remains aligned but receives no exact
end-tag span. If a token cannot be qualified, the adapter omits its span and the IR reports unknown
provenance rather than guessing. The source string remains byte-for-byte retained. XML declarations
are not contract nodes, and whitespace outside the root is excluded from prolog/epilog because the
contract represents only comments there.

The lexical index is a bounded experiment helper, not a second XML parser. Security admission stays
authoritative, DTDs/custom entities and non-declaration processing instructions retain their
existing rejection behavior, and adapter-side limits remain active. The exact-pinned, archived Saxes
package is used only as a development reference already present in the lockfile; no dependency or
production parser decision changed.

## Differential evidence

`tests/phase3/parser-to-ir-differential.test.mjs` runs the complete path from source through
admission, Saxes, contract adaptation, lowering, and IR validation. It covers:

- all Phase 00 safe/rejected corpus fixtures and exact existing rejection codes;
- expanded SVG and XLink names, ordered attributes, XML whitespace inheritance, and reset-capable
  lowerer behavior;
- mixed text, nested elements, CDATA, comments, IDs, `href` references, CSS retained opaquely, root
  geometry retained as authored-but-uninterpreted, title/description/ARIA content, and unknown SVG
  elements/attributes retained opaquely;
- CRLF normalization with original CRLF source slices, entity-decoded text with the original `&amp;`
  spelling, non-BMP Unicode UTF-16 offsets, both attribute quote styles, exact attribute trivia,
  self-closing elements, comments, and nested start/end tags;
- source-slice checks for every emitted element, text-like node, and attribute provenance span;
- repeated identical siblings, text/CDATA/text adjacency, comments at nested levels, and a
  noncanonical end tag;
- attribute references combined with literal tab/CRLF normalization and single/double-quote
  boundaries;
- injected start-tag, end-tag, and attribute-token metadata mismatches, proving spans are omitted
  and later coincidental siblings/parent tags are not promoted;
- defensive-copy isolation, verified immutable name sharing, repeated independent invocations,
  rejected malformed input, and lowering failure without a returned IR;
- the existing configurable parser depth ceiling.

The expected semantic assertions are authored by the test and are compared against generated IR
fields. Fixture-authored source does not become a claim of complete independent SVG interpretation:
CSS remains `lexically-retained`, references and accessibility coverage remain `partial`, and
geometry remains opaque/unresolved. The experiment does not claim rendering or framework-output
equivalence.

## Failure and lifecycle limits

Malformed XML in the tested cases is rejected by the mandatory scanner before Saxes construction,
with the established admission error code. Thus the tests establish failure atomicity at the
admission boundary and at an injected lowerer-span failure, but do not provide a naturally occurring
case where Saxes rejects input that the stricter existing scanner admitted. This is recorded as an
evidence limitation rather than weakening admission or introducing a test-only bypass.

The test exercises 30 repeated end-to-end runs and uses weak references after scope exit to observe
XML/IR collectability. It also samples process heap with the source/XML document live and then with
the IR added. Heap values and weak-reference collection are informational and runtime/GC dependent;
they are not thresholds, object-size measurements, concurrency budgets, or evidence for a production
ownership policy. The existing fixture source is small and does not establish large-document or
concurrent memory behavior.

## Reproduction

On Node.js `20.20.2` / npm `10.8.2`:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts --outDir experiments/phase3/.build --rootDir experiments --module ES2022 --moduleResolution Bundler --target ES2022 --strict --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node --expose-gc tests/phase3/parser-to-ir-differential.test.mjs
npm run test:svg-security-corpus
npm run test:phase2:parser
node --expose-gc tests/phase3/ir-v1-conformance.test.mjs
node --expose-gc tests/phase3/xml-to-ir-lowering.test.mjs
npm run quality:full
npm run package:conformance
git diff --check
```

The focused sequence rebuilds production `dist` for the existing security boundary, compiles only
the experimental TypeScript files into ignored `experiments/phase3/.build/`, and runs this isolated
test. No package script was added, so the package manifest/archive contract is not changed for this
experimental test. Temporary compiler output is not included in the package.

Local verification on 2026-10-19 passed the focused adapter/lowering test, Phase 00 SVG security
corpus (6 accepted, 21 rejected), Phase 02 Saxes qualification, both Phase 03.2A/03.2B suites,
`quality:full`, and archive conformance. `quality:full` passed with 155 Jest tests, the existing
lint budget (0 errors, 14 approved warnings), and package smoke at 754 files / 634,254 bytes.
Archive conformance independently reported the same 754 files / 634,254 bytes, below the existing
640,623-byte ceiling. `git diff --check` passed. The final focused lifecycle sample reported a
176,272-byte process-heap delta with source/XML retained and 766,088 bytes with IR added; both XML
and IR weak references cleared after scope/GC in this run. These host-specific values are
illustrative only. The checks were run in the local checkout, not a clean remote CI workflow. No
package manifest, lockfile, release report baseline, or package export was changed by this
experiment.

## Decision boundary

This qualification can establish experimental parser-to-contract-to-IR mapping for the covered
fixtures. It cannot select Saxes for production, establish complete XML token-span coverage,
validate all semantics, resolve the archived-parser maintenance concern, or certify Phase 03.3
shadow generation. Review 035's explicit prohibitions remain in force: no `src/` edits, exports,
framework or optimizer changes, default route changes, or production parser integration.
