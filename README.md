# SVGER-CLI

**Planned next version: 4.1.0 (unreleased).** This development branch is not a published release.
The legacy compiler remains the default; release status is NO-GO while clean CI, dependency review,
maintainer governance, and the open security incident are unresolved.

SVGER-CLI converts SVG files into framework components and provides build-tool integrations,
configuration, optimization, and bounded output transactions. The package declares Node.js
`>=18.17.0`; optional SVG rasterization has a higher runtime requirement (see
[Optional Dependencies](docs/OPTIONAL-DEPENDENCIES.md)).

## Install and build

Install the version currently available from the npm registry. The planned 4.1.0 version described
here is not available to install until a separate release decision authorizes publication.

```sh
npm install --save-dev svger-cli
npx svger build ./icons ./components --framework react --typescript
```

Generate a single component or choose another supported target:

```sh
npx svger generate ./icons/search.svg ./components --framework svelte --no-typescript
```

Use `npx svger --help` and `npx svger build --help` for the installed CLI's options. The CLI rejects
unsafe SVG input by default. The explicit `--unsafe-input-policy strip` option removes selected
blocked constructs and emits a warning; it is not a general-purpose sanitizer.

## Framework and compiler support

The production legacy generator supports React, React Native, Vue, Angular, Svelte, Solid, Preact,
Lit, and standards-based vanilla output. Framework generation does not install each target framework
as a runtime dependency. Framework-specific compile/runtime guarantees are limited to the checks in
the [support matrix](docs/SUPPORT-MATRIX.md).

For Svelte, the legacy generator remains the default. The planned 4.1.0 source adds an explicit
`svelteCompiler: "ir-v1"` option for the bounded static SVG subset, in JavaScript or TypeScript. It
has no dedicated CLI flag; configure it through `.svgconfig.json` or the public compiler service:

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
await compiler.build({
  src: './icons',
  out: './components',
  framework: 'svelte',
  typescript: false,
  svelteCompiler: 'ir-v1',
});
```

Omitting the option selects `legacy`. The IR emitter rejects unsupported input explicitly and does
not silently fall back. IR emitters for other frameworks are experiments only; they are not
production compiler routes.

## Configuration

Use `svger config --init` to create `.svgconfig.json`. Configuration supports the framework,
TypeScript/JavaScript output, optimization level, file discovery, collision policy, concurrency,
input limits, and input safety policy. See the [configuration reference](docs/QUICK-REFERENCE.md),
[framework guide](docs/FRAMEWORK-GUIDE.md), and [support matrix](docs/SUPPORT-MATRIX.md) for
details.

## Integrations

The package's established public subpaths cover Webpack, Vite, Rollup, Babel, Next.js, and Jest. For
exact imports and setup, use the [integration guide](docs/INTEGRATIONS.md). Internal compiler
modules and experimental emitters are not public package exports.

## Performance evidence

The latest opt-in local evaluation (2026-10-20, Node.js 22.22.2 / npm 10.9.7) used 750 synthetic
groups (2,251 SVG elements), eight warm-ups, and 40 samples. Legacy generation measured a 10.086 ms
median / 12.426 ms p95; opt-in Svelte IR measured a 75.562 ms median / 85.575 ms p95—about 7.5×
slower by median on this host and fixture. A separate Phase 04.4 run on Node.js 20.20.2 measured
10.768 ms legacy and 77.829 ms IR for the same element count. Both are host-specific observations,
not cross-platform guarantees or a default-switch rationale. Methodology and limitations are in the
[Phase 04.4 stabilization record](https://github.com/faezemohades/svger-cli/blob/main/docs/phase4.4-production-stabilization.md).

The local evaluation tool can also measure performance, validate generated Svelte output, run the
Phase 04 compatibility suite and listed non-destructive security regressions, and export versioned
JSON. These regressions are not comprehensive security certification; inspect the report's
`quality.semanticStatus` separately from its overall quality status. The evaluator is opt-in and is
not run by normal builds or when the docs site loads. Supplied comparison builds are imported and
executed directly, not sandboxed; use only trusted builds. Exported reports are unsigned local
evidence, and cross-report timing comparisons are not controlled across hosts:

```sh
npm ci
npm run build
npm run evaluate:local -- --help
npm run evaluate:local -- --groups 100,750 --warmups 8 --samples 40 --output reports/local-evaluation.json
```

See the [evaluation guide](https://github.com/faezemohades/svger-cli/blob/main/docs/EVALUATION.md)
and the [benchmark results viewer](https://faezemohades.github.io/svger-cli/evaluation.html).
Results are local observations; no telemetry or upload is performed.

## Security and limitations

- Input is checked before generation; DTDs, unsafe active content, external references covered by
  the policy, malformed XML, and configured resource-limit violations fail closed.
- The SVG scanner and output transaction code are bounded defenses, not a promise that arbitrary SVG
  behavior is preserved or that the package is a complete SVG sanitizer.
- Svelte `ir-v1` supports a defined static subset. It is opt-in, may be slower than legacy, and does
  not imply complete browser rendering, CSS, or accessibility equivalence.
- Visual validation is optional. `sharp` is separately installed and checked against the security
  floor; rasterization is disabled on Node 18 while ordinary generation retains its declared floor.
- The published package export map remains the existing contract. Planned internal compiler modules
  are not directly importable through supported package subpaths.

## Development checks

```sh
npm ci
npm run quality:release
npm run docs:check
npm run evaluate:local -- --groups 50 --warmups 2 --samples 5 --output /tmp/svger-evaluation.json
```

The evaluation command runs only when explicitly invoked. It writes JSON only when an output path is
provided. Package conformance enforces the reviewed archive limits. Publishing remains blocked by
the repository release-authorization policy; a passing local check does not authorize publication.

## Project status

Version 4.1.0 is a proposed minor update, subject to complete compatibility review and release
approval. The current candidate is unreleased. See the [planned changelog](CHANGELOG.md),
[release readiness record](docs/phase4.5-release-readiness.md), and
[release policy](governance/release-policy.json).
