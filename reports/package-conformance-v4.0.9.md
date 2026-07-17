# v4.0.9 package conformance

Candidate source commit: `5698731cfcdaa50d4bc04e3d3665d16ba2b40bf4`

Reproduced tarball SHA-256: `adc50aefaccc15bc09bf6daa1c37d4446ced69fe754bc3663e0841063171a02b`

The complete `npm pack --dry-run` result and `tar -tf` entry list are archived in
`reports/package-conformance-v4.0.9.json`.

| Measure       | Approved baseline |  Current result |         Unapproved-growth ceiling |
| ------------- | ----------------: | --------------: | --------------------------------: |
| Entries       |               757 |             757 |           794 (+5%, rounded down) |
| Packed size   |     616,992 bytes |   616,992 bytes | 647,841 bytes (+5%, rounded down) |
| Unpacked size |     Informational | 1,971,255 bytes |                     Informational |

## Composition

| Group                                   | Entries | Decision                                                                   |
| --------------------------------------- | ------: | -------------------------------------------------------------------------- |
| `assets/`                               |     606 | Intentional: documented public corpus used by `test-svger` and benchmarks. |
| `dist/`                                 |     120 | Runtime JavaScript and declarations; compiled test fixtures are excluded.  |
| `docs/`                                 |      17 | Curated user-facing offline documentation.                                 |
| `examples/`                             |       6 | Published usage examples.                                                  |
| `bin/`                                  |       2 | Public CLI executables.                                                    |
| Package metadata and root documentation |       6 | Required package and policy files.                                         |

The generated conformance check confirms that baselines, compatibility reports, coverage, `.github`,
internal reports, source maps, the source tree, tests/fixtures, generated API media, archived
internal documentation, and temporary output are absent. The package smoke test enforces the same
exclusions, the exact 606-asset reviewed baseline, and both package budgets. Any increase above 5%
requires explicit review and a newly recorded approved baseline; an asset-count change fails even
when total size remains under budget.
