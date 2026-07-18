# Phase 2 Parser Supply-Chain Evidence

Date: 2026-07-18

Status: Initial extracted evidence - not approval

Branch: `phase/2-parser-selection-adr`

## Verdict

```text
PARSER TARBALL INSPECTION: COMPLETED IN DISPOSABLE WORKSPACE
PACKAGE.JSON CHANGE: NONE
LOCKFILE CHANGE: NONE
INSTALL-SCRIPT INVENTORY: NONE FOUND
LICENSE FILE EXTRACTION: PRESENT
SBOM/LEGAL APPROVAL: PENDING
P2-202 IMPLEMENTATION: BLOCKED
```

This evidence responds to the Phase 2 qualification-plan assessment. It strengthens the registry
metadata with downloaded tarball SHA-256 values, extracted package manifests, extracted license
files, dependency graph facts, and install-script inventory. The inspection was performed outside
the repository and did not install a parser into SVGER-CLI.

## Method

```text
env -u NODE_TLS_REJECT_UNAUTHORIZED npm pack <package>@<version> --json
tar -xzf <downloaded-tarball>
sha256(<downloaded-tarball>)
read package/package.json
find license/notice files
inspect lifecycle install scripts
count published files
```

## Selected Parser Graph

| Package | Version | Registry shasum | Tarball SHA-256 | License | License file | Files | Packed bytes | Unpacked bytes | Install scripts |
| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| `@xml-tools/parser` | 1.0.11 | `a118a14099ea5c3c537e4781fad2fc195b57f8ff` | `ff9d96ab22f7ca0b5f11d4a2b4b6ad65ee62c73e186d1b13021a475e6e12afd5` | Apache-2.0 | `LICENSE` | 9 | 13,127 | 39,038 | None |
| `chevrotain` | 7.1.1 | `5122814eafd1585a9601f9180a7be9c42d5699c6` | `9cbea943f1aef15a1054d3e3d8f0cfb3736720ae77a926df9a83207f6bf522af` | Apache-2.0 | `LICENSE.txt` | 240 | 387,384 | 2,229,343 | None |
| `regexp-to-ast` | 0.5.0 | `56c73856bee5e1fef7f73a00f1473452ab712a24` | `19a7f98b1610fb450eb0f584374ecae2d200f84c102f1ea6860c249b2c910c08` | MIT | `LICENSE` | 6 | 9,035 | 42,518 | None |

Dependency graph:

```text
@xml-tools/parser@1.0.11
  -> chevrotain@7.1.1
       -> regexp-to-ast@0.5.0
```

## Registry Tarball URLs

| Package | Tarball |
| --- | --- |
| `@xml-tools/parser@1.0.11` | `https://registry.npmjs.org/@xml-tools/parser/-/parser-1.0.11.tgz` |
| `chevrotain@7.1.1` | `https://registry.npmjs.org/chevrotain/-/chevrotain-7.1.1.tgz` |
| `regexp-to-ast@0.5.0` | `https://registry.npmjs.org/regexp-to-ast/-/regexp-to-ast-0.5.0.tgz` |

## Manifest Findings

| Package | Manifest repository | Lifecycle install scripts | Production dependencies |
| --- | --- | --- | --- |
| `@xml-tools/parser@1.0.11` | `https://github.com/sap/xml-tools/` | None | `chevrotain@7.1.1` |
| `chevrotain@7.1.1` | `git://github.com/SAP/chevrotain.git` | None | `regexp-to-ast@0.5.0` |
| `regexp-to-ast@0.5.0` | `https://github.com/bd82/regexp-to-ast.git` | None | None |

## Published-File Inventory Summary

The extracted file inventories are intentionally summarized here to keep this evidence readable.
The final qualification PR must attach the complete path inventory and its hash.

| Package | File count | Notable content |
| --- | ---: | --- |
| `@xml-tools/parser@1.0.11` | 9 | `lib/api.js`, `lib/lexer.js`, `lib/parser.js`, `api.d.ts`, `LICENSE`, `LICENSES/Apache-2.0.txt` |
| `chevrotain@7.1.1` | 240 | CommonJS build, ESM build, TypeScript source, source maps, diagrams assets, `LICENSE.txt` |
| `regexp-to-ast@0.5.0` | 6 | `lib/regexp-to-ast.js`, `api.d.ts`, `LICENSE`, `README.md`, `CHANGELOG.md` |

## Open Approval Work

The following evidence is still required before supply-chain approval:

- Complete published-file inventory with a stable hash.
- Repository/source correspondence for each tarball.
- License text reconciliation against the registry, tarball, and repository.
- SBOM delta against the current release candidate.
- Vulnerability audit on the exact lockfile graph after dependency adoption is separately approved.
- Release/package conformance impact, including packed file and byte deltas.

Therefore this report is not a license, SBOM, or release approval. It is only an initial extracted
evidence packet for P2-201 review.
