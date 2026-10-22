# Isolated Windows Node-API session lifecycle prototype

**Stage:** Directive 046-D.2M.1 only. This is experimental code, not production
recovery and not part of the npm package.

The addon exposes an opaque session that owns one unnamed Windows event handle.
It exists solely to exercise Node-API construction, ownership, serialized
asynchronous calls, explicit close, finalization, structured errors, and
process-exit behavior. It performs no ACL inspection, transaction locking,
journal scanning, file creation, rename, delete, rollback, or output mutation.
At most eight native probes may be pending in one Node environment and each is
limited to one second, which bounds the prototype's shutdown-drain workload.

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
```

Set `$env:UV_THREADPOOL_SIZE = '4'` before running the test command. The
cancellation fixture fills those four worker slots to ensure the fifth item is
still queued when cancellation is requested.

The tests cover explicit/idempotent close, rejected calls after close, injected
initialization and queue failures, per-session asynchronous serialization,
close while a native operation is active, finalization while work is pending,
worker-environment shutdown, and a child process exiting without explicit
close. The OS closes process-owned handles at process termination; this test
does not claim to measure the kernel handle table after process destruction.

## Qualification boundary

The dedicated workflow runs Windows x64 on Node 18.17, 22, and 24. ARM64 is an
open qualification gate. A green M.1 workflow would establish only the addon
session lifecycle on that runner matrix. It would not qualify ACL authorization,
cross-process transaction locking, pending-evidence protection, durability,
recovery, distribution, or production integration.

Do not copy this addon into `src/`, add it to `package.json`, invoke it as a
production helper, or use it to authorize real transaction metadata. Do not
advance to M.2/M.3/M.4 until M.1 is reviewed and accepted.
