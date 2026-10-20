# CLI Command Reference

The binary names are `svger` and `svger-cli`. The examples below use `npx svger`; invoke the
installed binary directly in scripts. Check `svger --help`, `svger <command> --help`, and
`svger --version` against the installed package because this source branch describes planned,
unreleased 4.1.0 behavior.

## Global commands

```sh
svger --help
svger --version
```

The CLI reports failures with a nonzero exit status. `build` supports `--format pretty|json|ndjson`
for reports; `recover` and `migrate` support `pretty|json`. Other commands print their own output.

## Generate components

### `build <src> <out>`

Generate components for matching SVG files in a directory. Discovery is non-recursive by default.

```sh
svger build ./icons ./src/components/icons --framework react --typescript
svger build ./assets ./src/icons --framework vue --no-typescript --composition --recursive
svger build ./icons ./generated --framework angular --standalone --signals
svger build ./icons ./generated --framework react --dry-run --format json
```

| Option | Meaning |
| --- | --- |
| `--framework <type>` | `react`, `react-native`, `vue`, `svelte`, `angular`, `solid`, `preact`, `lit`, or `vanilla`. |
| `--typescript` / `--no-typescript` | Select TS or JS where supported. TypeScript is the default; Angular does not support JS output. |
| `--composition` | Use Vue `<script setup>` mode. |
| `--standalone` | Request an Angular standalone component. |
| `--signals` | Set the build command's signals option for the applicable Angular/Solid generator. |
| `--optimize <level>` | `none`, `basic`, `balanced`, `aggressive`, or `maximum`; default `basic`. |
| `--validate` | Run optional visual comparison after build; requires compatible optional dependencies. |
| `--plugin <names>` | Load plugin name(s) or path(s), comma-separated. |
| `--list-plugins` | List registered plugins and exit. |
| `--unsafe-input-policy <policy>` | `reject` (default) or `strip` selected blocked constructs with a warning. `strip` is not a complete sanitizer. |
| `--max-input-size <bytes>` | Override the maximum input SVG size. Must be a positive integer. |
| `--format <type>` | Report format: `pretty` (default), `json`, or `ndjson`. |
| `--recursive` | Include nested directories. |
| `--include <globs>` / `--exclude <globs>` | Comma-separated glob filters applied to normalized relative paths. |
| `--hidden` | Include dot-prefixed files/directories. |
| `--symlinks <policy>` | `ignore` (default), `follow`, or `error`. |
| `--max-file-count <count>` | Stop if discovery exceeds this positive file count; default 10,000. |
| `--collision <policy>` | `error` (default), `first`, or `last` for normalized output-name collisions. Prefer `error` and resolve collisions at source. |
| `--concurrency <count>` | Positive maximum concurrent build jobs. |
| `--batch-size <count>` | Positive maximum scheduler batch size. |
| `--dry-run` | Generate/plan without filesystem changes. |
| `--check` | Check whether generated output is stale and return failure when updates are required. |
| `--diff` | Report output differences without writing. |
| `--src <path>` / `--out <path>` | Deprecated aliases for positional paths. |
| `--naming <type>` | Deprecated v4 naming option; use `outputConfig.naming` in configuration. |

`--dry-run`, `--check`, and `--diff` are mutually exclusive. Output names are derived from input
names, selected naming policy, and framework/language artifact contract. Build output is transactional:
a failed generation batch does not partially replace the output set.

### `generate <svgFile> <out>`

Generate a component from one SVG file. It supports `--framework`, `--typescript`/`--no-typescript`,
`--composition`, `--standalone`, `--optimize`, `--unsafe-input-policy`, and `--max-input-size`.
`--signals` is not registered for this command.

```sh
svger generate ./icons/search.svg ./src/components --framework react
svger generate ./icons/logo.svg ./src/components --framework svelte --no-typescript
```

### `watch <src> <out>`

Watch a source directory and rebuild when SVG files change. Stop the process with Ctrl-C.

```sh
svger watch ./icons ./src/components/icons
```

Registered options: `--unsafe-input-policy <reject|strip>` and `--max-input-size <bytes>`. The
deprecated `--src` / `--out` aliases and `--watch` compatibility flag are accepted with warnings;
prefer positional paths and the `watch` subcommand. Framework and language settings come from the
project configuration; this command does not expose the build command's framework flags directly.

