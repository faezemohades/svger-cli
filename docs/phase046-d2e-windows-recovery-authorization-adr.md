# ADR — Windows Recovery Authorization for v4.1

**Status:** Proposed; design only, implementation not authorized

**Scope:** Windows authorization for interrupted output-transaction recovery

**Related work:** Directive 046-D.2E; Engineering Review 134

## Decision summary

Windows is a declared supported operating system for SVGER-CLI, and both the CLI
`recover` command and the `recoverOutputTransactions` API are public. Therefore,
Windows recovery is part of the intended v4.1 public contract, but it is not
currently security-qualified. Until a Windows-native authorization mechanism is
implemented and qualified, the recommended policy is to fail closed with an
explicit unsupported-platform diagnostic. Do not bypass the existing POSIX mode
check or claim Windows recovery support based on `chmod()`.

This is a design recommendation only. The current implementation, tests, support
matrix, release policy, and package metadata are unchanged by this record.

## Authorization contract

The shared recovery engine may inspect or mutate transaction state only after a
platform adapter has authorized every relevant object:

| Concern | POSIX adapter | Windows adapter |
| --- | --- | --- |
| Owner | Journal and existing stage objects belong to the process UID | Owner SID is the process token user's SID (or a specifically approved system identity) |
| Writable principals | Reject group/world write bits | Inspect the effective DACL, including inherited ACEs and generic rights; reject write, delete, `WRITE_DAC`, or `WRITE_OWNER` access for untrusted principals |
| Metadata objects | Regular files and private stage directories | Regular files/directories with authorized owner and ACL; inspect journals, stages, backups, and rollback markers recursively |
| Path integrity | Canonical physical paths and symlink containment | Canonical volume paths and reparse-point/junction containment |
| Mutation | Revalidate immediately before destructive operations | Keep authorization tied to opened object identity; revalidate immediately before mutation and prevent path substitution where the platform permits |

The trusted writer set should be narrow: the current process token user's SID and
the Windows `SYSTEM` SID. Do not accept broad `Administrators`, `Users`,
`Authenticated Users`, `Everyone`, or unknown-SID write ACEs as ordinary trusted
writers. Excluding an Administrators ACE does not remove administrator
capabilities: a privileged host administrator can take ownership, change the
DACL, or use backup/restore privileges. Host administrators are therefore
explicitly outside the threat boundary, not neutralized by the allowlist.

Deny ACEs, inherited ACEs, object/container inheritance, generic-right
expansion, and explicit rights that can change an ACL or replace a file must be
evaluated. The adapter must account for enabled and deny-only groups, restricted
SIDs, and relevant privileges in the process token; checking only whether the
current process can read or write a file is insufficient.

This policy protects against other security principals, not a malicious process
running as the same user. Same-user processes share the authorized SID and can
race path-based operations. Reparse-point checks and preflight ACL inspection do
not eliminate that race. The adapter design must either pin object identity and
perform mutations through handles, or document and enforce a protected-parent
directory/serialization boundary. It must not imply protection from an
uncooperative same-user process that can mutate the same directory.

## Implementation and dependency assessment

Node's public filesystem API does not expose Windows owner SIDs, effective
access checks, or the full ACL distinctions needed here. Node documents that
Windows does not implement the normal owner/group/other permission distinctions
for `chmod`; those mode bits cannot prove private metadata. See the [Node.js
v24.20.0 filesystem documentation](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html).

Invoking `icacls` or PowerShell as the production authorization engine is not
recommended: output parsing is locale- and version-sensitive, inherited and
effective rights are easy to misinterpret, and a separate path-based check
widens the authorization-to-use race. A Windows-native implementation is
feasible, but not with the existing public Node filesystem API alone. Viable
approaches are a small audited N-API/native adapter using Windows security APIs,
or a separately maintained helper with a narrow, handle-based protocol. Either
adds build, distribution, maintenance, and security-review cost; no runtime
dependency or implementation approach is approved by this ADR.

The preferred investigation is a minimal native adapter around Windows
security-descriptor and handle APIs, isolated behind the platform-neutral
`RecoveryFileAuthorization` contract. Before choosing it, prototype whether it
can inspect owner/DACL state and preserve object identity across the shared
engine's rename/delete operations on Node 22 and 24. If safe handle-bound
mutation cannot be provided without a disproportionately large native surface,
retain explicit unsupported-platform behavior instead.

## Qualification design

Windows CI must create fixtures with known security descriptors using stable SID
values, not localized account names. Tests must verify both authorization and
non-mutation outcomes:

- A private journal/stage owned by the runner identity and writable only by the
  runner identity plus `SYSTEM` is accepted and recovered.
- Explicit and inherited write-capable ACEs for broad or unknown principals are
  rejected before outputs change.
- An owner SID mismatch is rejected.
- Reparse-point/junction substitutions are rejected, including replacement
  attempts between authorization and mutation where the adapter claims to
  prevent them.
- For every rejection, the journal, stage, output, and outside sentinel remain
  byte-for-byte unchanged.
- Run the focused recovery contract and hardening suite on Windows with Node 22
  and 24; retain the existing Ubuntu/macOS matrix.

