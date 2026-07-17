# Phase 1 package footprint review

Status: **local gate passed; formal package review pending**

| Measure | Phase 0 baseline | Initial Phase 1 | Candidate | Unchanged ceiling | Headroom |
| --- | ---: | ---: | ---: | ---: | ---: |
| Files | 757 | 793 | 753 | 794 | 41 (5.16%) |
| Packed bytes | 616,992 | 645,631 | 613,130 | 647,841 | 34,711 (5.36%) |

The correction does not redefine either approved ceiling. It excludes thirty internal declarations
that are unreachable from the package's public declaration graph and ten development/governance
documents that are available in the repository but not required by installed consumers. It keeps
all runtime JavaScript, all 606 intentional sample assets, both public binaries, all public and
transitively referenced declarations, framework integration entry points, usage examples, and eight
curated operational documents.

The package smoke installs the tarball in a separate consumer, compiles imports from the root and
every public integration subpath, verifies compatibility aliases point to the same physical files,
executes the CLI, imports the ESM API, and performs a real component build. Exact composition and
candidate identity are recorded in `reports/phase1-package-footprint-review.json`.
