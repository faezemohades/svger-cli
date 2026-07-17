# v4.0.9 package conformance

The complete `npm pack --dry-run` result and `tar -tf` entry list are archived in
`reports/package-conformance-v4.0.9.json`.

| Measure       | Approved baseline |  Current result |         Unapproved-growth ceiling |
| ------------- | ----------------: | --------------: | --------------------------------: |
| Entries       |               757 |             757 |           794 (+5%, rounded down) |
| Packed size   |     616,991 bytes |   616,991 bytes | 647,840 bytes (+5%, rounded down) |
| Unpacked size |     Informational | 1,971,238 bytes |                     Informational |

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