## SVG optimization

### `optimize <input> [output]`

Optimize SVG without creating a framework component. If output is omitted, the input path is used;
`--in-place` makes overwrite intent explicit.

```sh
svger optimize ./icon.svg ./optimized/icon.svg --level balanced
svger optimize ./icon.svg --in-place --level aggressive
```

Options: `--level <basic|balanced|aggressive|maximum>` (default `balanced`), `--validate`,
`--in-place`, `--unsafe-input-policy <reject|strip>`, and `--max-input-size <bytes>`. Optimization
can alter source and does not prove semantic or visual equivalence. Keep the original under version
control. `--validate` requires the optional rasterization packages and Node.js `>=20.9.0`; see
[Optional Dependencies](OPTIONAL-DEPENDENCIES.md).

## Configuration

### `config`

Configuration is read from `.svgconfig.json` in the current working directory. Create, inspect, and
edit it with:

```sh
svger config --init
svger config --show
svger config --set framework=svelte
svger config --set typescript=false
svger config --set outputConfig.naming=pascal
svger config --explain framework --format json
```

Use one of `--init`, `--show`, or `--set <key=value>`. `--set` parses `true`/`false` and numeric
values; other right-hand values are strings. Dot-separated keys address nested values. The
`--explain [path]` mode shows each resolved value's origin; `--format` is `pretty` or `json` for
that mode. See [Configuration and Optimization](QUICK-REFERENCE.md) for precedence and examples.

## Plugins and file locks

```sh
svger plugins
svger plugins --load ./plugins/my-plugin.js
svger build ./icons ./generated --plugin optimize,minify
svger lock ./icons/logo.svg ./icons/brand.svg
svger unlock ./icons/logo.svg ./icons/brand.svg
```

`plugins --load` loads comma-separated plugin names/paths. `build --plugin` loads plugins for the
build invocation; `build --list-plugins` lists registered plugins. `lock` and `unlock` manage the
project's source lock list and accept one or more file paths. Only load plugins you trust: plugin
code executes in the current process with the permissions of the invoking user. See the
[plugin development guide](PLUGIN-DEVELOPMENT-GUIDE.md).

## Output maintenance and recovery

### `clean <out>`

Remove generated component outputs from the specified directory:

```sh
svger clean ./src/components/icons
```

This removes files and is not a preview operation. Verify the exact output directory and preserve
any unrelated files before running it. Deprecated `--out <path>` is accepted; use the positional
argument.

### `recover <directory>`

Inspect transaction journals and recover interrupted output transactions under the supplied
directory:

```sh
svger recover ./src/components/icons --format json
```

Supported formats: `pretty` (default) or `json`. Recovery is restricted to the caller-selected
transaction parent and relies on the documented protected-directory trust boundary; it is not an
authentication boundary against another process running as the same user. See
[Recovery Security](phase0-recovery-security.md).

## Migrations

### `migrate <target> [path]`

Supported targets are `config`, `plugins`, and `imports`. `config`/`plugins` operate on one JSON
configuration file (default `.svgconfig.json`). `imports` scans the supplied path (default current
directory) for supported import declarations.

```sh
svger migrate config .svgconfig.json --dry-run
svger migrate plugins .svgconfig.json
svger migrate imports ./src --dry-run --format json
```

Options: `--dry-run` previews changes; `--no-backup` disables the default backup; `--format
pretty|json` selects the report format. Review a dry-run and keep a version-control checkpoint before
applying migrations.

## Exit behavior and troubleshooting

Commands return nonzero on usage, configuration, input, generation, validation, or filesystem
failure. Build reports expose stable diagnostic codes; use `--format json`/`ndjson` where available
to consume them in scripts. Check paths and framework names first, then inspect the diagnostic code.
Do not switch to `strip` simply to suppress an input-security rejection. For stale output, use
`build --check` or `build --diff` before writing; for interrupted writes, use `recover` on the
specific output transaction parent.

The command surface can change between package releases. This guide tracks the source branch; the
installed command's `--help` is authoritative for its own version.
