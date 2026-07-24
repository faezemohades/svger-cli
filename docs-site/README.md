# SVGER-CLI Documentation Site

This directory contains the static documentation website deployed to GitHub Pages:

```text
https://faezemohades.github.io/svger-cli/
```

The site is deployed from `docs-site/` by `.github/workflows/deploy-docs.yml`.

## Current Status

The landing page has been reviewed for the v4.0.9 source implementation and now documents:

- current release and governance status;
- the real CLI command surface and complete command reference;
- live runtime evidence for documented commands;
- framework targets;
- build tool and Jest integrations;
- optimizer usage;
- package contents;
- input safety and output containment;
- configuration and public API surfaces;
- support matrix and documentation coverage map.

## Local Preview

The site is static HTML/CSS and can be opened directly in a browser:

```text
docs-site/index.html
docs-site/commands.html
```

Or served locally:

```bash
cd docs-site
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Maintenance Contract

When implementation changes, update `docs-site/index.html`, `docs-site/commands.html`, and the
evidence reports in the same reviewed change if any of these surfaces move:

- package version or npm publication status;
- CLI command names, arguments, options, or exit semantics;
- framework target list;
- build-tool integration export paths;
- security defaults such as `unsafeInputPolicy` or `maxInputSizeBytes`;
- optimizer runtime behavior or benchmark claims;
- runtime validation commands or pass counts;
- support matrix;
- package conformance numbers;
- governance gate status.

## Evidence

The latest review is recorded in:

```text
reports/docs-site-review-2026-07-24.md
reports/docs-site-review-2026-07-24.json
reports/docs-site-live-evidence-2026-07-24.md
reports/docs-site-live-evidence-2026-07-24.json
```

## Companion Pages

- `optimizer.html` documents the SVG optimizer in more depth.
- `commands.html` documents every CLI command, runtime recipes, live test evidence, known
  limitations, framework output evidence, and integration export evidence.
- `benchmark-demo.html` is an interactive browser benchmark/simulator.
- `COMPARISON.md` is the current comparison and claim-governance note.
- `BENCHMARK_TESTING.md` documents how the browser benchmark should be interpreted.

## Notes

Do not reintroduce obsolete `convert` or `batch` command examples. Current equivalents are:

```bash
svger generate ./icon.svg ./components
svger build ./icons ./components
```