The test fixture must inspect and assert its actual owner/DACL before invoking
recovery. A passing `chmod()` or `fs.access()` call is not fixture evidence.

## Interim Windows fail-closed contract

This matrix is the proposed behavior for a later, separately authorized change;
it does not describe a new behavior already implemented in this checkout.

| Operation on Windows | Proposed interim behavior |
| --- | --- |
| `recoverOutputTransactions()` | Reject immediately with an explicit unsupported-platform diagnostic, before scanning journals or inspecting metadata. |
| CLI `recover` | Return nonzero and emit the same machine-readable diagnostic for `--format json`; pretty output must identify the diagnostic code. |
| Existing interrupted journals, stages, backups, rollback markers, and outputs | Preserve byte-for-byte; do not inspect, roll back, delete, or clean them as part of rejected recovery. |
| Ordinary SVG generation | Keep existing behavior; do not disable generation as an incidental side effect of the recovery guard. |
| New output transactions | Keep existing transaction and automatic rollback behavior; do not weaken its safety checks. See the lifecycle limitation below. |
| Linux/macOS recovery | No behavior change. |

### Transaction lifecycle implication

The current transaction code attempts in-process rollback when a commit throws
before the committed state is persisted. If that rollback and cleanup complete,
the journal and stage are removed. A successful commit also removes them. If
rollback is incomplete, cleanup fails after commit, or the process/host stops at
an interruption point, the journal and stage may remain for a later recovery
pass. Fail-closed Windows recovery would then preserve those artifacts but
refuse to inspect or repair them. Such state can be operationally stranded; the
proposal must not call it recoverable merely because evidence was preserved.

Thus continuing ordinary Windows generation while rejecting all subsequent
recovery does not guarantee that interrupted transactions can be repaired. The
interim policy requires explicit maintainer/security-owner acceptance of this
residual risk and user-facing documentation before it is adopted. If that risk
is unacceptable, the interim recovery error cannot be implemented in isolation:
the team must separately authorize a transaction gate or another recovery path.
No such gate or alternative is authorized by this ADR.

## Focused implementation proposal — not authorized

This plan is ready for review; implementation requires a separate directive.

1. Add a platform guard at the start of `recoverOutputTransactions()` on
   `win32`, before `readdir` or any journal/stage filesystem access. Throw
   `DiagnosticError` with proposed code `E_RECOVERY_UNSUPPORTED_PLATFORM`, a
   stable message, and existing `ExitCode.FilesystemFailure` (8). Do not add or
   renumber an exit-code enum value. Confirm the additive diagnostic code
   against the frozen public error compatibility baseline before implementation.
2. Ensure the CLI `recover` command serializes that diagnostic through its
   existing JSON report path and exits 8; pretty output must expose the same
   code and nonzero status. Other CLI commands and generation paths remain
   unchanged.
3. Add Windows tests that create an existing journal, stage, backup, rollback
   marker, output, and outside sentinel, invoke both API and CLI, assert the
   unsupported diagnostic/exit code, and prove every byte and directory entry
   remains unchanged. Do not skip the assertion or claim functional recovery.
4. Keep Linux/macOS valid recovery, alias rejection, path-escape, hardening, and
   preservation tests unchanged. On Windows, continue testing successful
   generation/commit cleanup and in-process rollback separately from the
   unsupported manual-recovery assertion.
5. Before enabling this interim behavior, obtain written acceptance of the
   stranded-journal consequence above and publish a clear limitation notice.
   If acceptance is not granted, defer implementation and keep the release
   blocked pending a native authorization path or a separately approved
   transaction policy.

## Open questions and disposition

1. **Is Windows recovery in the v4.1 contract?** Yes, as currently published in
   source/docs: the package allowlists `win32`, the support matrix lists Windows
   as supported, `recover <directory>` is documented, and
   `recoverOutputTransactions` is exported. That establishes intended support,
   not a successful security qualification.
2. **Which identities may write metadata?** The current process token user's
   SID and `SYSTEM`; host administrators remain an explicit trust boundary.
   Broad built-in/user groups and unknown SIDs are not accepted as writers.
3. **Can this be done without an unacceptable dependency?** Not through Node's
   standard filesystem API alone. A native adapter avoids a JS runtime package
   dependency but still introduces native build/distribution obligations; this
   needs a separate implementation and supply-chain review.
4. **How will CI distinguish valid from unsafe metadata?** Use ACL fixtures
   constructed and verified by SID, then assert authorization decisions and
   no mutation for explicit, inherited, owner-mismatch, and reparse cases.
5. **Should Windows fail closed until then?** In principle, yes, with an
   explicit error and no filesystem mutation. But because Windows generation
   can leave journals that this policy cannot later recover, adoption is
   conditional on the risk acceptance and focused implementation proposal
   above. The current POSIX check's incidental mode-bit rejection is not the
   specified unsupported-platform contract.

**Disposition:** Windows functional recovery remains unqualified. Directive
046-D.2E's architecture investigation is complete; the explicit fail-closed
contract and implementation plan are proposed under 046-D.2F. Keep production
code, existing qualification workflow behavior, and release gates unchanged
until a separate implementation directive and the stated risk acceptance are
provided. No merge, release, npm publication, or Pages deployment is authorized
by this design record.
