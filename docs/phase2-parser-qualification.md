# Phase 02.3–02.4 — Saxes Prototype Qualification Record

Status: QUAL-001 and QUAL-002 experimental evidence is accepted. Directive 011D-A–F verification has
passed in a disposable clean checkout, and Directive 011E performance/resource measurements have
been completed on Node 18.20.6 and 24.13.1. Review 029 accepted the measurements as reference
characterization, and Directive 011F completed the internal contract with no production parser
selected. See the [Phase 02.5 report](phase2-parser-performance.md) and
[Phase 02.6 decision](phase2-parser-decision.md). No production dependency is approved.

## Prototype boundary

`experiments/phase2/saxes-qualification-adapter.mjs` and `experiments/phase2/xml-source-spans.mjs`
are deliberately outside `src/` and are not exported from the package. The adapter accepts a string,
runs `applySVGInputSafety` in reject mode before constructing Saxes or an AST, and rejects any
future policy that changes the admitted source. It retains the original input verbatim and does not
serialize a replacement SVG. Production input, optimizer, framework, and integration paths are
unchanged.

The adapter builds a small ordered event tree with element/attribute namespace fields, text, CDATA,
comments, and processing-instruction node support. Runtime limits cover total UTF-8 input bytes,
nesting, elements, per-element and aggregate attributes, and decoded text bytes. The existing
scanner pre-checks its fixed input, nesting, element, per-element-attribute, and CSS/style bounds
before Saxes runs; adapter limits provide an additional lowerable test ceiling and stop tree
allocation as events arrive. The candidate receives the complete bounded JavaScript string in one
write to avoid split-surrogate chunk behavior. No network or filesystem resolver is configured or
called.

All document type declarations are rejected by the existing scanner before candidate construction.
The adapter also installs an explicit `doctype` rejection handler as defense in depth. It does not
populate Saxes' entity table. External URL, active-element, event-handler, and unsafe-CSS admission
remain scanner policy, not parser behavior.

## Position and fidelity model

The adapter documents Saxes event positions as exclusive cursor offsets in JavaScript string (UTF-16
code-unit) units, not UTF-8 byte offsets. It retains `sourceLengthCodeUnits`; element start and end
locations are parser event cursors, not yet a validated token-span mapping. Line/column are the
parser's own coordinates and must not be substituted for offsets. CRLF folding affects parser
line/column differently from offsets. A future source-slice adapter still needs a dedicated mapping
qualification for every token type.

Observed in the acceptance fixture:

| Input distinction                                 | Candidate result                                                                              | Required treatment                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Mixed text and nested `<text>/<tspan>`            | Child order and text segments retained                                                        | Keep ordered child nodes; do not trim text                                                                 |
| `xml:space="preserve"`                            | Attribute value is available; text whitespace remains present                                 | Semantic consumer must apply inherited `xml:space` rules; parser does not decide rendering semantics       |
| `&amp;` and numeric/predefined entities           | Parsed text/attribute values are decoded                                                      | Retain original source because entity spelling is lost in the tree value                                   |
| CDATA                                             | Separate `cdata` node from ordinary `text` event                                              | Source retained if CDATA delimiters matter; no automatic serialization                                     |
| Comments                                          | Separate comment node                                                                         | Source retained; downstream policy decides whether to preserve                                             |
| Comments outside the SVG element                  | Separate `prolog`/`epilog` collections                                                        | Source string remains the lexical authority                                                                |
| Processing instructions                           | Supported by Saxes, but non-declaration PIs are currently rejected by the security boundary   | Preserve boundary behavior; do not bypass it to make the candidate accept more input                       |
| Namespace-qualified names/attributes              | Prefix, local name, and namespace URI are available with namespace mode enabled               | Use expanded names for semantic comparisons and retain qualified spelling/source                           |
| Attribute order                                   | Saxes event object iteration preserves tested input order                                     | Treat as observed behavior only; original source remains authoritative                                     |
| Single vs. double quotes, spaces, entity notation | Not represented by parsed attribute values                                                    | Recover from source/token spans if needed; do not serialize candidate AST as a source-preserving operation |
| CRLF and non-BMP Unicode                          | Event offsets align with JS UTF-16 source length; line/column are separate parser coordinates | Convert to byte offsets only at a separately tested boundary                                               |

