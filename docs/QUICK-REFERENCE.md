# Configuration and Optimization Guide

This is a practical reference for project configuration and SVG processing choices. For every CLI
command and flag, see the [CLI reference](CLI-REFERENCE.md). Version 4.1.0 on this branch is planned
and unpublished; verify the installed binary with `svger --help`.

## Configuration file

Create a `.svgconfig.json` file in the project working directory:

```sh
svger config --init
svger config --show
```

A small, reviewable example:

```json
{
  "source": "./src/assets/icons",
  "output": "./src/components/icons",
  "framework": "react",
  "typescript": true,
  "defaultWidth": 24,
  "defaultHeight": 24,
  "defaultFill": "currentColor",
  "unsafeInputPolicy": "reject",
  "maxInputSizeBytes": 10485760,
  "include": ["**/*.svg"],
  "exclude": ["**/draft/**"],
  "outputConfig": {
    "naming": "pascal"
  }
}
```

The defaults include React, TypeScript, `./src/assets/svg` as source, `./src/components/icons` as
output, Pascal-style naming, a bounded input size, and unsafe-input rejection. Use only options
recognized by the current schema; obsolete example keys are rejected instead of silently ignored.

## Configuration precedence

Compiler/service configuration resolves from low to high priority:

1. Built-in defaults.
2. `.svgconfig.json` in the working directory.
3. Compiler creation options.
4. Per-build `config` overrides.
5. Explicit per-build fields such as `framework`, `typescript`, and input-safety policy.

Objects merge recursively, arrays replace, and omitted values do not override. Explicit `false` is
preserved. Inspect values and their origin with:

```sh
svger config --explain
svger config --explain framework --format json
```

Change simple values from the CLI with `svger config --set key=value`. Dot notation selects a nested
property, such as `outputConfig.naming=camel`. The command parses `true`, `false`, and numeric
values; all other values are strings. Use JSON for arrays and nested structures rather than relying
on the scalar setter.

## Common options

| Setting | Purpose |
| --- | --- |
| `source`, `output` | Default source and output paths used by configured workflows. CLI `build` paths are positional. |
| `framework` | `react`, `react-native`, `vue`, `svelte`, `angular`, `solid`, `preact`, `lit`, or `vanilla`. |
| `typescript` | Select TypeScript where target supports it. Angular requires TypeScript. |
| `frameworkOptions` | Framework-specific output options, subject to schema validation. |
| `svelteCompiler` | `legacy` (default) or opt-in `ir-v1` for the bounded static Svelte subset. |
| `unsafeInputPolicy` | `reject` by default, or explicit `strip` policy for selected blocked constructs. `strip` is not a full sanitizer. |
| `maxInputSizeBytes` | Bound input size in bytes. |
| `include`, `exclude` | Source-discovery path globs. CLI can override them with comma-separated lists. |
| `outputConfig.naming` | Component/output naming: `pascal`, `camel`, or `kebab`. |
| `batchSize`, `maxConcurrency` | Scheduling limits for applicable configured workflows. |

Use the [framework guide](FRAMEWORK-GUIDE.md) for examples and the [support matrix](SUPPORT-MATRIX.md)
for compatibility qualification.

## Optimization levels

Select an optimization level for component generation with `build --optimize <level>` or for
standalone SVG optimization with `optimize --level <level>`:

```sh
svger build ./icons ./components --framework react --optimize basic
svger optimize ./icon.svg ./optimized.svg --level balanced
```

The CLI defaults differ by command: `build` uses `basic`, while standalone `optimize` uses
`balanced`. `none`, `basic`, `balanced`, `aggressive`, and `maximum` are accepted for build
generation. The values configure optimization behavior, but not every optional optimizer module is
registered in the normal compiler pipeline. In the current application pipeline, cleaning runs for
non-`none` levels and numeric formatting runs at balanced and higher. Do not infer that choosing
`aggressive` or `maximum` automatically activates every historical experimental path optimizer.

Optimization may change source spelling, attributes, numeric precision, or other SVG details. It
does not guarantee byte preservation, full SVG semantic preservation, accessibility equivalence, or
pixel identity. Retain the source asset and validate output in the real consuming application.
Historical percentage reductions in older engineering records are not current performance promises.

## Build modes and collisions

For `build`, exactly one mode may be selected:

```sh
svger build ./icons ./components --framework react --dry-run
svger build ./icons ./components --framework react --check
svger build ./icons ./components --framework react --diff
```

- `--dry-run` plans/generates without committing files.
- `--check` returns failure when the generated outputs are stale.
- `--diff` reports differences without writing outputs.

If multiple SVG paths produce one output filename, the default collision policy `error` fails the
build. Prefer renaming inputs; `--collision first|last` is available only when deterministic
selection is intended. Build reports support `pretty` (default), `json`, and `ndjson` formats.

## Security and visual validation

Input admission is independent of optimization. DTD/entity declarations, malformed XML, active
content, prohibited external references, CSS cases covered by policy, and resource-limit violations
are rejected before generation. `unsafeInputPolicy: "strip"` changes how selected constructs are
handled and emits a warning; it is not a general-purpose sanitizer. Read the
[SVG input security policy](phase0-svg-input-security.md).

Visual rasterization is a separate optional feature. It requires Node.js `>=20.9.0` and separately
installed `sharp >=0.35.5`, `pixelmatch`, and `pngjs`; it is intentionally unavailable on Node 18.
See [Optional Dependencies](OPTIONAL-DEPENDENCIES.md).

## More detail

- [Full CLI command and option reference](CLI-REFERENCE.md)
- [Framework output examples](FRAMEWORK-GUIDE.md)
- [Configuration pipeline contract](phase0-configuration-pipeline.md)
- [Artifact and export behavior](phase0-artifact-contracts.md)
