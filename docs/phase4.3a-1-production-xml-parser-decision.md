# Phase 04.3A-1 — Production XML Parser Decision Proposal

Status: Directive 033 is approved and closed by Engineering Review 053. Directive 034 implemented
the selected proposal: the existing production scanner in `src/security/svg-xml-safety.ts` now
exposes a bounded, ordered XML document only after mandatory admission succeeds. No third-party
parser or runtime dependency was selected.

## Decision

Reuse the production scanner/tokenizer as the sole XML parsing implementation for the initial Svelte
opt-in. Do not promote Saxes or `@xmldom/xmldom`, and do not use the optimizer's `parseSVG()` as a
production XML parser.

The proposed internal boundary is an `admitAndParseSVG()`-style operation owned by the security
module:

1. Run the current `applySVGInputSafety()` reject-mode admission, including UTF-8 size, XML lexical,
   DTD/entity, namespace, active-content, external-reference, CSS and current count checks.
2. Only after admission returns the exact safe source, invoke a document-collection mode in the same
   scanner/tokenizer implementation. The document-collection mode must itself fail closed and must
   not be a public/package export.
3. Lower the returned document to IR v1 and call the existing Svelte JS or TS IR emitter.

The second pass is intentional: it avoids allocating a candidate document before mandatory admission
completes, while reusing the scanner's one tokenizer rather than introducing a parallel parser. If
this separation cannot be maintained in implementation without duplicating or weakening scanner
validation, stop and return for review rather than falling back to another parser.

## Production infrastructure assessment

`scanSVGSecurityBoundary()` is not just a substring detector. It already walks start/end tags,
quoted attributes, comments, CDATA, text and entity references; checks one SVG root and matching tag
nesting; applies depth, element and per-element attribute limits; tracks inherited default SVG,
`xml` and `xlink` namespace bindings; and inspects attributes/text for active content and unsafe
references. Its ordered local `Attr[]` entries and stack frames are currently private and discarded.
The scanner returns findings/strip edits, not XML nodes, and therefore cannot feed IR v1 as-is.

The existing optimizer `parseSVG()` is unsuitable: it trims text and comments, merges text into a
single content field, stores attributes in a `Map`, skips unknown elements, has no expanded
namespace model, and recovers from malformed/incomplete tags. It is an optional optimizer helper,
not an admission/parser contract.

The scanner's admitted language is narrower than arbitrary XML, by policy. It accepts only the SVG
default element namespace and the supported `xml`/`xlink` attribute prefixes, rejects DTDs and
non-declaration processing instructions, and currently uses an ASCII-oriented XML-name grammar. That
is compatible with the initial Svelte emitter's supported SVG subset; other admitted cases must
remain errors/unsupported, not be omitted. This proposal does not broaden what the security boundary
admits.

Before a document projection can be approved for IR lowering, its implementation must retain source
attribute order and child order; distinguish text, CDATA and comment nodes; compute expanded names
for accepted SVG/XML/XLink names; preserve exact original source separately; apply XML 1.0 text
line-ending and attribute-value whitespace normalization; and reject invalid ordinary-text `]]>`. It
must add/verify aggregate-attribute and decoded-text ceilings, retain atomic failures, and return no
partial document. Existing error codes for admitted-input rejection remain unchanged. Any parser
diagnostic introduced by the projection must be sanitized and stable.

These are bounded requirements for one existing security implementation, not evidence that the
current scanner already satisfies the full XML document contract. Focused regression and adversarial
tests are required when the projection is implemented.

## Why not promote Saxes now

The already-qualified exact version is `saxes@6.0.0` (ISC) with `xmlchars@2.2.0` (MIT). The
experimental adapter demonstrated namespace-aware events and ordered child structure behind the
mandatory scanner. However, the upstream GitHub repository is archived/read-only, and npm lists
6.0.0 as published five years ago. The project README describes XML 1.0/1.1 and namespace support,
but also says DTD contents are not thoroughly parsed; SVGER must continue to reject every DOCTYPE
before parser use and never add entities. Promoting this exact pin would place parser vulnerability
response and continued maintenance on SVGER without an upstream update path.

Because production already has a bounded tokenizer that performs the same admission walk, a
second-party parser dependency is not justified for this initial static Svelte route. Saxes remains
the experimental differential reference, not the production dependency. This decision does not claim
its parser evidence is invalid; it weighs that evidence against stewardship risk and the existing
security implementation.

## Dependency, package, and migration impact

- New production dependencies: none.
- Existing development-only `saxes@6.0.0` and `xmlchars@2.2.0`: unchanged; retained only for Phase
  02/03 qualification tests.
- `@xmldom/xmldom@0.9.12`: unchanged and development-only; not a production fallback.
- Production parser behavior: now includes the admitted-source document projection implemented under
  Directive 034; the legacy parser/template path remains the default.
- Package/archive: no parser code is added and no manifest dependency moves. Current archive checks
  continue to enforce the existing 640,623-byte ceiling.
- Migration: next implementation gate should add the internal projection and Svelte opt-in through
  the existing processor/application pipeline. The opt-in must be part of the pipeline fingerprint
  and cache key; default requests remain byte-for-byte on the legacy path. Unsupported IR must fail
  with no silent fallback or partial artifact. Existing planning, cache, and transactional writer
  stay authoritative.

## Pre-Directive 034 baseline evidence

On 2026-10-20 with Node 20.20.2:

| Check                                                  | Result                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| `npm run test:phase2:parser`                           | Passed: isolated Saxes/xmldom security and fidelity qualification |
| `node tests/phase0/svg-security-corpus.test.mjs`       | Passed: 6 safe and 21 rejected fixtures                           |
| `node tests/phase0/svg-semantic-preservation.test.mjs` | Passed                                                            |
| `npm run test:package`                                 | Passed: offline package smoke, 754 files, 634,520 bytes           |
| `npm run package:conformance`                          | Passed: 754 files, 634,520 bytes                                  |

These checks were recorded before Directive 034 implementation. Current implementation and package
evidence is recorded in [Phase 04.3A integration](phase4.3a-svelte-ir-opt-in-integration.md).

## Approval boundary

Engineering Review 053 authorized implementation of the internal scanner document projection and
controlled Svelte JS/TS opt-in under Directive 034. If management instead requires a general-purpose
XML parser beyond the admitted static SVG subset, this proposal is not sufficient; that scope
requires a new maintained-parser and stewardship decision. Directive 034's implementation and local
acceptance results are recorded in
[Phase 04.3A integration](phase4.3a-svelte-ir-opt-in-integration.md). Management review remains
pending; the legacy generator remains the default production route.

### References

- Saxes package metadata and documentation: [npm package page](https://www.npmjs.com/package/saxes).
- Saxes upstream archive status: [official GitHub repository](https://github.com/lddubeau/saxes).