The XML declaration is retained in the original source but not emitted as a tree node. A safe style
block containing `url(#paint)` remains text; URL policy is still decided by the security scanner.

This distinction is material: structural equivalence does not imply lexical equality. XML parsing
normalizes line endings and entity references and may discard lexical distinctions; the original
string is retained for that reason.

## Executed checks

Command: `npm run test:phase2:parser` on Node.js `v24.13.1`, npm `11.8.0`.

The command performed a clean TypeScript build and passed the isolated adapter regression, covering:

- well-formed nested SVG structure, mixed text, CDATA, comments, whitespace, namespaces, and
  attribute-order observation;
- UTF-16 offset vs. CRLF line/column behavior and source retention;
- malformed tags, unquoted attributes, invalid XML characters, undeclared prefixes, and invalid
  namespace binding rejected by the existing boundary;
- DTD/custom entity, non-declaration processing instruction, script, external URL, and event-handler
  input rejected by the existing boundary before parser allocation;
- configurable test ceilings for input bytes, nesting, element count, per-element/total attributes,
  and text volume.

The exact shared Phase 00 security corpus (6 accepted, 21 rejected) is also exercised. Every
rejected sample retains its established error code; accepted samples reach both Saxes and the
alternative parser. Additional at/under/over limit fixtures cover Unicode UTF-8 input/text bytes,
depth, element count, and per-element/total attributes. Twenty repeated malformed inputs produce
identical sanitized Saxes diagnostics, and no AST is returned on failure.

The differential test initially found a prototype-only defect: Saxes emits a `closetag` event for a
self-closing element, and the adapter incorrectly popped its parent for that event. The stack logic
now ignores close events for nodes that were never pushed. The production parser was not changed.

The independent lexical index in `xml-source-spans.mjs` reports offsets by scanning the original
source directly in JavaScript UTF-16 code units. Tests compare original slices for CRLF and LF text,
entities, CDATA delimiters/content, comments, ordered attributes, quote style, and spacing. The
indexed qualified element-name sequence is checked against the parser tree. A surrogate-pair fixture
proves UTF-16 offsets differ from UTF-8 byte offsets. Namespace prefix/local-name/URI fields are
verified for the SVG root and `xlink:href`. This experimental index is not a production general XML
tokenizer and does not permit replacing retained source with serialization.

`@xmldom/xmldom@0.9.12` was tested against the same safe/rejected corpus and semantic fixture. The
same safety boundary ran first; it parsed accepted cases with expected namespace and decoded-text
results and did not override any security rejection. This establishes a maintained alternative, not
production qualification: its project documents that malformed XML is not yet reported reliably, and
a DOM is not a lexical source-preserving representation.

Current targeted checks passed: `npm run test:svg-security-corpus` (6 accepted and 21 rejected),
`npm run test:svg-semantic-preservation`, `npm run test:svg-visual-equivalence`, and
`npm run test:package` (754 files, 634,254 bytes). The parser suite also passed under Node 18.20.6 /
npm 10.8.2 and Node 24.13.1 / npm 11.8.0.

## Directive 011D clean-environment results

The clean checkout initially reproduced all 16 Prettier diagnostics in the named, previously
untouched source files. They were formatting-only differences from the locked Prettier ESLint rule;
no lint rule, budget, or warning category was changed. The reported files were formatted and lint
now passes with 0 errors and the existing 14/14 approved `no-explicit-any` warnings.

The first clean install also confirmed that the missing Angular declarations were local install
state: `node_modules/@angular/core/index.d.ts` was absent in the contaminated working installation,
but was restored by the clean lockfile installation. Angular's compiler fixture and the complete
generator-language conformance test pass in that clean environment.

