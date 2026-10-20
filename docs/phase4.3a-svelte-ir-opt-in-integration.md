# Phase 04.3A — Production Svelte IR Opt-in Integration

Status: Directive 034 implementation and Directive 035 package/build stabilization are implemented;
local acceptance checks are recorded below and management review remains pending. Legacy generation
remains the default for every framework. The production parser is the existing bounded scanner; no
parser dependency, package export, default switch, or publish action was added.

## Opt-in contract

The additive `svelteCompiler` setting accepts `legacy` or `ir-v1` on `BuildRequest`, compiler
configuration, and `.svgconfig.json`. Omitted means `legacy`. `ir-v1` is rejected unless the
framework is Svelte; it is not silently ignored or routed to the legacy emitter.

```js
const compiler = await createSVGCompiler({ cwd: process.cwd() });
await compiler.build({
  src: './icons',
  out: './components',
  framework: 'svelte',
  typescript: false, // true emits Svelte TypeScript
  svelteCompiler: 'ir-v1',
});
```

The setting is also accepted in `.svgconfig.json`, which provides the CLI configuration route. No
standalone CLI switch was introduced. The mode is included in the pipeline fingerprint and resolved
configuration hash, so legacy and IR output cannot alias in cache. Existing source admission still
precedes cache lookup. Naming, artifact planning, exports, collision handling, and transactional
commit remain owned by the application service.

## Production implementation boundary

`collectAdmittedSVGDocument()` in the security module first calls the existing input-safety
admission in the caller's reject/explicit-strip policy. Only after that completes does it run the
scanner's document-collection pass. The scanner remains the single tokenizer; the collector is
internal and returns no document on a finding or parser/limit error. The collected tree is
deep-frozen before leaving the safety boundary.

The projection keeps ordered attributes and children, expanded SVG/XML/XLink names, text/CDATA/
comment distinctions, and UTF-16 source spans while retaining the original source string separately.
XML line endings and attribute literal whitespace are normalized in the projection without changing
the legacy security scanner's raw-value checks. Ordinary-text `]]>` is rejected with
`E_INVALID_SVG_XML`. Aggregate attributes, decoded text, nesting, element count, and per-element
attributes are bounded. No unsupported namespace binding is invented and the existing admitted
namespace policy is unchanged.

The bounded document lowers into runtime-validated and frozen `svger-ir-v1`, then the internal
Svelte emitter produces JS or TS Svelte component content. Unknown/unsupported IR, bad references,
invalid namespaces, and output-limit failures return stable `E_SVELTE_IR_*` errors. There is no
legacy fallback. The selected emitter is restricted to its documented static SVG subset; it does not
claim full dynamic Svelte or browser SVG semantics.

The IR, lowerer, and emitter live under `src/compiler/` and are not package subpath exports. The
published runtime modules contain no imports from `experiments/`. A pinned development-only
`uglify-js` build step minifies the internal compiler, scanner/safety, and processor payloads to
keep the archive below the existing package ceiling; it is not a runtime dependency. Minification
preserves function names and wraps generated code at a bounded line width. The build does not
generate or publish source maps; the package already excludes source maps. Stack traces therefore
retain useful function names and line locations within generated code, while detailed source-level
debugging uses the TypeScript source and an unminified local build.

Four integration example files (Babel, Jest, Next.js, and Rollup) remain in the source repository
but are omitted from the npm tarball to preserve the reviewed 5% package entry-count headroom. The
package smoke verifies the files remain in the repository, are absent from the archive, and are
linked from the installed integration guide rather than through broken package-relative paths. That
guide also contains setup snippets for all four integrations; integration entry points and supported
workflows remain unchanged. The Vite and Webpack example files remain in the archive.

## Regression evidence

`tests/phase4/production-svelte-ir-opt-in.test.mjs` covers scanner projection fidelity and
normalization, expanded XLink names, immutable/atomic output, JS and TS generation through the
public compiler service, legacy default/equivalence, cache-mode separation, invalid framework
selection, and unsupported/malformed inputs without artifacts or cache writes.
`tests/phase0/package-smoke.test.mjs` installs the actual packed tarball offline, then invokes the
public service for both opt-in language modes and checks the emitted `.svelte` files. Archive
conformance also verifies the three required runtime compiler modules are present. The Phase 4
minified-build contract compiles identical unminified trees, minifies two copies and compares the
result byte-for-byte, then compares public-service output and diagnostics between unminified and
minified builds for legacy Svelte JS, opted-in Svelte JS/TS, and unsupported IR. It injects
malformed minifier input to verify a nonzero process result and confirms the build chain stops on
that failure. The installed-package smoke runs after the actual build and package process, so its
JS/TS assertions exercise the final minified archive. Runtime dependency assertions confirm
`uglify-js` is not required by consumers.

Directive 035 reconciliation: published documentation previously linked directly to the four omitted
example paths. Those links now point to their maintained repository sources; the package smoke
inspects the installed tarball's integration guide for this compatibility notice. It also verifies
the source example files remain available in the checkout. The supported public exports and all
integration module entry points remain unchanged.

On 2026-10-20 with Node 20.20.2 / npm 10.8.2:

| Check                         | Result                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `npm run quality:full`        | Passed, including Phase 00/01 and installed-package smoke     |
| `npm run test:phase4`         | Passed, including minifier determinism/failure/runtime parity |
| `npm run package:conformance` | Passed: 753 files, 636,301 compressed bytes                   |
| Package size ceiling          | 640,623 bytes; 4,322 bytes remaining                          |
| Package entry ceiling         | 754; 1 entry remaining                                        |
| Lint                          | 0 errors; existing 14 approved `no-explicit-any` warnings     |
| `git diff --check`            | Passed                                                        |

The repository-wide `npm run format:check` still reports the pre-existing formatting difference in
`src/__tests__/README.md`; all files changed for this directive were formatted and checked
separately. No unrelated baseline file was edited to mask that result.

These are local results, not remote CI or management certification. Publishing, default selection,
other framework integration, and Phase 04.3B remain unauthorized.
