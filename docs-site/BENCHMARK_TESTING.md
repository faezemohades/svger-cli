# Browser Benchmark Testing Notes

Date reviewed: 2026-07-24

## Scope

`benchmark-demo.html` is an interactive documentation aid. It helps users understand SVG processing
flow, rough browser-side timing, custom SVG upload behavior, and result export shape.

It is not a release gate and must not be treated as registry, CI, or package conformance evidence.

## Correct Interpretation

The browser benchmark may be used for:

- local browser experimentation;
- comparing relative behavior across uploaded files;
- demonstrating that SVG files stay local to the browser;
- exporting informal JSON results for discussion.

It must not be used for:

- claiming official throughput;
- proving cross-platform Node.js performance;
- replacing `npm run validate:phase0` or `npm run validate:phase1`;
- approving package publication;
- approving Phase 2 parser integration.

## Release-Grade Performance Evidence

Release-grade performance evidence must include:

- source commit;
- package version;
- Node.js version;
- operating system;
- dataset identity and hash;
- command used;
- warm/cold run policy;
- p95 latency and peak RSS where relevant;
- raw result artifact.

## Current Documentation Position

The main GitHub Pages landing page links to the benchmark as a demo, not as authoritative proof.
Current release and package claims are tied to repository evidence under `reports/`.

`commands.html` includes the current live runtime and optimizer benchmark summary. Claims there are
limited to the exact local evidence recorded in:

```text
reports/docs-site-live-evidence-2026-07-24.md
reports/docs-site-live-evidence-2026-07-24.json
```

The repository benchmark command used for that evidence was:

```bash
node scripts/benchmark-comprehensive.js
```

The visual-diff column from that script must not be treated as authoritative proof because the
script falls back to zero when optional visual comparison cannot run.

## Manual Smoke

Open:

```text
docs-site/benchmark-demo.html
```

Run:

1. sample SVG benchmark;
2. custom SVG upload;
3. JSON export.

Confirm:

- no file leaves the browser;
- progress and results render;
- export produces a JSON file;
- no console error blocks normal use.