The scripts-enabled install stall was traced to unreferenced `node@26.0.0` and `node-bin-setup`
entries already present in the lockfile (`npm explain node` reported the package as extraneous). Its
install hook launched a nested fetch/install for `node-linux-x64@26.0.0`. Removing only these two
unreachable lock entries allowed a scripts-enabled `npm ci --no-audit --no-fund` to complete with
Node `18.20.6` and npm `10.8.2` (453 packages); the package-lock SHA-256 was unchanged by the
install. No runtime or development dependency version was upgraded for this correction.

The first clean `quality:full` attempt then exposed that `quality:fast` ran Jest before creating
`dist/`, causing eight CLI tests to fail with `ERR_MODULE_NOT_FOUND: dist/cli.js`. The canonical
fast gate now performs the normal clean build between lint and Jest. With that correction, the
clean-checkout `npm run quality:full` passed, including `quality:fast`, privacy, Jest, Phase 00,
Phase 01, and package smoke. The Phase 00 result includes the Angular fixture and generator-language
conformance. `npm run test:phase2:parser` and `npm run package:conformance` also passed. The final
archive had 754 files and measured 634,254 bytes, 6,369 bytes below the 640,623-byte cap. The clean
gate used Node `18.20.6` / npm `10.8.2`; the parser suite was previously verified under Node
`24.13.1` / npm `11.8.0` as well. No Phase 02.5 benchmark had been run when this 02.3–02.4 record
was first prepared; the later measurements are in the
[Phase 02.5 report](phase2-parser-performance.md).

## Package-manager and supply-chain record

The project declares Node `>=18.17.0`, npm `>=9.0.0`, and `packageManager: npm@10.8.2`. The exact-
pinned parser dependencies remain development-only: `saxes@6.0.0` (ISC, Node `>=12.22.7`, dependency
`xmlchars@2.2.0`), `@xmldom/xmldom@0.9.12` (MIT, Node `>=14.6`, no runtime dependencies), and
`xmlchars@2.2.0` (MIT). Their declared Node floors are below SVGER's `>=18.17.0` floor. Neither the
parser packages nor `xmlchars` appeared in the live registry advisory response. The packed archive
contains no parser package code or lockfile. No release authorization was changed and no publishing
was attempted.

### QUAL-006 dependency advisory triage

The supplied npm audit summary reported 48 findings: 1 critical, 42 high, and 5 moderate. A live
registry bulk-advisory refresh mapped the affected lockfile versions to the package families below.
It returned advisory/range records (some advisories cover multiple major-version ranges); those
records are grouped here by package and are not added to or substituted for npm audit's aggregate
48-count. The ordinary npm CLI audit request did not return within 20 seconds in this proxy
environment, so severity totals below preserve the reviewed report and package exposure is based on
the lockfile plus dependency paths.

