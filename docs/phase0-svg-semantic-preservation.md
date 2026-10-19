# SVG Semantic Preservation

Phase 00.5 keeps character data and source whitespace unchanged unless a transformation has an
explicitly supported structural boundary. The optimizer does not treat XML as an undifferentiated
string.

## Active pipeline

The active pipeline is deliberately conservative at every optimization level:

| Pass                         | Allowed changes                                                                                          | Boundary                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| XML declaration removal      | Removes only a leading XML declaration                                                                   | DTDs are rejected by the Phase 00.4 input scanner; comments are removed by an XML-aware walker and other processing instructions remain           |
| Formatting whitespace        | Replaces whitespace-only nodes between elements with one space                                           | Inherited `xml:space="preserve"`, text/tspan/textPath/title/desc, CDATA, and style content are retained exactly                                   |
| Color shortening             | Changes literal values of `fill`, `stroke`, `stop-color`, `flood-color`, and `lighting-color` attributes | CSS text, style attributes, text nodes, entity-containing values, and whitespace-padded values are untouched                                      |
| Numeric precision            | Rounds eligible numeric geometry/presentation attributes, `viewBox`, and valid `points` coordinate lists | A small XML start-tag walker preserves all source bytes outside attribute-value spans; path `d` data is unchanged pending parser-backed rewriting |
| Framework attribute spelling | Renames known SVG attributes in actual start tags for JSX output                                         | Text, CDATA, comments, and CSS contents are not searched or rewritten                                                                             |

Precision follows `OptLevel`: basic/balanced use 3 decimal places, aggressive uses 2, and maximum
uses 1. This is an explicit, opt-in approximation for numeric SVG values; text-bearing attributes
and character data are not rounded. Path data is retained exactly because command arity and arc
flags need parser-backed precision handling. IDs, classes, references, styles, metadata, transforms,
and unknown attributes are preserved. Optimized output is run through the Phase 00.4 security
scanner again before it is returned.

## Restricted or disabled transformations

The following existing transformations are not registered in the production pipeline because their
current string/tree implementations cannot establish the required semantics for arbitrary SVG input:

- Global regex whitespace normalization, metadata/title/description removal, empty-container
  deletion, and attribute sorting. The active whitespace pass is context-aware and comment removal
  recognizes XML markup only.
- CSS minification or conversion between style attributes and presentation attributes. Cascade
  order, `!important`, custom properties, and inherited values require CSS-aware evaluation.
- Default-attribute removal, unused-definition removal, hidden-element removal, group collapsing,
  and attribute propagation. These can interact with inheritance, IDs, selectors, and references.
- Transform collapsing, path simplification/deduplication, and primitive-to-path conversion. These
  remain available as internal experimental stages but are not enabled by `SVGProcessor`
  optimization levels until their eligibility and visual-equivalence rules are proven.
- Performance-engine global whitespace and attribute stripping. Its fast, balanced, and maximum
  strategies currently preserve their input unchanged.

The internal tree parser and serializer remain useful for future work, but the current parser trims
character data and the minifying serializer removes text whitespace. They must not be placed back in
the default pipeline without semantic-preservation and reference-integrity checks. Public
optimization level configuration remains compatible; levels above basic currently increase only the
configured numeric precision behavior, not the set of enabled structural passes.

## Regression evidence

`tests/phase0/svg-semantic-preservation.test.mjs` asserts exact title, description, text, tspan,
multiline, CDATA, and whitespace-bearing attribute content across all optimization levels. It checks
reference/style/transform integrity, numeric coordinate precision, attribute escaping, inherited
whitespace, UTF-8 handling, malformed-input diagnostics, and the Phase 00.4 security rescan.
`tests/phase0/generator-language-contracts.test.mjs` compiles the semantic fixture through every
supported framework/language combination and public service/integration generation path, including
percentage/em dimensions and quoted, entity-encoded, multiline root values. Root dimensions are
emitted as numeric literals only when they are finite numeric values; other values remain quoted
strings. XML CDATA becomes escaped character data at framework emission. Nonessential XML comments
and processing instructions are omitted from generated markup; title/description text remains.
Stylesheet text is emitted as a JSX string child for React, Preact, and Solid; relocated to a
top-level Vue SFC style block; supplied through text-content bindings in Angular and static Svelte
HTML insertion; and template-literal escaped for Lit/Vanilla. React Native style elements produce
`E_UNSUPPORTED_SVG_CONSTRUCT` because this generator has no safe native representation. The
optimizer and XML attribute walker remain framework-agnostic.

`tests/phase0/svg-visual-equivalence.test.mjs` uses the existing Sharp/librsvg + pixelmatch harness
to compare source and cleaned SVGs at 192×192 pixels. It covers gradients, clipping, text/CDATA, and
rounded geometry at all five optimization levels. Pixelmatch uses a 0.1 per-pixel color threshold;
the allowed differing-pixel ratio is 0.1% through balanced, 0.5% for aggressive, and 2.0% for
maximum. The higher maximum tolerance is limited to the dedicated geometry fixture because maximum
rounds eligible geometry to one decimal place; all other level/fixture pairs use 0.1%. React JSX
and TSX child trees are extracted from parsed generated components and rendered against the source
fixture at a 0.1% tolerance. Other frameworks are compiler-validated by the conformance suite;
framework runtime packages are not installed here, so runtime mounting is outside this renderer's
boundary.

Run `npm run test:svg-semantic-preservation`, `npm run test:svg-visual-equivalence`, and
`npm run test:generator-contracts` for focused checks. `npm run test:phase0` includes visual
regressions.
