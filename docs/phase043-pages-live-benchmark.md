# Directive 043 — GitHub Pages and live comparison implementation

Status: implementation and focused local qualification recorded on
`feat/directive-043-pages-benchmark`; not committed, pushed, deployed, or approved for npm
publication. Engineering Review 073 authorized qualification only, not Pages deployment. The release
authorization guard and governance policy were not changed.

## Documentation site

`tools/site-docs/build.py` generates a static 23-page documentation catalog covering installation,
getting started, all nine framework targets, CLI commands, configuration, API, integrations,
plugins, optimization, migration, security, troubleshooting, and benchmark methodology. Generated
pages include descriptive titles, page-specific descriptions, canonical URLs, Open Graph metadata,
TechArticle structured data, crawlable links, `sitemap.xml`, and `robots.txt`. Local search indexes
only the documentation text. The site does not load remote executable scripts.

Build and validate locally with:

```sh
python3 tools/site-docs/build.py
node scripts/check-docs-site.mjs
node tools/site-docs/check.mjs
node --test tools/site-benchmark/test.mjs
```

`.github/workflows/pages.yml` is a read-only qualification workflow: it builds and validates the
site, runs benchmark and package contracts, and checks the package archive on pull requests and
`main`. It has no Pages deployment job or Pages write permission. Repository Pages settings,
maintainer approval, remote CI, a real browser run, and deployed-content verification remain pending.

## User-started local comparison

The benchmark page offers 50, 100, and 170 fixtures and compares actual in-memory React JavaScript
transforms from the built SVGER processor and version-pinned SVGR core/JSX packages. A localhost-only
companion starts only by explicit command, accepts only fixed fixture counts from approved origins,
and creates one child process per implementation. It reports wall time, process CPU time and CPU
core-equivalent, sampled peak RSS, output bytes, success/failure counts, runtime/package versions,
and fixture and output hashes. CPU is measured for the worker process, not the whole system; RSS is
sampled every 10 ms and may miss peaks. It does not execute from GitHub Pages, accept user-uploaded
SVGs, or upload results. Failed transforms are reported, and the UI withholds a wall-time winner if
either implementation fails any input.

This is a developer convenience, not a sandbox, certification, security-equivalence test, or
controlled performance lab. Results are host-specific; package import/startup and disk writes are
excluded from timing, and RSS sampling may miss short peaks. Do not make universal performance
claims from an individual run.

## npm corpus exclusion

The SVG fixtures remain in `assets/svges/` in source control for tests and local comparisons. The
root package allowlist excludes `assets/svges/**`; package smoke and archive-conformance contracts
expect zero packed corpus files. The public package entrypoint/export contract is unchanged.

## Engineering Review 073 — focused qualification (043-B)

Local qualification ran on Linux x86_64 with Node.js 22.23.3 and npm 10.9.9. The official Node
distribution checksum was verified before using the temporary runtime; it was not installed into
the system. The benchmark companion was installed from its lockfile using `npm ci --ignore-scripts`.

- `tools/site-benchmark/qualify.mjs` ran both actual worker subprocesses twice at 50, 100, and 170
  fixtures. SVGER 4.1.0 and SVGR 8.1.0 each transformed all fixtures successfully in every run;
  success/failure counts, runtime versions, fixture hashes, and output hashes were deterministic.
- Local HTTP integration checks passed for allowed/rejected origins, localhost host restriction,
  private-network preflight, request schema/count/content-type/size limits, single-job concurrency,
  cancellation and child termination, plus service recovery. This is Node HTTP integration evidence,
  not a browser test or OS-level sandbox certification.
- `npm run docs:check` passed: 23 generated indexable pages, 27 HTML pages checked, SEO/sitemap/
  structured-data checks passed, and all three benchmark contract tests passed.
- `npm run test:package` passed. An actual generated npm tarball and a separate archive-conformance
  report both contained 148 files and 247,093 compressed bytes; neither contained any
  `assets/svges/` entries. The established package budgets were not raised. The public v4.0.9
  package contract check also passed.

Fixture SHA-256 values: 50 = `d1eb936d32a607eba2cc665aef2479338cdb183197c8c34b1d6cbaa6fe79ade2`;
100 = `8278f1b8dd68cc85f7f4f94e97ba2586b8258c666673abb37cda288d3a9a5f80`; 170 =
`67f1f80ee883234313e3192f2cbad3236475747526147fd1adbc834468978247`.

This is local working-tree evidence, not a clean-checkout or remote CI result. The site has not been
opened in a real browser or deployed to GitHub Pages. The qualification workflow intentionally does
not deploy. Those gates require a later authorized maintainer decision. SEC-INC-001 remains OPEN;
GOV-001/GOV-002, remote CI, dependency verification, maintainer approval, and release authorization
remain separate and unresolved. No npm publication or remote repository action was performed.

## Engineering Review 074 — Directive 043-C progress

Review 074 accepted the 043-B evidence locally and authorized real-browser and clean-checkout
qualification, while explicitly withholding Pages deployment and making remote push/PR/CI work
conditional on authorized maintainer approval.

The browser stage is not complete in this environment. No Chromium or Firefox executable was
available. Playwright was installed only in the temporary qualification directory, but its browser
installer did not complete the Chromium download; the installer was stopped after the download made
no further progress. No browser interaction, report-download verification, or browser
localhost-access result is claimed. In particular, the existing Node HTTP Origin/preflight tests do
not establish browser CORS or Local Network Access behavior.

The generated docs and local package checks from 043-B remain evidence for their stated local scope;
they are not clean-checkout CI. No remote Git operation, deployment, or publication was performed.
Directive 043-C remains OPEN pending real Chromium and Firefox runs, an exact-commit clean-checkout
qualification, maintainer review of the Pages artifact/configuration, and any owner approval needed
before remote CI. SEC-INC-001 remains OPEN and npm publication remains NO-GO.
