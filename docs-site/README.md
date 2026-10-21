# SVGER-CLI documentation site

This folder is a static, crawlable documentation website intended for GitHub Pages. Generate its
23 indexable HTML pages, search index, sitemap, robots file, redirects, and 404 page with:

```sh
python3 tools/site-docs/build.py
npm run docs:check
```

The content covers installation, all nine output targets, commands, configuration, public API,
plugins, integrations, optimization boundaries, migration, security, troubleshooting, and
benchmark methodology. Pages are generated from `tools/site-docs/build.py`; edit that source and
regenerate rather than hand-editing generated framework pages.

## Live comparison

GitHub Pages is static and cannot execute local Node packages or measure local process CPU/RAM.
The benchmark UI therefore requires an explicitly started local companion. From the repository root,
build the package, install the benchmark-only pinned SVGR dependencies, then run
`npm run benchmark:site`. The browser sends only a selected count (50, 100, or 170) to a companion
bound to `127.0.0.1`; it receives measured results and does not upload them. The companion is a
developer utility, not an OS sandbox or a hosted public execution service. Do not run it from an
untrusted checkout.

The companion rejects requests without an approved `Origin`, rejects unexpected `Host` values,
accepts only bounded JSON fixture-count requests, limits each worker to three minutes, kills a worker
when the browser request is interrupted, and allows only one active comparison. The public Pages
origin is specifically allowlisted; this is still not protection against a compromised trusted site
or local malicious process. Use the benchmark page's Run button for readiness checks; direct browser
navigation to `/health` has no `Origin` and is intentionally denied.

Comparison results are host-specific. They report real transformations from the checked-in source
corpus, wall/CPU time, sampled peak RSS, success counts, output bytes, versions, and fixture digest.
No result is precomputed and no implementation is presented as the guaranteed winner.

The package release remains subject to its separate authorization and governance gates. The sample
corpus is retained in the source repository and must remain excluded from npm tarballs. The
historical 4.0.9 public package contract is not rewritten by site generation. The current workflow
qualifies static content, benchmark workers, and package artifacts only; it does not deploy Pages.
Deployment remains pending the separately authorized maintainer decision and browser qualification.
