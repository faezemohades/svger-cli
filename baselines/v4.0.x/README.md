# SVGER v4.0.x Behavioral Baseline

This directory is the immutable behavioral reference captured from the v4.0.8
source tree before Phase 0 containment changes. It is used to distinguish
security fixes from accidental compatibility regressions.

- `fixtures/` contains the canonical input corpus.
- `outputs/` records byte-for-byte output from the legacy builder and
  `SVGService` paths.
- `cli-behavior.json` records command help and exit behavior.
- `public-api.json` records root and integration export symbols.
- `resolved-config.json` and `config-schema.json` capture configuration shape.
- `performance-trace.json` records the standard-corpus timing sample.
- `baseline.lock.json` contains SHA-256 hashes for every other baseline file.

Run `npm run baseline:verify` to verify immutability. Do not regenerate or edit
this directory after `baseline.lock.json` has been created; add a new versioned
baseline instead.
