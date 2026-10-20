# Phase 04.2B — Experimental Multi-Framework IR Emitters

Status: Directive 031 implementation is complete within the experimental boundary. All six
authorized framework batches now have IR v1 emitters and focused tests. This is not production
integration, sandboxed candidate execution, framework-runtime certification for every target, or
authorization for Phase 04.3.

## Scope and shared contract

The emitters live under `experiments/phase4/` and are compiled only by `npm run test:phase4`. They
consume the versioned Phase 03 static SVG IR v1, reuse the Svelte emitter's validated/frozen static
SVG and reference checks, return a deterministic in-memory artifact with a schema version and UTF-8
byte count, and reject unsupported constructs with stable `FrameworkIrEmitterError` codes. Output
limits default to 16 MiB and are configurable downwards for tests. No emitter writes files or
imports the production service, cache, or transaction writer. The shared semantic validator does not
turn these experimental modules into an approved production parser/IR path.

The accepted surface is intentionally the supported static SVG subset, not arbitrary framework
source. Component identifiers and IR are validated; defaults and the legacy component props are
emitted per target. JSX-family and native emitters reject unsupported namespaces/nodes. React Native
also rejects SVG text, comments, unsupported elements, and unsupported attributes rather than
claiming to render them. The emitter result's `complete` status means complete for that declared
subset only.

Most new emitters currently assemble a bounded-source-derived component string and check the
configured output-byte ceiling before returning it; they do not stream every generated framework
wrapper into an incremental bounded writer. The Svelte emitters do stop chunk growth at the limit.
This distinction is retained as a resource-lifecycle limitation for any later execution boundary.

## Batch implementation and evidence

| Directive 031 batch   | Emitters and modes                                        | Validation evidence                                                                                                  | Remaining qualification gap                                                                          |
| --------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A — React / Preact    | JS and TSX                                                | Babel JSX/TypeScript parsing; contract assertions for defaults, forwarded props/ref, static metadata, and references | React and Preact consumer packages/types are not installed; no native typecheck or runtime mount     |
| B — Solid / Vue       | Solid JS/TSX; Vue JS/TS, `<script setup>` and Options API | Babel syntax parsing; Vue SFC parse, `compileScript`, and `compileTemplate`                                          | Solid consumer packages/types are absent; Vue runtime is absent, so no mounted/update behavior       |
| C — Lit / Vanilla     | Lit JS/TS custom elements; Vanilla JS/TS DOM factory      | Babel syntax parsing; DOM factory executed against a controlled DOM test double; no `innerHTML` use                  | Lit package/compiler and browser DOM are absent; no native Lit update or browser rendering test      |
| D — Angular           | TypeScript standalone and non-standalone component forms  | Angular compiler template parser plus Babel TypeScript/decorator syntax parsing                                      | `@angular/compiler-cli` project compilation and Angular runtime fixture are unavailable              |
| E — React Native      | JS and TSX for the explicitly mapped primitive subset     | Babel JSX/TypeScript parsing; unsupported text/construct rejection                                                   | React Native, React and `react-native-svg` consumer packages are absent; no native typecheck/runtime |
| F — Svelte TypeScript | `.svelte` TypeScript component                            | Svelte TypeScript preprocessing, native Svelte compile, SSR render, default/override prop checks                     | Browser hydration/client update behavior is not established by SSR                                   |

The unavailable native peer dependencies were not added: Directive 031 prohibits new dependencies.
Syntax parsing is reported as syntax validation, not as framework compatibility. Vue compiler
evidence is stronger than syntax-only evidence but does not establish runtime behavior. The existing
Svelte compiler and SSR renderer are used as native consumers for Svelte JS and TS output.

## Regression coverage

`tests/phase4/svelte-js-ir-emitter.test.mjs` now exercises every emitter family through the shared
lowered fixture, checks output determinism and UTF-8 output accounting, component defaults and
static metadata/reference preservation, target syntax/compiler validation where available, and
downward output ceilings. Negative checks include unsupported React Native text, malformed/invalid
IR and unsupported static content from the existing Svelte suite. Vue compilation covers both script
styles and both language modes. The Vanilla test double checks namespaced element creation, text and
attribute construction, and option overrides without representing itself as a browser.

The suite's syntax/native validation assertions are deliberately not captured as independent
candidate promotion evidence. No framework oracle result, sandbox attestation, or production shadow
capture is synthesized here.

## Reproduction and current verification

Run from the repository root with the existing lockfile installation and Node 20 available:

```sh
npm run test:phase4
npm run quality:full
npm run package:conformance
```

The Phase 04 suite compiles the experimental TypeScript modules and runs the focused tests. The full
quality gate also verifies the pre-existing Phase 00/01 contracts; package conformance inspects the
actual archive. On 2026-10-19 with Node 20.20.2, `npm run test:phase4` passed. The repository's
`npm run quality:full` also completed successfully, including the generator, Phase 00/01, package
smoke, and Phase 04 suites. Offline archive conformance passed with 754 files and a compressed size
of 634,520 bytes, 6,103 bytes below the existing 640,623-byte ceiling. The full gate's package smoke
reported the same archive size. These local checks do not replace clean-checkout remote CI or
management acceptance.

No files under `src/`, runtime dependency, package export, public API, production route, cache, or
artifact writer changed for this work. Phase 04.3 production integration, sandbox installation,
candidate promotion, and release/publication remain unauthorized.
