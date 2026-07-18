# Phase 2 start report

Date: 2026-07-17

Branch: `phase/2-parser-selection-adr`

Base evidence commit: `20feb57d3084a08043785de52b6db0e0671f0506`

Governance reconciliation commit: `9f5503e85716679e31c4470e15dff1170f4b4918`

## Verdict

```text
PHASE 2 PLANNING: STARTED
P2-201 PARSER-SELECTION ADR: DRAFTED
P2-201 QUALIFICATION PLAN: DRAFTED
P2-201 FORMAL APPROVAL: PENDING
P2-202 THROUGH P2-207 PRODUCTION IMPLEMENTATION: BLOCKED
PHASE 2 MERGE/RELEASE: PROHIBITED
```

The governing directive authorizes Phase 0 execution and requires later phases to follow their
defined gates. Phase 0 publication is still absent, Phase 1 remote validation is pending, and all
twelve Compatibility Ledger decisions are deferred. Starting parser integration would therefore
depend on incomplete foundations and violate Gate Law.

Phase 2 has been started at the first independently permitted deliverable: P2-201 architecture
research and ADR drafting. The ADR provisionally selects `@xml-tools/parser@1.0.11` as a CST/token
boundary, requires a project-owned immutable `ParsedXMLAST`, rejects the companion recovery-oriented
AST, and defines binding DTD/entity, determinism, security-corpus, license, support-matrix, and
approval gates.

The governance reconciliation has now been accepted as correct and compliant. That acceptance closes
local corrective-action review items, but it does not close Phase 0 publication, Phase 1 remote
acceptance, or Phase 2 parser approval. Phase 2 therefore remains limited to ADR research and
qualification design.

## Phase 2 output

- `docs/ADR-P2-201-XML-PARSER-SELECTION.md`
- `docs/P2-201-PARSER-QUALIFICATION-PLAN.md`
- `reports/phase2-parser-qualification-plan.json`

## Repository impact

- No production source changed.
- No dependency or lockfile changed.
- No parser package was installed into the repository.
- No P2-202 model or parser integration code was created.
- `main`, the Phase 1 branch, and their commits remain unchanged.
- The work is isolated on `phase/2-parser-selection-adr`.
- The qualification plan records registry metadata and approval requirements only.

## Required next authorization

1. Close the Phase 0 publication and approval gates.
2. Pass and approve the Phase 1 remote matrix, traceability, package review, and Compatibility Ledger.
3. Review the P2-201 parser choice through compiler, security, licensing, support, and release owners.
4. Run the isolated parser qualification corpus described by the ADR.
5. Mark the ADR `Accepted` with named approvers before P2-202 production implementation begins.
