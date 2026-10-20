# Framework Generation Guide

SVGER-CLI converts admitted SVG source to framework component files. It generates source code; it
does not install or bundle the target framework for you. Install the relevant framework/runtime in
the consuming application and validate generated artifacts using that application's compiler and
tests. The [support matrix](SUPPORT-MATRIX.md) states which framework major lines are release-gated.

## Frameworks and output

| Target | TypeScript example | JavaScript example | Notes |
| --- | --- | --- | --- |
| React | `svger build ./icons ./out/react --framework react --typescript` | `... --no-typescript` | Typical extensions `.tsx` / `.jsx`; use in React applications. |
| React Native | `svger build ./icons ./out/native --framework react-native --typescript` | `... --no-typescript` | Typical extensions `.tsx` / `.jsx`; consuming app must provide `react-native-svg`. |
| Vue | `svger build ./icons ./out/vue --framework vue --typescript --composition` | `... --no-typescript --composition` | `.vue` single-file components; `--composition` selects `<script setup>`. |
| Angular | `svger build ./icons ./out/angular --framework angular --typescript --standalone` | Not supported | `.component.ts`; Angular output requires TypeScript. `--standalone` requests standalone components. |
| Svelte | `svger build ./icons ./out/svelte --framework svelte --typescript` | `... --no-typescript` | `.svelte`; legacy generator is the default. |
| Solid | `svger build ./icons ./out/solid --framework solid --typescript` | `... --no-typescript` | Typical extensions `.tsx` / `.jsx`. |
| Preact | `svger build ./icons ./out/preact --framework preact --typescript` | `... --no-typescript` | Typical extensions `.tsx` / `.jsx`. |
| Lit | `svger build ./icons ./out/lit --framework lit --typescript` | `... --no-typescript` | Typical extensions `.ts` / `.js`; web components. |
| Vanilla DOM | `svger build ./icons ./out/vanilla --framework vanilla --typescript` | `... --no-typescript` | Typical extensions `.ts` / `.js`; browser DOM factory output. |

The framework names above are accepted by the compiler. Some CLI help text may list a narrower
summary; consult the installed version's `svger build --help` and support matrix. Output extension
is selected centrally from the framework and language mode. Unsupported combinations fail with a
diagnostic rather than silently emitting a different language.

## Single-file generation

Use `generate` to convert just one SVG. The output argument is a directory:

```sh
svger generate ./icons/search.svg ./src/components/icons --framework react --typescript
svger generate ./icons/wordmark.svg ./src/components --framework vue --no-typescript --composition
svger generate ./icons/status.svg ./src/lib/icons --framework svelte --no-typescript
```

The component name is derived from the input filename. Use `build` for multiple source files,
selection filters, collision handling, deterministic build reports, and preview/check modes.

## Directory builds and watch workflows

```sh
# Build the immediate directory
svger build ./icons ./src/components/icons --framework preact

# Recursively build selected SVG files and report in JSON
svger build ./assets ./src/generated --framework solid --recursive \
  --include '*.svg,**/*.svg' --exclude '**/draft/**' --format json

# Start rebuild-on-change mode
svger watch ./icons ./src/components/icons
```

Discovery skips hidden paths and ignores symlinks by default. `--hidden` includes hidden paths;
`--symlinks follow|error` changes symlink handling. The `build` command also provides bounded
file-count/concurrency/batch options. When several input names map to the same component output,
the default collision policy is `error`; fix the names or deliberately choose `first` or `last`.

## Framework-specific settings

- `--composition` is the Vue Composition API / `<script setup>` choice.
- `--standalone` requests an Angular standalone component.
- `--signals` is available on `build` for the applicable Angular/Solid generator option; it is not
  registered for the single-file `generate` command.
- `--typescript` is the default where supported; `--no-typescript` requests JavaScript.
- `react-native` output uses React Native SVG primitives and therefore requires the consumer's
  `react-native-svg` dependency.

These flags do not replace the target framework's own application/compiler configuration. They
select output form; they do not guarantee a specific runtime version or rendering result.

## Svelte compiler modes

The legacy Svelte generator remains the default. The planned 4.1.0 source also accepts
`svelteCompiler: "ir-v1"` as an explicit opt-in through `.svgconfig.json` or the public compiler
service (there is no dedicated CLI flag):

```json
{
  "framework": "svelte",
  "typescript": false,
  "svelteCompiler": "ir-v1"
}
```

```js
import { createSVGCompiler } from 'svger-cli';

const compiler = await createSVGCompiler({ cwd: process.cwd() });
const report = await compiler.build({
  src: './icons',
  out: './components',
  framework: 'svelte',
  typescript: false,
  svelteCompiler: 'ir-v1',
});
```

`ir-v1` lowers admitted static SVG through a bounded internal IR. Unsupported constructs are rejected
explicitly; there is no silent fallback to legacy. This mode is not a claim of complete dynamic
Svelte behavior, browser rendering, CSS-cascade, or accessibility equivalence, and local evaluation
found it slower than legacy for its measured synthetic fixture. Read the
[Svelte integration record](phase4.3a-svelte-ir-opt-in-integration.md) and
[release status](phase4.5-release-readiness.md) before selecting it.

IR emitters for other frameworks remain experimental and are not production generation routes.

## Imports and build-tool integrations

For project-level build integration, use the documented package subpaths rather than invoking the
CLI in a build hook yourself. Examples and lifecycle details are in [Integrations](INTEGRATIONS.md):

```js
import { svgerVitePlugin } from 'svger-cli/vite';

export default {
  plugins: [svgerVitePlugin({ framework: 'react', typescript: true })],
};
```

Supported integration families are Webpack, Vite, Rollup, Babel, Next.js, and Jest. Check the
[support matrix](SUPPORT-MATRIX.md) for release-gated major lines.

## SVG safety, optimization, and validation

Every public input path applies security admission before generation. Unsafe input is rejected by
default. `--unsafe-input-policy strip` is an explicit escape hatch that removes selected blocked
constructs and warns; it is not a complete sanitizer. Do not use it as a general-purpose safety
filter. Details: [SVG input security](phase0-svg-input-security.md).

Optimization level is independent of framework selection. Transformations can alter lexical SVG
representation; they are not proof of full semantic or pixel equivalence. The active pipeline and
defaults are documented in [Configuration and Optimization](QUICK-REFERENCE.md). Keep source files
under version control and compile generated output in the consuming framework.

Optional `--validate` rasterization requires compatible optional dependencies and Node.js
`>=20.9.0`; normal generation retains the declared Node floor. See [Optional Dependencies](OPTIONAL-DEPENDENCIES.md).

## Programmatic compilation and checks

The public package root exports `createSVGCompiler`. It returns an isolated compiler with `build`
and `config.explain`; exact TypeScript signatures come from the installed package's declarations.
Internal compiler modules are not public exports.

```sh
npm run test:phase0
npm run test:phase4
npm run test:package
```

These repository commands require the development checkout. The [CLI reference](CLI-REFERENCE.md)
documents end-user commands; the [evaluation guide](EVALUATION.md) covers optional local measurement.
