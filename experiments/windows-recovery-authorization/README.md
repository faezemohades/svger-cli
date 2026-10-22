# Windows recovery authorization proof of concept

**Status:** isolated experiment; not production code and not security-qualified.

This harness tests Windows primitives relevant to transaction recovery without
being imported, packaged, or called by SVGER-CLI. It is intentionally a small
Win32 executable rather than a Node addon: the current host has no Windows SDK
or Node/npm, so this checkout cannot build or run a Windows binary. Whether a
Node-API adapter can safely expose the primitives to Node 22/24 remains an
acceptance gate, not an inferred result.

The harness provides:

- fail-closed owner/DACL inspection from an already-open handle;
- creation of a file with a protected DACL for the current token user and
  `SYSTEM`, followed by inspection of the resulting descriptor;
- no-follow opening of files/directories and reparse-point rejection;
- rename and delete requests issued against already-open file handles;
- an exclusive parent lock using a protected lock file opened with no sharing.

The inspector permits write-capable allow ACEs only for the current token user
and `SYSTEM`; it rejects unknown ACE types and non-approved write principals.
`AccessCheck` is also used for the current process token. This is a conservative
prototype policy, not a complete Windows effective-access evaluator for every
restricted-token, privilege, filesystem, or remote-volume configuration.

## Build and run on Windows

Use a Visual Studio 2022 Developer PowerShell with the Desktop C++ workload and
Windows SDK installed:

```powershell
cmake -S experiments/windows-recovery-authorization -B $env:TEMP\svger-win-poc
cmake --build $env:TEMP\svger-win-poc --config Release
& $env:TEMP\svger-win-poc\Release\svger-recovery-poc.exe self-test
```

The `self-test` uses only a fresh temporary directory. The temp directory's
parent must pass the same conservative owner/ACL check (current user ownership;
no non-approved write ACEs); choose another disposable temp location if the
machine's default temp parent fails closed. It verifies protected
creation, owner/DACL inspection, rename of the already-authorized file handle
after its original pathname is substituted, handle-based delete, and rejection
after adding an Everyone write ACE. It does not change repository or user
files. For inherited-ACE, foreign-owner, reparse-point, and competing
process fixtures, run the separate qualification script on an isolated Windows
qualification runner. The foreign-owner case specifically needs a runner
permitted to assign the `SYSTEM` owner SID; ordinary hosted runners may not have
that privilege:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  experiments/windows-recovery-authorization/qualify.ps1 `
  -Exe "$env:TEMP\svger-win-poc\Release\svger-recovery-poc.exe"
```

The owner-mismatch fixture requires permission to assign the disposable file's
owner to the `SYSTEM` SID. If the runner cannot do that, the script reports the
gate as `INCONCLUSIVE` in its JSON report and continues the remaining checks;
the workflow remains failed/incomplete and must not be described as a full
qualification pass. The script verifies the resulting owner SID before it
tests rejection, so an unconstructed fixture cannot count as a pass. The report
also records protected metadata, explicit/inherited ACE rejection, reparse
rejection, cross-process lock behavior, cleanup, and the Node-integration
boundary.

The dedicated workflow is
`.github/workflows/windows-recovery-poc-qualification.yml`. It is limited to
the remediation branch and manual dispatch, grants only `contents: read`, and
uploads text logs plus the JSON result for 14 days. It does not upload the
experimental executable, integrate the harness into SVGER-CLI, or publish a
release artifact. Its summary explicitly reports Node 22/24 integration as
untested because this isolated POC has no Node integration.

To test process exclusion, start one process holding a disposable lock:

```powershell
$lockRoot = Join-Path $env:TEMP ("svger-poc-lock-" + [guid]::NewGuid())
& "$env:TEMP\svger-win-poc\Release\svger-recovery-poc.exe" create-dir $lockRoot
$lock = Join-Path $lockRoot 'parent.lock'
$holder = Start-Process "$env:TEMP\svger-win-poc\Release\svger-recovery-poc.exe" `
  -ArgumentList @('hold-lock', ('"{0}"' -f $lock), '10000') -PassThru -NoNewWindow
Start-Sleep -Milliseconds 500
& "$env:TEMP\svger-win-poc\Release\svger-recovery-poc.exe" try-lock $lock
$holder.WaitForExit()
Remove-Item -LiteralPath $lockRoot -Recurse -Force -ErrorAction SilentlyContinue
```

The second invocation must fail with `lock_busy` while the first owns the
handle. This is a cooperative exclusion primitive: an attacker able to modify
the parent directory or run as the same user remains outside this prototype's
protection boundary. Parent-directory ACL validation and coordination across
all real transaction writers still require lifecycle design.

## Not established yet

- Node 22/24 integration or behavior on Windows CI;
- complete effective access semantics for all token/group/privilege cases;
- safe replacement semantics when a destination already exists;
- transaction-level ordering, journal recovery/resumption, or stale-journal
  refusal;
- protection from a hostile same-user process or administrator;
- x64 and ARM64 build/distribution policy.

Do not copy this code into `src/`, add it as a package dependency, or use it to
authorize real transaction metadata. A negative or incomplete result is valid
for this feasibility experiment.
