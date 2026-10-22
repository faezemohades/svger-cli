# Isolated Windows Node-API session and parent-lock prototype

**Stage:** Directives 046-D.2M.1 and M.2 only. This is experimental code, not
production recovery and not part of the npm package.

M.1 exposes an opaque session owning an unnamed Windows event handle. M.2 adds
`openLockedSession(parentPath)`, which opens and authorizes a physical parent
directory, verifies its owner and DACL, checks a supported local filesystem,
then retains an exclusive lock-file handle for the session lifetime. The lock
file has a protected DACL for the current token user and `SYSTEM`; it is
deliberately persistent and is never deleted by the prototype. Its exclusive
share mode coordinates cooperating processes, and the operating system
releases ownership after process termination.

Authorization is checked from opened handles. The parent handle is retained,
its volume/file identity recorded, and its physical path reopened and compared
before and after lock acquisition. Reparse-point directories, owner mismatches,
untrusted write-capable allow ACEs, unknown ACE types, inherited lock-file
DACLs, and unsupported filesystems fail closed. This reduces path-substitution
risk but does not protect against a hostile process running as the same user or
a privileged administrator. The lock is not integrated with SVGER transaction
writers.

The addon still performs no journal scanning, transaction file creation,
rename, delete, rollback, or output mutation. At most eight native probes may
be pending in one Node environment and each is limited to one second, which
bounds the prototype's shutdown-drain workload.

The internal error category set is consistent across this prototype:
`authorization`, `busy`, `malformed`, `ambiguous`, `io`, and `unsupported`.
The test-only `failAfterResource`, `failQueue`, and `cancelAfterQueue` options
inject initialization, queue, and queued-cancellation cases to verify cleanup
of an acquired handle, async work object, and receiver reference.
`pendingWorkCount()` exposes the test-only number of queued work items.

## Build and test on Windows

Use Node.js 18.17, 22, or 24 x64 and a Visual Studio 2022 C++ toolchain with
CMake. The workflow first checks for `include/node/node_api.h` beside the Node
runtime; if absent, it downloads the matching official Node header archive and
verifies it against that release's published SHA-256 manifest. It also links
against the matching `node.lib` shipped beside the selected Windows runtime;
if absent, that import library is downloaded from the same official release
and checked against its SHA-256 manifest entry.

```powershell
$nodeRoot = Split-Path (Get-Command node).Source -Parent
$build = Join-Path $env:TEMP 'svger-node-api-session-build'
cmake -S experiments/windows-recovery-node-api -B $build `
  -DNODE_API_INCLUDE_DIR=(Join-Path $nodeRoot 'include/node')
cmake --build $build --config Release
$env:SVGER_NODE_API_ADDON = Join-Path $build 'Release/svger_recovery_session.node'
node --expose-gc --test experiments/windows-recovery-node-api/tests/session-lifecycle.test.mjs
$env:SVGER_NODE_API_TEST_ROOT = Join-Path $env:TEMP 'svger-node-api-private-test-root'
pwsh -NoProfile -File experiments/windows-recovery-node-api/tests/fixtures.ps1 `
  -Action create -Path $env:SVGER_NODE_API_TEST_ROOT
node --test experiments/windows-recovery-node-api/tests/parent-lock.test.mjs
Remove-Item -LiteralPath $env:SVGER_NODE_API_TEST_ROOT -Recurse -Force
```

Set `$env:UV_THREADPOOL_SIZE = '4'` before running the test command. The
cancellation fixture fills those four worker slots to ensure the fifth item is
still queued when cancellation is requested.

The tests cover explicit/idempotent close, rejected calls after close, injected
initialization and queue failures, per-session asynchronous serialization,
close while a native operation is active, finalization while work is pending,
worker-environment shutdown, and a child process exiting without explicit
close. The M.2 suite additionally checks cross-process contention and reacquire
after normal close/process exit, DACL and reparse rejection without lock-file
creation, partial-initialization cleanup, and lock retention while native work
is pending. The foreign-owner fixture requires permission to set `SYSTEM` as
the owner of a disposable directory; if unavailable, it is explicitly skipped
and that qualification gate remains open. The OS closes process-owned handles
at process termination; the tests do not claim to measure the kernel handle
table after process destruction.

## Qualification boundary

The dedicated workflow runs Windows x64 on Node 18.17, 22, and 24 and verifies
a private disposable root's actual owner and protected DACL. ARM64 is an open
qualification gate. A green M.2 workflow qualifies only experimental parent
authorization and cooperative locking on that runner matrix. It does not
qualify pending-evidence protection, durability, recovery, distribution, or
production integration.

Do not copy this addon into `src/`, add it to `package.json`, invoke it as a
production helper, or use it to authorize real transaction metadata. M.3
pending-evidence protection and M.4 interrupted recovery are not authorized by
this prototype stage.
