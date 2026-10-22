# Windows Transaction Lifecycle Assessment

**Directive:** 046-D.2G

**Status:** Investigation only; no implementation authorized

**Evidence scope:** Static inspection of the current transaction/recovery paths and the Windows Node 22/24 qualification failures recorded for commit `40e7094967fc9022e676ef7bef7fb24b47d9bc71`.

## Findings

### 1. Can Windows generation safely continue while recovery is unavailable?

Not with the current end-to-end recovery guarantee. Normal generation can
complete, and caught pre-commit failures attempt in-process rollback. If that
rollback and cleanup finish, the journal and stage are removed. But process or
host termination can occur after staging, journal persistence, an output/backup
rename, or during rollback. Incomplete rollback retains its journal and stage;
failure after the committed journal is persisted can leave committed outputs
with cleanup evidence still present. On Windows, the tested recovery path
rejects the journal under the POSIX mode-bit check; the proposed explicit
unsupported-platform behavior would likewise leave such evidence untouched.

This separates three properties:

- **Recoverability:** not guaranteed on Windows after interruption.
- **Data preservation:** recovery validation rejects before rollback mutation,
  and the proposed unsupported response would preserve evidence; however,
  source inspection alone is not a Windows preservation qualification.
- **Confidentiality:** not established. The transaction code requests POSIX
  modes when creating journals and markers, but Windows does not implement the
  owner/group/other distinction for those modes. The code does not verify the
  inherited Windows ACLs of newly created transaction metadata. Journals,
  staged outputs, and backups may therefore inherit access from the selected
  parent directory.

### 2. Can unresolved transactions be detected and quarantined without modifying them?

Potentially, by conservatively enumerating the recovery parent for journal names
(`.svger-transaction-*.json`) and stage names (`.svger-stage-*`) and refusing new
transactions if any are present. Name-only detection avoids parsing or changing
their contents and includes a stage left before the journal was written. It can
also conservatively block on stale or unrelated transaction artifacts.

This is not implemented and is not yet race-safe. Current serialization is an
in-process lock keyed by output directory, not a cross-process or shared-parent
lock. A second process could create evidence after a scan; another output
directory under the same parent may also have an active transaction. A safe
quarantine gate needs a separately designed parent-level coordination and
failure policy. No artifact should be renamed, deleted, or rewritten to
"quarantine" it without authorization.

### 3. Do subsequent operations currently refuse to obscure pending evidence?

No. `commitOutputTransaction` does not scan for pending journals/stages before
creating a new stage and journal. A subsequent build can move the current output
into its own backup and write a newer output while the old journal remains. A
later rollback of the old journal may restore its older backup over that newer
output. Thus evidence files can remain present while the output state they
describe is changed; preservation of journal bytes alone does not preserve
recoverability or prevent loss of a newer generated output.

The same behavior is reachable through the service and the build-tool
integrations that call the shared transaction writer. Existing checks do not
establish a pending-evidence refusal contract.

### 4. Is an explicit unsupported-recovery policy compatible with Windows support?

Not as a claim of full Windows transaction-recovery support. The package
declares Windows, documents `recover`, and exports `recoverOutputTransactions`.
An explicit fail-closed error could accurately describe a temporary capability
limit, but it would provide safety of non-mutation—not functional recovery. If
ordinary generation continues, interrupted transactions can be stranded, and
subsequent operations currently can obscure them. Adopting that policy alone is
therefore insufficient. Product/security-owner risk acceptance and a revised
operational contract would be required; changing the published support scope is
outside this directive.

As implemented today, a journal rejected during validation is reported in the
`RecoveryReport.diagnostics` array; the API does not throw an
unsupported-platform error. The CLI treats a nonempty diagnostics array as
`FilesystemFailure` (exit code 8). Replacing that report behavior with a thrown
platform diagnostic is an API behavior change and requires the separate
compatibility review already identified in the ADR.

### 5. Is native authorization mandatory, or must release scope change?

To preserve the intended Windows recovery contract, platform-appropriate ACL
authorization is mandatory. It must cover both authorization of existing
recovery material and safe creation/protection of new journals, stages,
backups, and rollback markers. A recovery-only ACL reader would otherwise risk
rejecting metadata created by the package itself under an inherited ACL.

If native authorization and lifecycle coordination are not completed and
qualified, Windows functional recovery remains a release blocker. A temporary
unsupported policy is a separate product/security risk decision, not an
equivalent implementation of the v4.1 recovery contract.

## Decision-gate recommendation

Current evidence establishes neither Windows-native authorization nor a safe
unsupported lifecycle. Outcome: **Windows recovery remains a release blocker**.
Do not add the proposed `E_RECOVERY_UNSUPPORTED_PLATFORM` behavior, a Windows
mode-bit exemption, a pending-journal gate, or any other production change under
this investigation authorization.

A future implementation directive should cover, as one lifecycle design:

1. Windows ACL validation for existing metadata and ACL-safe creation of new
   transaction metadata;
2. detection and handling of pending journal/stage evidence before a later
   transaction can obscure it;
3. serialization/race behavior across output directories and processes;
4. recovery, rollback-resume, and cleanup semantics; and
5. Windows Node 22/24 tests for normal commit, caught rollback, interrupted
   commit/rollback fixtures, rejection without mutation, and subsequent-build
   refusal while evidence is unresolved.

No support matrix, error taxonomy, package metadata, release control, workflow,
or production source was changed. No tests were run, consistent with the
investigation-only directive. The existing ADR remains uncommitted pending
review of this assessment.

## Source references

- Transaction creation, in-process rollback, cleanup, and journal recovery:
  [`src/application/output-transaction.ts`](../src/application/output-transaction.ts)
- Public recovery CLI and diagnostic formatting:
  [`src/commands/recover-command.ts`](../src/commands/recover-command.ts) and
  [`src/cli.ts`](../src/cli.ts)
- Declared Windows runtime support:
  [`docs/SUPPORT-MATRIX.md`](SUPPORT-MATRIX.md)
