# SVGER-CLI

**SVG-to-component generation for nine UI framework targets, with security-conscious processing,
build-tool integrations, and reproducible local evaluation.**

> **Version and release status (20 October 2026):** `4.0.9` is the established published
> compatibility baseline. **`4.1.0` is planned, locally prepared, and not published.** The examples
> explicitly labeled **4.1.0 planned** describe the separate development branch, not features
> guaranteed to exist in the npm-installed 4.0.9 package. Release qualification remains **NO-GO**
> pending independent CI, security incident closure, governance approval, and dependency
> verification. Do not interpret passing local tests as publication authorization.

[Documentation website](https://faezemohades.github.io/svger-cli/) ·
[Documentation source](./docs-site/README.md) · [CLI reference](#command-reference) ·
[Framework cookbook](#framework-cookbook) · [Integrations](#build-tool-and-test-integrations) ·
[Evaluation guide](./docs/EVALUATION.md) · [Changelog](./CHANGELOG.md) ·
[Source repository](https://github.com/faezemohades/svger-cli)

**Documentation availability:** the public GitHub Pages site can lag behind the unpublished local
4.1.0 branch. The `docs-site/` and `docs/` files in this branch describe the planned features. No
documentation page launches a benchmark or uploads a report merely by being opened.

## Contents

- [At a glance](#at-a-glance)
- [Which version should I use?](#which-version-should-i-use)
- [Installation and prerequisites](#installation-and-prerequisites)
- [Your first conversion](#your-first-conversion)
- [Framework cookbook](#framework-cookbook) — React, React Native, Vue, Svelte, Angular, Solid,
  Preact, Lit, Vanilla
- [Svelte IR v1 opt-in (planned 4.1.0)](#svelte-ir-v1-opt-in-planned-410)
- [Command reference](#command-reference) — every registered CLI command and its options
- [Configuration reference](#configuration-reference)
- [Build tool and test integrations](#build-tool-and-test-integrations) — Vite, Webpack, Rollup,
  Babel, Next.js, Jest
- [Library/service API](#libraryservice-api)
- [Local benchmark, quality and security evaluation (planned 4.1.0)](#local-benchmark-quality-and-security-evaluation-planned-410)
- [Security model and limitations](#security-model-and-limitations)
- [Recipes for teams and CI](#recipes-for-teams-and-ci)
- [Troubleshooting](#troubleshooting)
- [Contributor commands](#contributor-commands)
- [Categorized documentation directory](#categorized-documentation-directory)
- [Release and contribution policy](#release-and-contribution-policy)

## At a glance

SVGER-CLI processes SVG source files and produces framework components. Its supported public
functionality includes a CLI, a library/service API, and integrations with common build tools. The
default compiler remains the **legacy generator** in all framework targets.

| Area                       | Capability                                                                                                | Important qualification                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework generation       | React, React Native, Vue, Svelte, Angular, Solid, Preact, Lit, Vanilla                                    | Different frameworks produce different file types and component APIs. Inspect generated artifacts before using them. |
| Languages                  | JavaScript and TypeScript where supported                                                                 | Angular JavaScript is intentionally unsupported; use TypeScript.                                                     |
| Processing                 | File discovery, naming, optimizers, optional plugins, batch generation                                    | Available options differ between `build`, `generate`, and `watch`.                                                   |
| Output safety              | Input admission, output planning, collision detection, recoverable transactions                           | Default unsafe-input policy is `reject`; validation is not a full XML/browser security proof.                        |
| Build integrations         | Webpack, Vite, Rollup, Babel, Next.js, Jest                                                               | These are distinct package subpath exports; see examples below.                                                      |
| Svelte IR                  | Static SVG subset through `svelteCompiler: 'ir-v1'`                                                       | **Planned 4.1.0, explicit opt-in only.** Unsupported input fails instead of silently falling back.                   |
| Local evaluator            | Performance, native Svelte compilation, deterministic output, selected security regressions, JSON reports | **Planned 4.1.0, run locally and explicitly.** No universal speed or security certification claims.                  |
| Optional visual validation | `sharp`, `pixelmatch`, `pngjs` for raster comparison                                                      | `sharp` is separately installed; visual rasterization requires Node >=20.9.0 and `sharp >=0.35.5` in planned 4.1.0.  |

### A project layout

```text
my-app/
├── assets/icons/
│   ├── arrow-left.svg
│   ├── home.svg
│   └── search.svg
├── src/generated/icons/       # generator-owned output
├── .svgconfig.json             # optional configuration
└── package.json
```

Keep original SVGs separate from generated code; do not hand-edit generated outputs. Use distinct
output folders when targeting multiple frameworks, and consider checking generated files into
version control only if that fits your team's regeneration policy.

## Which version should I use?

| Version | Availability                        | What to expect                                                                                                                                         |
| ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `4.0.9` | Existing npm compatibility baseline | Standard legacy generator, CLI, public integrations, and established package exports.                                                                  |
| `4.1.0` | **Planned / unpublished**           | Documentation refresh, Svelte IR opt-in, local evaluation/report viewer, security and stability work. Verify from source until authorized publication. |

**Do not assume** `npm install svger-cli` presently installs the local planned work. Confirm what
npm actually installs with `npm view svger-cli version` and check the installed CLI with
`npx svger-cli --version`. This README is intended for the planned documentation branch; examples
for newer functionality are labeled.

## Installation and prerequisites

- **Node.js:** core package declares `>=18.17.0`. Version support and optional native-feature
  support are different commitments.
- **npm:** a compatible npm installation with your Node runtime.
- **Project:** an existing JS/TS application or a folder containing `.svg` files.

```bash
# Add the currently published package as a development dependency.
npm install --save-dev svger-cli

# Inspect the actual installed CLI version.
npx svger-cli --version

# Find the supported command syntax for *your installed version*.
npx svger-cli --help

# Optionally install the published CLI globally (not needed when using npx).
npm install --global svger-cli
```

`npx svger-cli` runs the project-local CLI if installed. `svger` is also a declared executable
alias; the examples use `svger-cli` consistently. For reproducible CI, commit the lockfile and run
`npm ci` instead of installing a floating dependency during every build.

## Your first conversion

Create a valid SVG source:

```bash
mkdir -p assets/icons src/generated/icons
cat > assets/icons/home.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M3 11 12 3l9 8v10H3z" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>
SVG
```

The commands here have distinct purposes:

```bash
# Generate React + TypeScript components from every discovered SVG.
npx svger-cli build assets/icons src/generated/icons --framework react --typescript

# Preview a build plan without writing outputs (v4 build command).
npx svger-cli build assets/icons src/generated/icons --framework react --dry-run

# Check whether existing generated outputs are stale; useful in CI.
npx svger-cli build assets/icons src/generated/icons --framework react --check

# Convert one SVG file instead of a directory.
npx svger-cli generate assets/icons/home.svg src/generated/icons --framework react
```

The general syntax is `svger-cli build <src> <out>` and `svger-cli generate <svgFile> <out>`. Older
documentation sometimes uses `--src` and `--out`; these are deprecated build/watch/clean aliases,
**not** the preferred form. Inspect the actual generated filename, extension, props and index
exports because their details depend on framework, language and configuration.

## Framework cookbook

These examples deliberately use the common positional CLI syntax. Each command creates output
specifically for one target; they do not automatically install or configure that framework's
runtime. Install your framework and the appropriate compiler/toolchain separately.

### React — TSX component library

```bash
# Generate typed React SVG components into a dedicated icon directory.
npx svger-cli build assets/icons src/generated/react --framework react --typescript

# Preview changes before replacing generated files.
npx svger-cli build assets/icons src/generated/react --framework react --typescript --diff
```

**Use case:** React dashboards, design systems and icon packages. Import the generated component
using the filename or barrel export that was actually produced. An illustrative consumer looks like:

```tsx
// Replace Home with the verified generated symbol/file if naming differs.
import { Home } from './generated/react';

export function Toolbar() {
  return (
    <button aria-label="Home">
      <Home width={20} height={20} />
    </button>
  );
}
```

The generator controls source output; React controls component rendering. Check accessibility:
decorative icons should not repeat accessible labels, while meaningful icons need an appropriate
accessible name on the SVG or its parent control.

### React Native — native icon components

```bash
# Generate for React Native, not browser React.
npx svger-cli build assets/icons src/generated/react-native --framework react-native --typescript
```

**Use case:** mobile apps using React Native and a compatible SVG rendering runtime. React Native
SVG components require a renderer such as `react-native-svg` in the consuming application; do not
import generated native components directly into a browser React application. Check peer
dependencies and emitted import paths before shipping.

### Vue 3 — composition-oriented SFCs

```bash
# Generate Vue single-file components, requesting script setup style.
npx svger-cli build assets/icons src/generated/vue --framework vue --composition --typescript

# Build JS-based Vue artifacts instead of TypeScript where supported.
npx svger-cli build assets/icons src/generated/vue-js --framework vue --composition --no-typescript
```

**Use case:** Vue 3 applications and icon libraries. After verifying filenames, a consuming SFC may
use:

```vue
<script setup lang="ts">
import Home from './generated/vue/Home.vue';
</script>

<template>
  <button aria-label="Home"><Home /></button>
</template>
```

`--composition` selects the requested Vue composition/script-setup integration. Vue compiler and SFC
tooling are still supplied by your application.

### Svelte — legacy output (default)

```bash
# Generate Svelte TypeScript components using the default legacy route.
npx svger-cli build assets/icons src/generated/svelte --framework svelte --typescript

# Generate Svelte JavaScript components instead.
npx svger-cli build assets/icons src/generated/svelte-js --framework svelte --no-typescript
```

**Use case:** Svelte projects that need SVG components with the established generator behavior. For
consumers:

```svelte
<script lang="ts">
  import Home from './generated/svelte/Home.svelte';
</script>

<button aria-label="Home"><Home /></button>
```

The CLI does **not** expose a dedicated `--svelte-compiler` switch in the inspected v4 command
interface. The planned IR route is described below through configuration or the public compiler
service.

### Angular — TypeScript and standalone components

```bash
# Generate Angular standalone TypeScript components.
npx svger-cli build assets/icons src/generated/angular --framework angular --standalone --typescript

# When required, request the Angular signals option.
npx svger-cli build assets/icons src/generated/angular-signals --framework angular --standalone --signals --typescript
```

**Use case:** Angular component libraries and apps. Import generated classes and use their declared
selectors according to the actual generated Angular sources; do not assume that a filename equals a
component selector. **Angular `--no-typescript` is unsupported** and must not be used as an
alternative to a TypeScript build.

### Solid — reactive JSX target

```bash
# Generate Solid components using TypeScript.
npx svger-cli build assets/icons src/generated/solid --framework solid --typescript
```

**Use case:** SolidJS interfaces and design-system packages. Use the Solid compiler/transpilation
pipeline rather than treating its JSX as React JSX.

### Preact — lightweight JSX target

```bash
# Generate TSX for Preact projects.
npx svger-cli build assets/icons src/generated/preact --framework preact --typescript

# Generate JavaScript for an untyped Preact project.
npx svger-cli build assets/icons src/generated/preact-js --framework preact --no-typescript
```

**Use case:** lightweight browser apps. Configure your consuming application for Preact JSX
transforms and inspect the generated prop and import conventions.

### Lit — web component target

```bash
# Generate Lit/TypeScript components.
npx svger-cli build assets/icons src/generated/lit --framework lit --typescript
```

**Use case:** framework-independent web component integration. Inspect the generated custom-element
name or registration procedure before adding its tag to HTML; the CLI command alone does not
register the element in your browser runtime.

### Vanilla JavaScript / TypeScript

```bash
# Generate framework-free JavaScript output.
npx svger-cli build assets/icons src/generated/vanilla-js --framework vanilla --no-typescript

# Generate typed vanilla artifacts for TS-oriented projects.
npx svger-cli build assets/icons src/generated/vanilla-ts --framework vanilla --typescript
```

**Use case:** non-framework applications and simple shared UI utilities. The generated output's
export/DOM contract depends on the selected language and generator; inspect it before integrating.

### Generate several targets from the same SVG catalog

```bash
# Each invocation has a distinct output directory and target runtime.
npx svger-cli build assets/icons packages/icons-react/src --framework react --typescript
npx svger-cli build assets/icons packages/icons-vue/src --framework vue --composition --typescript
npx svger-cli build assets/icons packages/icons-svelte/src --framework svelte --typescript
npx svger-cli build assets/icons packages/icons-angular/src --framework angular --standalone --typescript
```

**Why:** framework-specific output cannot safely be shared as one compiled directory. This approach
is appropriate for monorepos and component libraries; package and test each target independently.

### Framework support matrix

| Target passed to `--framework` | Typical consumer | JavaScript | TypeScript | Notes                                    |
| ------------------------------ | ---------------- | ---------- | ---------- | ---------------------------------------- |
| `react`                        | React            | Yes        | Yes        | JSX/TSX, generated naming varies         |
| `react-native`                 | React Native     | Yes        | Yes        | Requires native SVG consumer setup       |
| `vue`                          | Vue 3            | Yes        | Yes        | SFC, `--composition` supported           |
| `svelte`                       | Svelte           | Yes        | Yes        | Legacy default; IR opt-in is planned     |
| `angular`                      | Angular          | **No**     | Yes        | `--standalone` and `--signals` available |
| `solid`                        | SolidJS          | Yes        | Yes        | Solid-specific JSX processing            |
| `preact`                       | Preact           | Yes        | Yes        | Preact-specific JSX processing           |
| `lit`                          | Lit              | Yes        | Yes        | Web component target                     |
| `vanilla`                      | Browser/JS       | Yes        | Yes        | No framework required                    |

The JS/TS column describes the intended generator-language contract, not a guarantee that every
downstream toolchain needs no configuration. More in [Framework Guide](./docs/FRAMEWORK-GUIDE.md)
and [Support Matrix](./docs/SUPPORT-MATRIX.md).

## Svelte IR v1 opt-in (planned 4.1.0)

The Svelte IR compiler uses the production SVG safety scanner, a bounded XML document projection, a
validated internal IR, and a Svelte emitter for a **documented static SVG subset**. It intentionally
rejects unsupported SVG constructs rather than silently falling back to the legacy generator. No
other framework is routed through production IR by this setting.

### Option 1 — `.svgconfig.json`

```json
{
  "source": "./assets/icons",
  "output": "./src/generated/svelte-ir",
  "framework": "svelte",
  "typescript": true,
  "svelteCompiler": "ir-v1",
  "unsafeInputPolicy": "reject"
}
```

```bash
# Build normally; the configuration supplies the Svelte compiler mode.
npx svger-cli build assets/icons src/generated/svelte-ir --framework svelte --typescript
```

`legacy` or an omitted `svelteCompiler` value means the legacy route. Selecting `ir-v1` for a
non-Svelte framework is an error. Use a project configuration only on a checkout that includes the
planned Svelte opt-in implementation.

### Option 2 — public compiler service

```ts
import { createSVGCompiler } from 'svger-cli';

const compiler = await createSVGCompiler({ cwd: process.cwd() });
const report = await compiler.build({
  src: './assets/icons',
  out: './src/generated/svelte-ir',
  framework: 'svelte',
  typescript: true, // false selects Svelte JavaScript
  svelteCompiler: 'ir-v1',
});

console.log(report.status);
```

**Use case:** application or build-tool code needs an explicit compiler choice without depending on
a CLI flag. The mode participates in resolved configuration/cache identity, and unsuccessful IR
generation must not write partial artifacts. This does not claim universal SVG semantics, feature
parity with legacy, or performance superiority.

## Command reference

The following public command names and options are grounded in the v4 CLI registration. Commands
that appear only in old marketing documentation (`init`, `performance`, `unlock --all`,
`config --validate`, and others) **should not be treated as registered commands** unless confirmed
by your installed version's `--help`.

### Command map

| Command                     | Purpose                                         | Typical scenario               |
| --------------------------- | ----------------------------------------------- | ------------------------------ |
| `svger-cli --help`          | Display installed CLI help                      | Discover available flags       |
| `svger-cli --version`       | Show installed CLI version                      | Support/debug logs             |
| `build <src> <out>`         | Generate a directory of SVG components          | Build/CI workflows             |
| `watch <src> <out>`         | Watch SVG changes and regenerate                | Active development             |
| `generate <svgFile> <out>`  | Generate from one SVG                           | One-off component              |
| `optimize <input> [output]` | Optimize SVG without component generation       | Asset preparation              |
| `clean <out>`               | Clean generator-owned output                    | Reset generated artifacts      |
| `recover <directory>`       | Inspect/recover interrupted output transactions | Interrupted writes             |
| `config --init`             | Create `.svgconfig.json`                        | New project setup              |
| `config --show`             | Display saved project config                    | Debugging configuration        |
| `config --set <key=value>`  | Change a config value                           | Scripted setup                 |
| `config explain [path]`     | Show effective config and origins               | Config precedence diagnosis    |
| `plugins [--load ...]`      | List/load plugins                               | Extension management           |
| `lock <files...>`           | Mark files protected                            | Guard generated/managed assets |
| `unlock <files...>`         | Remove an existing lock                         | Authorized regeneration        |
| `migrate <target> [path]`   | Migrate v4 config/imports/plugins               | Upgrade projects               |

### `build` — complete option reference

**Syntax:** `svger-cli build <src> <out> [options]`

| Option                           | Meaning / effect                                         | Usage guidance                                                                                                                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<src>`                          | Input SVG directory                                      | Required positional argument                                                                                                                                                                                                                        |
| `<out>`                          | Destination for generated code                           | Required positional argument; keep separate from sources                                                                                                                                                                                            |
| `--framework <type>`             | Select one of the nine framework targets                 | Use an exact supported framework identifier                                                                                                                                                                                                         |
| `--typescript`                   | Request TS output                                        | Default language behavior may depend on resolved config                                                                                                                                                                                             |
| `--no-typescript`                | Request JS output                                        | Do not use with Angular                                                                                                                                                                                                                             |
| `--composition`                  | Vue script-setup/composition option                      | Vue only                                                                                                                                                                                                                                            |
| `--standalone`                   | Angular standalone option                                | Angular only                                                                                                                                                                                                                                        |
| `--signals`                      | Angular signals option                                   | Angular only                                                                                                                                                                                                                                        |
| `--optimize <level>`             | `none`, `basic`, `balanced`, `aggressive`, `maximum`     | Select a level based on validated visual/output behavior                                                                                                                                                                                            |
| `--unsafe-input-policy <policy>` | `reject` (default) or explicit `strip`                   | Reject is the safer default; stripping can change the SVG                                                                                                                                                                                           |
| `--max-input-size <bytes>`       | Positive raw SVG size limit                              | Input-boundary defense                                                                                                                                                                                                                              |
| `--plugin <names>`               | Comma-separated plugin names/paths to load               | Use only trusted plugins: plugin code executes locally                                                                                                                                                                                              |
| `--list-plugins`                 | List available registered plugins                        | Supported as an option on `build`                                                                                                                                                                                                                   |
| `--recursive`                    | Discover nested SVG folders                              | Large asset trees                                                                                                                                                                                                                                   |
| `--include <globs>`              | Comma-separated include patterns                         | Limit files in the build                                                                                                                                                                                                                            |
| `--exclude <globs>`              | Comma-separated exclude patterns                         | Exclude drafts/generated folders                                                                                                                                                                                                                    |
| `--hidden`                       | Include hidden files and folders                         | Usually unnecessary                                                                                                                                                                                                                                 |
| `--symlinks <policy>`            | `ignore`, `follow` or `error`                            | Prefer conservative handling on untrusted trees                                                                                                                                                                                                     |
| `--max-file-count <count>`       | Cap number of discovered SVG files                       | Prevent accidental huge builds                                                                                                                                                                                                                      |
| `--collision <policy>`           | `error`, `first`, `last`                                 | Prefer `error` until collision resolution is deliberate                                                                                                                                                                                             |
| `--concurrency <count>`          | Max parallel build jobs                                  | Tune against CPU/IO capacity                                                                                                                                                                                                                        |
| `--batch-size <count>`           | Scheduler batch limit                                    | Tune only after measurement                                                                                                                                                                                                                         |
| `--dry-run`                      | Produce plan without filesystem writes                   | Validate before migration                                                                                                                                                                                                                           |
| `--check`                        | Fail if output differs from expected generated artifacts | Reproducibility gate in CI                                                                                                                                                                                                                          |
| `--diff`                         | Report differences without writing                       | Review proposed changes                                                                                                                                                                                                                             |
| `--format <type>`                | `pretty`, `json`, `ndjson` build report                  | Machine-readable automation                                                                                                                                                                                                                         |
| `--validate`                     | Declared visual-validation flag                          | **Caution:** in the inspected v4 build command, the flag is registered but not forwarded into the build-service options; do not rely on it as a verified build gate without checking the current source. `optimize --validate` is wired separately. |
| `--src <path>` / `--out <path>`  | Deprecated path aliases                                  | Use positional arguments                                                                                                                                                                                                                            |
| `--naming <type>`                | Deprecated `kebab`, `pascal`, `camel` alias              | Prefer `outputConfig.naming` in config                                                                                                                                                                                                              |

**Build mode rules:** `--dry-run`, `--check`, and `--diff` are mutually exclusive. Omitting them
writes output via the standard build application path.

```bash
# Recursively discover a bounded input set; reject path/filename collisions.
npx svger-cli build assets/icons src/generated/react --framework react --recursive --max-file-count 5000 --collision error

# Build only selected assets; exclude experimental icons.
npx svger-cli build assets/icons src/generated/react --framework react --include 'ui/**,brand/**' --exclude 'draft/**'

# Produce a machine-readable CI plan without touching generated code.
npx svger-cli build assets/icons src/generated/react --framework react --dry-run --format json

# Fail CI when generated files are stale.
npx svger-cli build assets/icons src/generated/react --framework react --check --format json

# Strictly reject active or externally referenced SVG content.
npx svger-cli build assets/icons src/generated/react --framework react --unsafe-input-policy reject --max-input-size 10485760
```

### `watch` — change-driven generation

**Syntax:** `svger-cli watch <src> <out> [options]`. The registered watch-specific options are
`--unsafe-input-policy`, `--max-input-size`, and deprecated `--src`, `--out`, `--watch` aliases. It
does **not** accept every build command option in the inspected command interface; place shared
framework preferences in `.svgconfig.json`.

```bash
# Keep generated icons synchronized while editing SVGs; Ctrl+C stops watching.
npx svger-cli watch assets/icons src/generated/react --unsafe-input-policy reject
```

Watch mode observes the source directory and triggers regeneration. Check your project config for
the framework and language selection; do not assume `watch --framework ...` is supported just
because `build --framework ...` is.

### `generate` — one input file

**Syntax:** `svger-cli generate <svgFile> <out> [options]`.

Supported options: `--framework`, `--typescript`, `--no-typescript`, `--composition`,
`--standalone`, `--optimize`, `--unsafe-input-policy`, `--max-input-size`.

```bash
# Convert exactly one SVG to a Vue single-file component.
npx svger-cli generate assets/icons/home.svg src/generated/vue --framework vue --composition --typescript

# Convert exactly one SVG to an Angular TypeScript component.
npx svger-cli generate assets/icons/home.svg src/generated/angular --framework angular --standalone --typescript
```

This command is suitable for a one-off icon, not full directory synchronization. It does not expose
a `--name` flag in the inspected v4 CLI registration; component naming comes from the generator's
established naming behavior and configuration.

### `optimize` — optimize SVG assets without producing components

**Syntax:** `svger-cli optimize <input> [output] [options]`.

| Option                     | Purpose                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `--level <type>`           | `basic`, `balanced`, `aggressive`, `maximum`; default `balanced` in the inspected command |
| `--in-place`               | Overwrite original SVG input; use only with backups or version control                    |
| `--validate`               | Request the visual-diff validation path (requires optional raster dependencies)           |
| `--unsafe-input-policy`    | Reject or explicitly strip unsafe constructs before processing                            |
| `--max-input-size <bytes>` | Limit raw input size                                                                      |

```bash
# Prefer an explicit destination when trying an optimizer for the first time.
npx svger-cli optimize assets/icons/home.svg assets/optimized/home.svg --level balanced

# Overwrite the original asset only when that is intentional.
npx svger-cli optimize assets/icons/home.svg --in-place --level basic
```

**Visual validation:** planned 4.1.0 requires Node >=20.9.0 and separately installed
`sharp >=0.35.5`, `pixelmatch`, and `pngjs`. A successful `optimize` command by itself does not
prove pixel-for-pixel rendering equivalence.

### `clean` — remove generator output

**Syntax:** `svger-cli clean <out>`; `--out` is a deprecated alias.

```bash
# Remove artifacts from a dedicated, generator-owned directory.
npx svger-cli clean src/generated/react
```

Cleaning is destructive. Never use a mixed directory containing handwritten components. Check the
target path first.

### `recover` — incomplete transactions

**Syntax:** `svger-cli recover <directory> [--format pretty|json]`.

```bash
# Inspect/recover output transactions after an interrupted build.
npx svger-cli recover src/generated/react --format json
```

This is a recovery operation, not a general-purpose undo or arbitrary file restoration system. It
examines the generator's transaction journals and reports diagnostics when recovery is unsafe or
incomplete.

### `config` — project configuration

**Syntax:** `svger-cli config [action] [path] [options]`.

```bash
# Create the default .svgconfig.json in the current project.
npx svger-cli config --init

# Print saved config as JSON.
npx svger-cli config --show

# Set a simple top-level config key; values such as true and numbers are parsed.
npx svger-cli config --set framework=vue
npx svger-cli config --set typescript=true

# Explain resolved config values and their origin.
npx svger-cli config explain --format json
```

`--explain` is another registered config route. Complex nested configuration is clearer and easier
to review when edited in `.svgconfig.json`. The inspected v4 CLI does **not** register
`svger-cli init` or `config --validate` as separate commands.

### `plugins` — extension listing/loading

**Syntax:** `svger-cli plugins [--load <names>]`.

```bash
# List registered plugins and their reported metrics.
npx svger-cli plugins

# Explicitly load a trusted plugin in your local environment.
npx svger-cli plugins --load ./tools/my-svg-plugin.js
```

Plugin modules are executable code. Do not load plugins from an unreviewed path or package. A
command that lists available plugins does not imply every old example plugin name is installed.

### `lock` and `unlock` — file protection

**Syntax:** `svger-cli lock <files...>` and `svger-cli unlock <files...>`.

```bash
# Protect two named SVG files from accidental managed modifications.
npx svger-cli lock assets/icons/brand.svg assets/icons/logo.svg

# Release the managed lock on a specific file.
npx svger-cli unlock assets/icons/brand.svg
```

The inspected CLI expects explicit file arguments; do not rely on historical `unlock --all`
instructions.

### `migrate` — v4 compatibility changes

**Syntax:** `svger-cli migrate <target> [path] [--dry-run] [--no-backup] [--format pretty|json]`,
where `<target>` is `config`, `imports`, or `plugins`.

```bash
# Preview old configuration migration without modifying files.
npx svger-cli migrate config .svgconfig.json --dry-run --format json

# Apply configuration migration with the default backup behavior.
npx svger-cli migrate config .svgconfig.json

# Preview import rewriting for a project directory.
npx svger-cli migrate imports ./src --dry-run

# Preview plugin-declaration migration.
npx svger-cli migrate plugins .svgconfig.json --dry-run
```

Avoid `--no-backup` unless you have another verified recovery method. Migration is not the same as
changing compiler defaults.

## Configuration reference

The project configuration file is `.svgconfig.json`. Use CLI arguments for one-off build overrides
and configuration for shared team choices. The following is an **illustrative subset**, not a full
replacement for every field produced by `config --init`:

```json
{
  "source": "./assets/icons",
  "output": "./src/generated/icons",
  "framework": "react",
  "typescript": true,
  "cache": true,
  "batchSize": 10,
  "maxConcurrency": 4,
  "maxInputSizeBytes": 10485760,
  "unsafeInputPolicy": "reject",
  "outputConfig": { "naming": "pascal" }
}
```

| Category          | Common keys                                    | Meaning                                  |
| ----------------- | ---------------------------------------------- | ---------------------------------------- |
| Paths             | `source`, `output`                             | Input folder and generated destination   |
| Target            | `framework`, `typescript`                      | Framework/language choice                |
| Safety            | `unsafeInputPolicy`, `maxInputSizeBytes`       | Admission policy and input ceiling       |
| Build resources   | `batchSize`, `maxConcurrency`, `cache`         | Scheduler and caching preferences        |
| Naming            | `outputConfig.naming`                          | Naming convention for planned artifacts  |
| Framework options | `react`, `vue`, `angular` configuration blocks | Framework-specific generator choices     |
| Svelte compiler   | `svelteCompiler` (`legacy` / `ir-v1`)          | **Planned 4.1.0 only**, opt-in Svelte IR |

Do not blindly copy stale configuration examples from older versions. Inspect
[`src/types/index.ts`](./src/types/index.ts), the current resolver, and `svger-cli config explain`
when a value's precedence is unclear. The security policy applies before the compiler consumes
admitted content.

## Build tool and test integrations

The following examples use the package's documented subpath exports. **ES module configuration is
preferred** because the package declares ESM (`"type": "module"`) and import-based exports. Avoid
treating historical CommonJS `require('svger-cli/...')` examples as guaranteed without testing the
installed package and tooling.

### Vite

```js
// vite.config.mjs — generate icons when the Vite build begins.
import { svgerVitePlugin } from 'svger-cli/vite';

export default {
  plugins: [
    svgerVitePlugin({
      source: './assets/icons',
      output: './src/generated/react',
      framework: 'react',
      typescript: true,
      hmr: true,
      generateIndex: true,
    }),
  ],
};
```

**Role:** Vite build/dev integration with generation and optional hot updates. `source` defines
watched/processed SVGs, `output` is the artifact destination, and `framework` selects the compiler
target. See [Vite integration documentation](./docs/INTEGRATIONS.md#vite-integration).

### Webpack

```js
// webpack.config.mjs — invoke SVG generation as part of Webpack.
import { SvgerWebpackPlugin } from 'svger-cli/webpack';

export default {
  plugins: [
    new SvgerWebpackPlugin({
      source: './assets/icons',
      output: './src/generated/react',
      framework: 'react',
      typescript: true,
      generateIndex: true,
    }),
  ],
};
```

**Role:** Webpack plugin for generated assets; package also declares `svger-cli/webpack-loader` for
SVG imports. Avoid configuring two transformations for the same source without understanding their
interaction. See [Webpack integration documentation](./docs/INTEGRATIONS.md#webpack-integration).

### Rollup

```js
// rollup.config.mjs — prepare icons during library builds.
import { svgerRollupPlugin } from 'svger-cli/rollup';

export default {
  input: './src/index.js',
  output: { file: './dist/library.js', format: 'es' },
  plugins: [
    svgerRollupPlugin({
      source: './assets/icons',
      output: './src/generated/react',
      framework: 'react',
      typescript: true,
    }),
  ],
};
```

**Role:** Bundle-oriented generation. Use with your library's normal TypeScript/JS compiler and
tree-shaking process. See
[Rollup integration documentation](./docs/INTEGRATIONS.md#rollup-integration).

### Babel

```js
// babel.config.mjs — transform SVG imports through the Babel plugin.
import { svgerBabelPlugin } from 'svger-cli/babel';

export default {
  plugins: [
    [
      svgerBabelPlugin,
      {
        source: './assets/icons',
        output: './src/generated/react',
        framework: 'react',
        transformImports: true,
        processOnInit: true,
      },
    ],
  ],
};
```

**Role:** Source import transformation rather than a standalone JS/TS build pipeline. Add the
appropriate JSX/TypeScript presets for your consuming application. See
[Babel integration documentation](./docs/INTEGRATIONS.md#babel-integration).

### Next.js

```js
// next.config.mjs — add SVGER to Next's Webpack configuration.
import { withSvger } from 'svger-cli/nextjs';

export default withSvger({
  svger: {
    source: './assets/icons',
    output: './src/generated/react',
    framework: 'react',
    typescript: true,
    ssr: true,
  },
});
```

**Role:** Next.js wrapper around Webpack generation and SVG handling, with server/client build
selection. Verify output and import behavior under the actual Next.js version used in your app. See
[Next.js integration documentation](./docs/INTEGRATIONS.md#nextjs-integration).

### Jest

```js
// jest.config.cjs — Jest resolves these documented package subpaths.
module.exports = {
  transform: {
    '\\.svg$': ['svger-cli/jest-transformer', { framework: 'react', mock: true }],
  },
};
```

**Role:** SVG import transformation or lightweight mocks in tests. `mock: true` is intended for
tests that do not need to render the full SVG; test the full transformed component separately when
it matters. Jest provides its own runtime and transformers. See
[Jest integration documentation](./docs/INTEGRATIONS.md#jest-integration).

### Integration mapping

| Integration    | Export path                                           | Intended use                     |
| -------------- | ----------------------------------------------------- | -------------------------------- |
| Webpack plugin | `svger-cli/webpack`                                   | Generation during Webpack builds |
| Webpack loader | `svger-cli/webpack-loader`                            | Transform `.svg` imports         |
| Vite           | `svger-cli/vite`                                      | Vite build and HMR               |
| Rollup         | `svger-cli/rollup`                                    | Library builds                   |
| Babel          | `svger-cli/babel` or `/babel-plugin`                  | Import transformations           |
| Next.js        | `svger-cli/nextjs`                                    | Next Webpack integration         |
| Jest           | `svger-cli/jest`, `/jest-transformer`, `/jest-preset` | SVG test transforms/mocks        |

The full installed-package smoke covers the public entrypoint list, but your target app's toolchain
can impose additional compatibility constraints.

## Library/service API

For programmatic builds, the planned branch exposes the public compiler service. The service selects
a resolved framework/language configuration, plans output files, and commits through the established
application service.

```ts
import { createSVGCompiler } from 'svger-cli';

const compiler = await createSVGCompiler({ cwd: process.cwd() });

const report = await compiler.build({
  src: './assets/icons',
  out: './src/generated/react',
  framework: 'react',
  typescript: true,
});

console.log(report.status, report.diagnostics);
```

**When to use it:** a custom orchestration script or host build integration needs explicit
invocation rather than shell execution. For the opt-in Svelte IR route, add `framework: 'svelte'`
and `svelteCompiler: 'ir-v1'` only when using the planned implementation. Do not import undocumented
internal subpaths such as `svger-cli/utils/visual-diff`: they are not public exports.

For complete types, consult the [generated API reference](./docs/api/index.html) and the main
[`src/index.ts`](./src/index.ts) entrypoint. The README does not imply private compiler modules are
supported public APIs.

## Local benchmark, quality and security evaluation (planned 4.1.0)

**The benchmark runs in the user's Node environment, not in the browser.** It executes trusted local
builds and fixed compatibility/security scripts. The docs-site report viewer does not execute
builds: it reads a JSON report explicitly selected by the user. The evaluator and report viewer do
not upload data automatically.

> **Trust warning:** `--before-build` and `--after-build` load and execute JavaScript from the
> supplied directories **without sandboxing**. Use only trusted local builds. JSON reports are
> **unsigned self-reported evidence**. Passing tests do not establish comprehensive security, full
> semantic equivalence, or universal performance.

### Common evaluation commands

Run these **from the source checkout** after installing development dependencies and building;
`evaluate:local` is not a published npm binary command in the 4.0.9 baseline.

```bash
# Install exactly the lockfile's dependency tree.
npm ci

# Build the checkout before evaluating its generated dist/ artifacts.
npm run build

# Run the opt-in evaluation with default synthetic fixtures and sampling.
npm run evaluate:local

# Save an explicitly requested versioned report as a JSON file.
npm run evaluate:local -- --output ./evaluation-local.json

# Smaller smoke workload; not a representative performance benchmark.
npm run evaluate:local -- --groups 1 --warmups 2 --samples 3 --output ./evaluation-smoke.json

# Compare two *trusted* build roots that each contain package.json and dist/index.js.
npm run evaluate:local -- --before-build ./trusted/before --after-build ./trusted/after --output ./evaluation-compare.json
```

### Evaluator options

| Option                       | Default / bound       | What it does                                                  |
| ---------------------------- | --------------------- | ------------------------------------------------------------- |
| `--groups <n[,n...]>`        | `50,750`; each <=5000 | Controls deterministic SVG fixture size                       |
| `--warmups <n>`              | `8`; max 100          | Excludes initial warm-up calls from measured samples          |
| `--samples <n>`              | `40`; max 500         | Number of timed generation samples per mode/fixture           |
| `--before-build <directory>` | Not set               | Root of first trusted build for comparison                    |
| `--after-build <directory>`  | Not set               | Root of second trusted build; must accompany `--before-build` |
| `--output <file>`            | Standard output       | Writes a JSON report to an explicitly selected local path     |
| `--overwrite`                | Disabled              | Allows replacing an existing report file                      |
| `--help`                     | —                     | Prints help and benchmark limitations                         |

### What the report actually measures

| Category              | Fields or checks                                                      | Interpretation                                                                           |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Performance           | Median, p95, min/max, throughput, output size                         | Host-specific generation timings for the chosen synthetic workload                       |
| Resource observations | RSS before/after and heap delta snapshots                             | **Not** peak memory or leak proof                                                        |
| Reproducibility       | SHA-256 fixture/build/output digests, source SHA, runtime information | Helps correlate comparable runs; does not sign/authenticate reports                      |
| Quality               | Svelte native compiler check, determinism, compatibility suites       | Pass/fail for named tests                                                                |
| Semantics             | Text, namespaces, attributes, references, accessibility, geometry     | `complete`, `partial`, or `failed`; unresolved dimensions are **not** counted as matches |
| Security              | Named non-destructive SVG security regression scripts                 | Pass/fail of these scripts only; **not** a comprehensive security audit                  |

### Report viewer

Open [the documentation report viewer](./docs-site/evaluation.html) (or its
[hosted docs entry](https://faezemohades.github.io/svger-cli/)) and select the exported JSON
locally. The planned viewer expects the `svger-local-evaluation-v2` schema, applies a **5 MiB** size
ceiling, validates nested fields and renders report-derived strings as inert text. No report is
silently submitted or executed.

### Example of verified _local_ performance observations

A recorded Linux x86_64 run on **Node 22.22.2** used eight warmups and 40 samples per compiler mode,
with optimization disabled:

| Fixture                             | Legacy median | IR median | Observation                      |
| ----------------------------------- | ------------: | --------: | -------------------------------- |
| 50 groups / **151 SVG elements**    |      0.643 ms |  3.943 ms | IR slower on this workload       |
| 750 groups / **2,251 SVG elements** |     10.086 ms | 75.562 ms | IR approximately **7.5× slower** |

These are **historical measurements from one local environment**, not installed-package SLAs. The
reported large-fixture semantic coverage was `partial`, while the listed quality and security
regressions passed. Actual performance depends on runtime, hardware, SVG complexity, and competing
system load. See [Evaluation Guide](./docs/EVALUATION.md),
[Performance Results](./docs/performance/PERFORMANCE-RESULTS.md), and
[Workstream Qualification](./docs/phase040-prepublication-review.md).

## Security model and limitations

- **Input admission:** the supported SVG/XML subset is checked before optimization, cache reuse and
  output creation. Default input policy is `reject`. Explicit `strip` mode can change content;
  inspect the result.
- **External resources / active content:** reject-mode scanner denies documented unsafe constructs
  and external-reference patterns. This does not turn arbitrary SVG or CSS into a fully secure
  browser content platform.
- **Bounded processing:** default raw input size, nesting and other scanner limits are meant to
  prevent excessive resource consumption. These are defensive boundaries, not a claim of immunity to
  every denial-of-service input.
- **Artifact writes:** collision planning and transactional output recovery reduce partial-writing
  and overwrite hazards. Preserve output-directory ownership and symlink protections.
- **Plugin/build trust:** local plugins, comparison builds, and integrations execute code. Do not
  treat this project as a sandbox for untrusted JavaScript.
- **Optional rasterization:** the planned mitigation removes `sharp` from automatic optional
  installation; visual rendering requires Node >=20.9.0 and separately installed patched
  `sharp >=0.35.5`. Normal SVG generation retains declared Node >=18.17.0 support.
- **Release hold:** SEC-INC-001 and governance requirements remain outstanding. Neither the README
  nor a successful evaluation authorizes npm publication.

Refer to [SECURITY.md](./SECURITY.md), [Optional Dependencies](./docs/OPTIONAL-DEPENDENCIES.md), and
[Release Readiness](./docs/phase4.5-release-readiness.md).

## Recipes for teams and CI

### Generate locally, check in CI

```bash
# Developer workstation: generate/update repository-owned artifacts.
npx svger-cli build assets/icons src/generated/react --framework react --typescript

# CI: fail if committed generated artifacts do not match source SVGs.
npx svger-cli build assets/icons src/generated/react --framework react --typescript --check --format json
```

**Purpose:** enforce deterministic generated output without CI rewriting the repository. Run
`npm ci` beforehand to make compiler/tool versions reproducible.

### Review changes before overwriting output

```bash
# No output writes: preview proposed output changes.
npx svger-cli build assets/icons src/generated/react --framework react --diff

# Inspect the transaction state if a build is interrupted.
npx svger-cli recover src/generated/react --format pretty
```

**Purpose:** avoid surprising commits and preserve recovery evidence when a filesystem operation
stops unexpectedly.

### Migrate an old configuration safely

```bash
# Dry-run first to review changes.
npx svger-cli migrate config .svgconfig.json --dry-run --format json

# Apply with backup after review.
npx svger-cli migrate config .svgconfig.json
```

**Purpose:** transition config structure explicitly, rather than assuming every historical option
maps directly into the current CLI.

### CI security and release checks (source contributors)

```bash
# Full local release-quality gate; does not authorize publication.
npm run quality:release

# Validate the packed npm artifact and its public entrypoints.
npm run test:package

# Measure the archive against the established file/size ceilings.
npm run package:conformance

# Execute local evaluator contracts and selected security/quality checks.
npm run evaluate:local
```

**Purpose:** exercise the source checkout and the distributable package independently. These scripts
are intended for the **planned 4.1.0 development branch**; inspect `package.json` for the complete
script list and exact definitions in your checkout. A release remains blocked until required
independent CI, maintainer review and security/governance closure.

## Troubleshooting

| Symptom                                               | Likely explanation                                        | Suggested action                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `unknown command init`                                | Initialization is a `config` action                       | Run `svger-cli config --init`                                                     |
| `missing <src> / <out>`                               | `build` requires positional paths                         | Use `svger-cli build assets/icons src/generated/icons`                            |
| `unknown option --framework` on `watch`               | Watch has a narrower option surface                       | Put framework choice in `.svgconfig.json`                                         |
| Angular JS output rejected                            | Angular requires TypeScript                               | Use `--framework angular --typescript`                                            |
| IR Svelte option has no effect in npm-installed 4.0.9 | It belongs to the unpublished development branch          | Use the local planned implementation, not an assumed published feature            |
| IR mode rejects a valid-looking SVG                   | Static IR subset or namespace/reference restrictions      | Inspect diagnostic; use explicit legacy mode if it meets your needs               |
| SVG blocked as unsafe                                 | Active content, external refs or malformed XML            | Remove unsafe constructs; do not disable safeguards casually                      |
| Generated naming differs from examples                | Naming and framework defaults vary                        | Inspect output files / `outputConfig.naming`                                      |
| Cache/output looks stale                              | Different build mode/config or outdated generated files   | Use `--diff`, `--check`, then a controlled rebuild                                |
| Visual comparison unavailable                         | Native optional dependencies missing/incompatible         | Use Node >=20.9 and a patched `sharp` if rasterization is required                |
| Slow IR generation                                    | Additional XML projection, validation and emission stages | Measure locally; retain legacy default unless IR behavior is needed               |
| Evaluation viewer rejects JSON                        | Wrong schema, malformed data, or >5 MiB                   | Regenerate with `evaluate:local`, verify v2 schema and file size                  |
| Evaluator says semantic `partial`                     | Source/artifact oracle cannot establish all dimensions    | Treat dimensions as unresolved; do not reinterpret as full semantic pass          |
| npm/GitHub push or audit fails                        | Credentials/network/proxy issue                           | Use authorized credentials or accessible CI; never paste tokens into issues/chats |

## Contributor commands

These commands concern **building and testing this source repository**, not the public installed
CLI. Script names may evolve across branches. Inspect the active `package.json` (`npm run`) before
executing them, especially when comparing the published 4.0.9 baseline with the planned 4.1.0
branch.

| Command                            | Purpose                                                           | When to use                                                      |
| ---------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm ci`                           | Clean lockfile dependency install                                 | Clean checkout / CI                                              |
| `npm run build`                    | Compile TypeScript and apply approved production build transforms | Before package/evaluator tests                                   |
| `npm run typecheck`                | TypeScript static analysis                                        | Before changes are merged                                        |
| `npm run lint`                     | Run linter                                                        | Code-review gate                                                 |
| `npm run lint:budget`              | Check approved warning budget                                     | Quality accounting                                               |
| `npm run format:check`             | Inspect formatting without writing                                | Quality diagnostics; known legacy baseline differences may exist |
| `npm run test:jest`                | Jest suite                                                        | Unit-level verification                                          |
| `npm run test:frameworks`          | Framework generation verification                                 | Generator changes                                                |
| `npm run test:integrations`        | Build-tool integrations                                           | Integration changes                                              |
| `npm run test:phase0`              | Historical security/compatibility contracts                       | Security work                                                    |
| `npm run test:phase1:smoke`        | Selected application contracts                                    | Runtime-minimum smoke                                            |
| `npm run test:phase4`              | IR and emitter qualification                                      | Svelte IR changes (planned branch)                               |
| `npm run test:package`             | Create and install packed npm artifact for smoke                  | Packaging changes                                                |
| `npm run package:conformance`      | Archive/file budget checks                                        | Before submitting a candidate                                    |
| `npm run quality:full`             | Full engineering quality suite                                    | Local integration                                                |
| `npm run quality:release`          | Release-oriented local quality gate                               | Pre-release evidence, not authorization                          |
| `npm run evaluate:local`           | Opt-in local benchmark + quality/security report                  | Reproducible measurement (planned branch)                        |
| `npm run docs:generate`            | Build generated TypeDoc API reference                             | Public API changes                                               |
| `node scripts/check-docs-site.mjs` | Validate docs-site links/navigation                               | Docs changes (planned branch)                                    |
| `git diff --check`                 | Detect whitespace errors in changed lines                         | Before commits                                                   |

**Publishing safety:** do **not** run scripts such as `release`, `release:minor`, `release:major`,
or `npm publish` during an unresolved No-Go. Some historical `release:*` scripts invoke npm
publication directly. A passing test suite is not sufficient release authorization.

## Categorized documentation directory

The canonical documentation pages are linked below. Paths are repository-relative so they remain
useful in source checkouts and on GitHub. Pages in the unpublished branch may not yet appear on the
hosted documentation website.

| Category                | Document / page                                                                                                                                   | Covers                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Documentation home      | [Hosted site](https://faezemohades.github.io/svger-cli/) · [docs-site index](./docs-site/index.html)                                              | Website entry point and site navigation                                |
| CLI commands            | [Docs-site commands](./docs-site/commands.html) · [Quick Reference](./docs/QUICK-REFERENCE.md)                                                    | Command usage and common flags                                         |
| Frameworks              | [Framework Guide](./docs/FRAMEWORK-GUIDE.md) · [Support Matrix](./docs/SUPPORT-MATRIX.md)                                                         | React, React Native, Vue, Svelte, Angular, Solid, Preact, Lit, Vanilla |
| Integrations            | [Integration Guide](./docs/INTEGRATIONS.md) · [Pipeline Integration](./docs/PIPELINE-INTEGRATION.md)                                              | Webpack, Vite, Rollup, Babel, Next.js, Jest and build pipelines        |
| Evaluation              | [Evaluation Guide](./docs/EVALUATION.md) · [Local report viewer](./docs-site/evaluation.html) · [Schema](./docs-site/evaluation-report-schema.js) | Local benchmarks, JSON schema, security/quality interpretation         |
| Performance             | [Results](./docs/performance/PERFORMANCE-RESULTS.md) · [Real-world benchmark notes](./docs/performance/REAL-WORLD-BENCHMARKS.md)                  | Host-specific historical evidence and test methodology                 |
| Optimization            | [Docs-site optimizer](./docs-site/optimizer.html)                                                                                                 | Optimization guidance and limitations                                  |
| Packages / native tools | [Optional Dependencies](./docs/OPTIONAL-DEPENDENCIES.md)                                                                                          | `sharp`, Node policy, rasterization capability                         |
| API                     | [Generated TypeDoc](./docs/api/index.html) · [Source entrypoint](./src/index.ts)                                                                  | Public types and function reference                                    |
| Migration               | [Migration 4.0.0](./docs/MIGRATION-4.0.0.md) · [Changelog](./CHANGELOG.md)                                                                        | Upgrade implications and history                                       |
| Security                | [Security policy](./SECURITY.md) · [Privacy](./PRIVACY.md)                                                                                        | Vulnerability reporting and trust/security boundaries                  |
| Release                 | [Readiness report](./docs/phase4.5-release-readiness.md) · [Phase 040 workstream review](./docs/phase040-prepublication-review.md)                | No-Go status, candidate/verification scope                             |
| Contributing            | [Contributing](./CONTRIBUTING.md) · [Contributor testing](./tests/README.md)                                                                      | Repository workflows and support                                       |

### Documentation site navigation

- **Start:** [https://faezemohades.github.io/svger-cli/](https://faezemohades.github.io/svger-cli/)
- **Command documentation:** [docs-site/commands.html](./docs-site/commands.html)
- **Evaluation report viewer:** [docs-site/evaluation.html](./docs-site/evaluation.html)
- **Evaluation methodology:** [docs-site/BENCHMARK_TESTING.md](./docs-site/BENCHMARK_TESTING.md)
- **Comparisons and limitations:** [docs-site/COMPARISON.md](./docs-site/COMPARISON.md)

The hosted URL is the repository's documented GitHub Pages location, **not evidence that the
unpublished 4.1.0 site has been deployed**. For the currently prepared features, read the
checked-out files above.

## Release and contribution policy

The approved local work for planned **4.1.0** is separate from the frozen **4.0.9** release
candidate. Maintainers must complete clean-checkout CI, dependency validation, repository
governance, security incident closure and release review before any publication decision. Do not
change the compiler default or bypass authorization checks to make publication succeed.

See [CHANGELOG.md](./CHANGELOG.md) for the planned feature history and
[Release Readiness](./docs/phase4.5-release-readiness.md) for current blockers. For bug reports and
contributions, use the repository's documented
[issues](https://github.com/faezemohades/svger-cli/issues) and
[contribution guidelines](./CONTRIBUTING.md).

---

**License:** MIT · **Source:** [faezemohades/svger-cli](https://github.com/faezemohades/svger-cli) ·
**Documentation:** [GitHub Pages](https://faezemohades.github.io/svger-cli/) · **Release status:**
planned 4.1.0, unpublished / NO-GO.
