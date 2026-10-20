# SVGER-CLI documentation site

This is the static GitHub Pages site deployed from `docs-site/`. It documents the planned,
unpublished 4.1.0 worktree; release status remains NO-GO. Historical review files in `reports/`
retain the claims and measurements made at their original dates and are not current-release
evidence.

The site pages are `index.html`, `commands.html`, `optimizer.html`, and `evaluation.html`. The
former browser benchmark simulator is retired; `benchmark-demo.html` now points to measured local
evaluation instructions, and the obsolete simulator script has been removed.

The API reference under `docs/api/` is generated separately by TypeDoc (`npm run docs:generate`).
The Pages workflow serves `docs-site/`, so the API reference is not currently part of the deployed
site.

Preview locally by opening `index.html` or serving this directory with a static file server. The
report viewer reads a user-selected JSON file locally, with no upload, telemetry, remote scripts, or
benchmark on page load.

Run `npm run docs:check` to validate local HTML links and anchors without network access. Update
navigation and the status/version labels alongside source documentation when CLI behavior, package
version, security policy, or measured evidence changes. The 4.0.9 public package contract file is a
historical compatibility baseline; it is intentionally not renamed or rewritten for the planned
version.
