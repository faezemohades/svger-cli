# Phase 03.3B-4 — Static Source Oracle and Cross-Oracle Qualification

Status: Directive 023 implementation and local verification complete; management review pending. The
source oracle reports only a bounded static SVG syntax/metadata projection. `complete` means the
declared grammar accounted for the captured syntax in that dimension. It does not mean complete SVG
rendering, browser resource resolution, accessible-name computation, or runtime equivalence.
Promotion remains explicitly unauthorized.

## 1. Representation and version boundaries

The source path is mandatory SVG admission → experimental Saxes XML adapter → XML-to-IR-v1 lowering
→ `analyzeStaticSvgSource()`. The artifact path is captured Svelte component → Svelte 4 parser AST →
`analyzeSvelteArtifact()`. Neither oracle receives the other projection. The two projections share a
versioned grammar and canonical field contract, but are independently extracted from their
respective representations.

Directive 023 versions the capture record/qualification as `svger-shadow-capture-v3` and
`svger-shadow-capture-qualification-v3`, the source analysis as `svger-static-svg-source-oracle-v1`,
the artifact analysis as `svger-svelte-artifact-analysis-v2`, and the comparison report as
`svger-three-way-artifact-oracle-v2`. A static comparison always returns `promotion-not-authorized`;
these results are qualification evidence only.

## 2. Declared source grammar

The implementation source of truth is the exported `STATIC_SVG_GRAMMAR` and the bounded element,
attribute, and ARIA sets in `experiments/phase3/static-svg-source-oracle.mjs`. The supported element
set is:

`svg`, `g`, `defs`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text`,
`tspan`, `textPath`, `title`, `desc`, `use`, `symbol`, `a`, `clipPath`, `mask`, `pattern`,
`linearGradient`, `radialGradient`, `stop`, `filter`, `feBlend`, `feColorMatrix`,
`feComponentTransfer`, `feComposite`, `feFuncA`, `feFuncB`, `feFuncG`, `feFuncR`, `feGaussianBlur`,
`feMerge`, `feMergeNode`, `feOffset`, `image`, and `metadata`.

Supported unqualified attributes are `id`, `href`, `viewBox`, `width`, `height`, `x`, `y`, `x1`,
`x2`, `y1`, `y2`, `cx`, `cy`, `r`, `rx`, `ry`, `d`, `points`, `fill`, `fill-rule`, `stroke`,
`stroke-width`, `opacity`, `transform`, `clip-path`, `preserveAspectRatio`, `role`, `tabindex`,
`focusable`, `class`, and `style`. `xlink:href` and `xml:space` are supported in their expanded
namespaces. SVG/XML namespace declarations are checked for known namespace bindings and omitted from
the rendered-attribute projection; expanded names, not prefix spelling, are compared.

The static ARIA set consists of `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-hidden`,
`aria-checked`, `aria-disabled`, `aria-expanded`, `aria-haspopup`, `aria-pressed`, `aria-selected`,
`aria-current`, `aria-live`, `aria-atomic`, `aria-busy`, `aria-relevant`, `aria-roledescription`,
`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `aria-controls`, `aria-owns`,
`aria-activedescendant`, `aria-flowto`, `aria-details`, and `aria-errormessage`. Unknown ARIA names
lower accessibility coverage rather than being presumed non-reference metadata.

## 3. Coverage contract

| Dimension     | `complete` means                                                                                                                                                                                                                                                                   | Always outside the claim                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Text          | Static text/CDATA nodes in supported text-bearing elements are ordered, XML line endings are normalized, and effective `xml:space` is recorded. Whitespace-only formatting between child elements in `svg`, `g`, `defs`, and `symbol` is ignored only under `xml:space="default"`. | Browser text extraction/rendering and any unsupported mixed-content context. `xml:space="preserve"` whitespace is retained.                 |
| Namespaces    | Element expanded names and namespace-qualified attribute names are known and consistent. Unused namespace declarations and prefix spelling do not affect equivalence.                                                                                                              | Foreign-content integration points and unknown/rebound namespace URIs.                                                                      |
| Attributes    | All static attributes within the declared set are retained and canonically ordered by expanded name; IDREF-list whitespace is token-normalized.                                                                                                                                    | Unknown attributes, dynamic values, and whether a literal attribute changes browser rendering.                                              |
| References    | Literal non-empty IDs and literal `href`/`xlink:href` fragment edges are indexed; missing and duplicate targets are explicitly `unresolved` or `ambiguous`.                                                                                                                        | CSS `url(...)`, stylesheet selectors, external resource resolution, and runtime-created nodes. CSS reference syntax makes coverage partial. |
| Accessibility | Static supported role/ARIA/focus attributes, title/description text, and IDREF token integrity are captured. IDREF token order is retained.                                                                                                                                        | Accessible-name/description computation, visibility, focus behavior, accessibility tree, and assistive-technology behavior.                 |
| Geometry      | Literal root `viewBox`, `width`, and `height` values are compared.                                                                                                                                                                                                                 | Unit interpretation, defaults, CSS cascade, layout, and rendered geometry. `class`/`style` lower geometry and accessibility coverage.       |

