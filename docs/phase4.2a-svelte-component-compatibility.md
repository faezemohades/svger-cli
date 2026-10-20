# Phase 04.2A — Svelte-JavaScript Component Compatibility

Status: Directive 030 implementation and local qualification passed on the current working tree.
Management review remains pending. This work remains in `experiments/phase4/`; it does not change
production generation, CLI routing, package exports, caches, or the parser decision.

## Legacy contract inventory

`FrameworkTemplateEngine.generateSvelteComponent()` in `src/core/framework-templates.ts` is the
behavioral baseline. For JavaScript output it exports these props from the generated Svelte
component:

| Prop                           | Default                              | Legacy root behavior                                                 |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------- |
| `className`                    | `''`                                 | Bound to SVG `class`                                                 |
| `style`                        | `''`                                 | Bound to SVG `style`                                                 |
| `width`                        | Parsed root width or numeric `24`    | Bound to SVG `width`; numeric `px` suffix is removed in the default  |
| `height`                       | Parsed root height or numeric `24`   | Bound to SVG `height`; numeric `px` suffix is removed in the default |
| `fill`                         | Parsed root fill or `'currentColor'` | Bound to SVG `fill`                                                  |
| `stroke`                       | `''`                                 | Bound to SVG `stroke`                                                |
| Other supplied component props | N/A                                  | Forwarded through `$$restProps` to the SVG root                      |

The legacy template fixes `viewBox` to the parsed root value or `0 0 24 24`, forces the SVG
namespace, and applies the rest-props spread last. Source root accessibility attributes are not
copied by the legacy wrapper. Its markup preparation also has legacy whitespace and `xml:space`
limitations recorded in [Phase 04.1](phase4.1-svelte-js-ir-emitter.md).

## Experimental emitter behavior

The IR emitter now exposes the six named JavaScript props with the legacy defaults and bindings,
forwards remaining props using `$$restProps`, and keeps the source-derived `viewBox` fixed. Numeric
dimensions and the legacy `px` default convention are reproduced. Values used in the generated
script are encoded as safe JavaScript literals; root `class`, `style`, dimensions, fill, stroke and
viewBox are handled by the component contract rather than duplicated as static attributes.

This preserves the supported component API while retaining source structure, text, local references,
namespace behavior, inherited `xml:space`, and source accessibility metadata. Preserving source
accessibility and whitespace that the legacy path loses is an intentional correctness improvement,
not an attempt to disguise output differences. Caller-provided rest props may override generated
root attributes, matching the legacy spread order.

## Attribute policy: emission versus qualification

The emitter accepts well-formed ordinary attributes within the existing SVG/XML/Svelte safety checks
and preserves them as static markup. This includes safe custom attributes such as `data-*`. “Safe to
emit” only means the emitter can encode the value without interpreting it as Svelte syntax or
allowing the rejected active-content/reference forms; it does not mean the attribute's SVG semantics
are understood.

The source and artifact oracles retain their independent, versioned attribute grammars. An attribute
outside those grammars lowers static attribute coverage (and may lower other affected dimensions) to
partial. Dynamic prop bindings and `$$restProps` likewise prevent the static artifact oracle from
claiming complete attribute/geometry coverage or fully resolved validity. Native Svelte compilation
and runtime contract tests are separate evidence and do not upgrade static oracle coverage. The
750-path fixture therefore remains emit-able while both source and artifact analyses report partial
attribute coverage due to `data-index`.

## Verification

`npm run test:phase4` compiles the experimental TypeScript modules and executes
`tests/phase4/svelte-js-ir-emitter.test.mjs`. The suite exercises Svelte's native SSR
compiler/runtime for defaults, numeric and string overrides, the legacy `px` default,
missing-dimension defaults, `$$restProps` forwarding, and source accessibility/text/reference
behavior. It separately asserts that dynamic bindings and safe-but-unqualified `data-*` attributes
remain partial/unresolved in the static oracle. Negative IR/reference/unsupported/size tests and
deterministic generation remain in the same suite.

`quality:full` now includes `test:phase4`, with the Phase 1 governance-policy contract checking that
the Phase 4 suite remains in the canonical gate. The test uses existing dependencies only. No
performance threshold was added; the 750-path observation remains informational.

Verification on 2026-10-19 with Node 20.20.2:

- `npm run test:phase4` passed, including the Svelte 4 native compiler and SSR runtime contract
  checks.
- `npm run quality:full` passed, including the newly integrated Phase 4 suite and the governance
  failure-injection controls.
- `npm run package:conformance` passed: 754 files and 634,485 compressed bytes, 6,138 bytes below
  the 640,623-byte archive ceiling.
- Prettier check and `git diff --check` passed for the scoped implementation, tests, and documents.

The package archive is generated from the current working tree, which also contains unrelated
pre-existing transaction changes; the archive measurement is not attributed solely to this
experimental change.

## Authorization boundary

This qualification adds no framework beyond Svelte, no runtime dependency, candidate sandbox,
production path, package export, or public API. Phase 04.2B, production integration, parser
selection, and publishing remain unauthorized.
