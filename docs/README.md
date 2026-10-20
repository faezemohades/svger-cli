# SVGER-CLI Documentation

This index organizes usage documentation for the checked-out source. Version 4.1.0 is planned and
unpublished; installed package behavior should be checked against that release's own help output and
declarations. The [hosted documentation site](https://faezemohades.github.io/svger-cli/) provides a
short overview, command page, compiler-mode notes, and local-evaluation guide.

## Start here

- [Root README](../README.md) — installation status, quick start, framework examples, common
  workflows, security notes, and development commands.
- [CLI reference](CLI-REFERENCE.md) — all commands and flags, including defaults, output modes,
  destructive-action cautions, and deprecated aliases.
- [Framework generation guide](FRAMEWORK-GUIDE.md) — output formats, language modes, examples, and
  framework-specific caveats.
- [Support matrix](SUPPORT-MATRIX.md) — runtime, operating system, compiler, framework, and
  integration support scope.

## User guides

| Topic | Guide | Covers |
| --- | --- | --- |
| Configuration | [Configuration and optimization](QUICK-REFERENCE.md) | `.svgconfig.json`, precedence, configuration CLI, optimization levels, output planning. |
| Build-tool integration | [Integrations](INTEGRATIONS.md) | Webpack, Vite, Rollup, Babel, Next.js, and Jest setup. |
| Plugins | [Plugin development](PLUGIN-DEVELOPMENT-GUIDE.md) | Plugin hooks, registration, testing, and current limitations. |
| Optional rasterization | [Optional dependencies](OPTIONAL-DEPENDENCIES.md) | `--validate`, Node/sharp requirements, installation and failure behavior. |
| Local evaluation | [Evaluation guide](EVALUATION.md) | Opt-in local benchmarks, reports, methodology, and security limitations. |
| Pipeline integration | [Pipeline integration](PIPELINE-INTEGRATION.md) | Historical optimizer-pipeline context; verify claims against current optimizer documentation. |
| Migration | [v4 migration guide](MIGRATION-4.0.0.md) | Existing configuration/import migration guidance. |

## Security and compatibility

- [SVG input security policy](phase0-svg-input-security.md) — input admission and unsafe-input
  policy.
- [SVG semantic preservation notes](phase0-svg-semantic-preservation.md) — transformations and
  preservation boundaries.
- [Error handling standard](ERROR-HANDLING-STANDARD.md) — diagnostic/error conventions; some
  sections are historical engineering guidance.
- [Release readiness](phase4.5-release-readiness.md) — current release gate status. It is not a
  publication authorization.
- [Security policy](../SECURITY.md) and [privacy policy](../PRIVACY.md).

## Engineering records

Phase reports, architecture decisions, qualification records, and retired historical material are
maintained as engineering evidence. They are not all end-user instructions or promises of current
support. See [architecture decisions](ADR-P2-201-XML-PARSER-SELECTION.md),
[the phase records](.) and [the historical archive](archive/).

## Documentation maintenance

When changing a CLI command, framework, configuration key, security rule, or support claim, update
the relevant guide and its tests/checks in the same reviewed change. Keep the README concise enough
to serve as the entry point; put exhaustive option and policy details in the linked reference pages.