Unsupported elements conservatively lower all dimensions. Unknown attributes lower attribute
coverage; unknown namespace-qualified attributes also lower namespace coverage. Dynamic markup,
expressions, spreads, unsupported ARIA names, style effects, CSS references, invalid `xml:space`,
and parser/resource errors lower each affected dimension. An observation may remain available under
partial coverage, but absence is not inferred from it.

Svelte scripts are never executed. Their existence is recorded as runtime-unqualified diagnostic
evidence, while static AST coverage describes only the extracted markup. Dynamic markup expressions
and attributes lower the relevant dimensions. This distinction does not qualify Svelte runtime
behavior; script-driven DOM changes remain outside all conclusions and promotion remains disabled.

## 4. Canonicalization and comparison

- Attribute order is ignored after sorting by namespace URI and local name; element order remains
  significant.
- Namespace prefixes and unused namespace declarations are normalized away only after bindings
  resolve to supported namespace URIs. A namespace URI change remains a blocking mismatch.
- Text records include element-index paths and effective `xml:space`. XML CRLF/CR are normalized to
  LF; entity spelling is compared after parser decoding. Adjacent text chunks at the same path and
  whitespace mode are coalesced. Formatting-only whitespace is ignored only by the rule above.
- ARIA IDREF-list attributes canonicalize XML whitespace to single-space token lists, while
  `accessibility.idrefs` records each target and its resolved/unresolved/ambiguous state.
- ID/reference ordering, text ordering, and the order of IDREF tokens are retained where they can
  affect consumers.
- All three digested edges remain independent: source→legacy, source→candidate, and
  legacy↔candidate. A partial side can still produce equal observed digests; the edge remains
  partial and blocking rather than being called a complete match.

The report contains only digests, dimension statuses/coverage, bounded mismatch codes, and oracle
identity/version. It does not emit raw source, artifacts, text values, or diagnostics. Candidate
artifacts remain caller-supplied fixtures; no candidate implementation is executed.

## 5. Qualification fixtures

`tests/phase3/shadow-capture-qualification.test.mjs` exercises:

- source/artifact/legacy projection parity for supported text, namespaces, references, and static
  structure despite attribute reordering, `xmlns:xlink` omission, an equivalent namespace-prefix
  alias, CRLF versus LF, `&amp;` versus a numeric character reference, and equivalent IDREF-list
  whitespace;
- duplicate IDs, ambiguous `href`, resolved/ambiguous/unresolved ARIA IDREF targets, and
  source/artifact projection equality for those states;
- blocking controlled output mutations to IDs, reference targets, namespace URI, text order,
  geometry, accessibility metadata, and `xml:space` behavior;
- partial source and artifact coverage for CSS URL references and unknown attributes, plus the
  existing dynamic-markup, dynamic-reference, unsupported-Svelte, malformed, and ambiguous-root
  cases;
- explicit existence of all three comparison edges, report redaction, provenance binding, repeat
  determinism, non-writing boundaries, and a permanently false promotion result.

The parity fixture asserts equality of observed digests even on partial source→legacy dimensions;
coverage remains partial where the legacy wrapper adds dynamic props/spreads or fails to forward
source metadata. That is evidence about normalized static observations, not an assertion that the
legacy generator is semantically equivalent in every dimension.

## 6. Reproduction and local verification

Run after the locked dependencies are installed:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts \
  --outDir experiments/phase3/.build --rootDir experiments \
  --module ES2022 --moduleResolution Bundler --target ES2022 --strict \
  --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node tests/phase3/shadow-capture-qualification.test.mjs
node tests/phase3/shadow-comparison-harness.test.mjs
```

Verification on 2026-10-19 used Node 20.20.2 and Svelte compiler/parser 4.2.19. The focused capture
qualification, Phase 02 parser suite, Phase 03 parser-to-IR differential suite, and Phase 03.3A
comparison harness all passed. `npm run quality:full` passed, including the 0-error/14-approved-
warning lint budget, Phase 00/01 suites, and package smoke. `npm run package:conformance` passed
with 754 files and 634,361 compressed bytes (6,262 bytes under the 640,623-byte limit). Final
Prettier and `git diff --check` passed. These are local results, not remote clean-checkout
certification or management approval.

## 7. Authorization boundary

Directive 023 authorizes this bounded source-side static oracle, cross-oracle normalization and
qualification tests only. It authorizes no change under `src/`, generator/framework routing,
production parser, dependencies, exports, candidate emitter/execution, broader framework shadow
generation, Phase 03.4 migration, promotion, or publishing. No static match automatically enables
promotion.