| Affected package(s) and locked version(s)       | Reported severity / issue                                          | Dependency path and exposure                                                                                                                               | Targeted remediation                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@angular/compiler` / `@angular/core` `17.3.12` | High and moderate XSS/sanitization advisories                      | Direct dev dependencies used by Angular conformance fixtures only                                                                                          | Upgrade the two packages together to a patched compatible Angular line; rerun the Angular fixture.                                                                                    |
| `brace-expansion` `1.1.14` and `2.1.0`          | High and moderate denial-of-service advisories                     | Dev-only transitive copies under ESLint/minimatch, TypeScript ESLint, and TypeDoc paths                                                                    | Move parent toolchain constraints to releases resolving patched `brace-expansion` versions; avoid an unreviewed override.                                                             |
| `js-yaml` `3.15.0` and `4.3.0`                  | High CPU denial-of-service advisories                              | Dev-only transitive YAML/config tooling                                                                                                                    | Upgrade affected parent packages or compatible `js-yaml` patch lines, then run config and lint suites.                                                                                |
| `baseline-browser-mapping` `2.10.43`            | Moderate denial of service                                         | Dev-only Browserslist support data                                                                                                                         | Upgrade the compatible Browserslist mapping dependency.                                                                                                                               |
| `braces` `3.0.3`                                | High stack-exhaustion denial of service                            | Dev-only glob/micromatch tooling                                                                                                                           | Update the compatible parent toolchain so it resolves a fixed `braces` release.                                                                                                       |
| `browserslist` `4.28.6`                         | High memory-exhaustion and crash advisories                        | Dev-only build/test target selection                                                                                                                       | Upgrade to a patched Browserslist release and rerun build targets.                                                                                                                    |
| `handlebars` `4.7.9`                            | Critical JavaScript injection and moderate unsafe inline embedding | Dev-only documentation generation (`typedoc` dependency tree)                                                                                              | Upgrade TypeDoc or its resolved Handlebars dependency to a patched release; do not render untrusted templates before then.                                                            |
| `markdown-it` `14.3.0`                          | Moderate CPU denial of service                                     | Dev-only TypeDoc documentation generation                                                                                                                  | Upgrade the TypeDoc dependency tree to a fixed Markdown parser release.                                                                                                               |
| `sharp` `0.34.5`                                | High inherited libvips/libheif/librsvg advisories                  | Optional dependency in the published manifest; only dynamically loaded by `src/utils/visual-diff.ts` for SVG rasterization, not the default CLI build path | Before enabling/using visual rasterization with untrusted inputs, upgrade to a release fixing all three advisories or remove the optional capability in a separately reviewed change. |
| `sprintf-js` `1.0.3`                            | Moderate precision-specifier denial of service                     | Dev-only test/reporting dependency tree                                                                                                                    | Upgrade its parent dependency or resolve a patched `sprintf-js` version.                                                                                                              |
| `svelte` `4.2.19`                               | Moderate SSR/XSS advisories                                        | Direct dev dependency used by Svelte generator conformance                                                                                                 | Upgrade to a supported patched Svelte line and rerun Svelte compiler conformance.                                                                                                     |

The audit is triaged, not remediated: no bulk upgrade, override, or package removal was authorized
under Directive 011D. The main runtime-relevant item is optional `sharp`; its use is confined to
explicit visual-diff rasterization. **Do not process untrusted SVG inputs through the optional
`sharp` visual-diff/rasterization path until the inherited native dependency advisories are
remediated or a separately reviewed safe policy is approved.** All other listed packages are
development-only by lockfile classification. The findings do not include the experimental XML parser
packages.

The upstream Saxes repository is archived/read-only since 2025-12-31. No Saxes/xmlchars package
advisory was returned by npm audit, but archive status and lack of upstream maintenance remain a
production risk. `@xmldom/xmldom` is actively maintained (0.9.12 was current at review time), but
its security policy documents advisory history and says malformed-input reporting is not reliable
yet. The comparison therefore supports option 3: retain Saxes only as an experimental reference and
postpone production selection. Neither library has been approved for production use.

## Remaining gates

- Management approved the 011D evidence in Review 028; formal Phase 02.3–02.4 certification is
  accepted.
- The audit findings remain open for a separately authorized, targeted remediation decision; no
  broad or breaking dependency updates were made.
- Obtain review of remaining prototype limitations and choose a maintenance/ownership strategy
  before any production parser selection. No internally maintained fork is proposed.
- Directive 011E benchmark execution is recorded in
  [the Phase 02.5 report](phase2-parser-performance.md), and Review 029 accepts it as reference
  characterization only. Directive 011F completed the internal parser contract and selected no
  production parser; see the [Phase 02.6 decision](phase2-parser-decision.md). The dependency audit,
  Node-floor review, and maintenance/ownership prerequisites remain open for any future selection.

No production parser path, public API, optimizer, or framework behavior was switched.
