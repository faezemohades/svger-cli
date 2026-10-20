# Phase 03.3B-7 — Candidate Execution Boundary and Shadow-Readiness Architecture

Status: design and threat-model qualification under Directive 026. This document authorizes no
candidate emitter, candidate execution, sandbox installation, production routing, parser selection,
dependency, package export, or public API change. It is a proposed implementation boundary, not a
claim that the repository currently provides OS-level isolation.

Directive 025 / Phase 03.3B-6 is accepted experimentally by Engineering Review 045. The current
capture process and its in-process provenance checks remain useful qualification tools, but they are
not portable attestations and are not a safe execution boundary for future candidate code.

## 1. Decision summary

The recommended next implementation proposal is a Linux-only, supervisor-controlled worker boundary,
initially qualified on a supported Linux CI image before any local integration. Candidate code runs
as a dedicated unprivileged OS identity in a fresh process and mount/PID/network namespace with
read-only input and toolchain mounts, a size-limited writable output area, default-denied
networking, seccomp restrictions, and cgroup v2 CPU, memory, and process limits. A trusted
supervisor outside the sandbox owns the deadline, kills the complete job cgroup, validates a bounded
result protocol, hashes artifacts, and performs independent analysis.

`nsjail` is the preferred first Linux feasibility prototype because it brings namespaces, seccomp,
cgroups and resource limits together. It is not yet selected as a dependency or trusted control:
exact version/build provenance, supported-kernel behavior, the cgroup-v2 setup, invocation
privileges, and containment tests must be reviewed first. A rootless OCI runtime is the fallback
where the host already operates a controlled container service; a Bubblewrap-based design is a
lower-level option only if a trusted supervisor separately supplies cgroup management and robust
process-tree cleanup. A disposable VM is the stronger isolation fallback for environments where the
kernel/container boundary is outside the accepted threat model, at higher operational and latency
cost.

No one mechanism is treated as sufficient by name alone. If required kernel features, dedicated
identity, cgroup limits, or network isolation cannot be established and tested, candidate execution
must not start. There is no unsandboxed fallback.

## 2. Threat model and security objectives

### 2.1 Protected assets

- Developer, CI, signing, registry and source-control credentials; SSH/GPG agents; cloud metadata
  and host application state.
- Repository contents other than the explicitly mounted candidate build and fixture input.
- Production output directories, transaction journals, caches and configuration.
- Host and neighboring workloads: CPU, memory, process table, disk, network and kernel attack
  surface.
- Integrity and provenance of the source, compiler, execution policy, artifacts and oracle results.

### 2.2 Adversaries and capabilities

Treat candidate emitter code, its transitive packages, generated output, and any data it parses as
potentially malicious. Candidate code may attempt arbitrary syscalls available to its process,
read/write paths, create symlinks or hardlinks, fork/daemonize, exhaust resources, spoof or flood
the protocol, exploit compilers/oracles consuming its output, or reach local, link-local, DNS or
external network services. It may report false compiler identity, success, output paths, or semantic
claims.

The design also accounts for accidental defects, timeout/cancellation, malformed requests, partial
writes and supervisor crashes. It does not claim to defend against a compromised host kernel,
administrator/root, hypervisor, or trusted supervisor; hardware side channels; denial of service by
other host processes; or a supply-chain compromise of the pinned sandbox/toolchain image. Those
remain explicit residual risks requiring host controls and provenance review.

### 2.3 Security objectives

1. Candidate code receives only one already-admitted, validated IR request and the minimum read-only
   toolchain files needed to run.
2. Candidate code cannot access ambient credentials, repository/production paths, user home, host
   sockets, caches, or writable host files.
3. Network access is denied at the OS namespace/firewall boundary, not by environment variables or
   an application convention.
4. CPU, memory, process count, output bytes, temporary storage and wall-clock time are bounded by
   kernel/supervisor controls. A limit breach is a failed capture, not partial success.
5. Timeout, cancellation, crash and protocol violation terminate the entire process tree and leave
   no candidate-controlled process running.
6. The trusted supervisor—not the candidate—establishes execution identity, outcome and artifact
   hashes. Independent oracles analyze captured output after execution.
7. Any unsupported input state, unknown schema, missing isolation control, inconsistent identity,
   output overflow or ambiguous result fails closed and is ineligible for promotion.

## 3. Proposed execution architecture

```text
Trusted application / fixture controller
  ├─ mandatory SVG admission (existing boundary)
  ├─ validate and freeze IR v1; hash source + effective options
  └─ trusted supervisor (outside worker boundary)
       ├─ prepare immutable job bundle + pinned compiler/toolchain manifest
       ├─ establish dedicated identity, namespaces, mounts, seccomp and cgroup
       ├─ bounded request pipe ───────────────► candidate worker
       │                                      (no production services or mounts)
       ├─ bounded response pipe ◄──────────── candidate worker
       ├─ deadline / cgroup-wide termination / cleanup
       ├─ independently hash artifacts and bind provenance envelope
       └─ independent framework compiler + source/artifact oracles
                                                │
                                                ▼
                                   shadow-comparison harness
                                   (report only; never writes production output)
```

The supervisor is the only component with access to the fixture controller and report destination.
The worker receives no filesystem writer/cache API, production path, host service handle, inherited
agent socket, or reusable credential. Candidate output is returned through a bounded pipe or a
dedicated mounted output directory; never through a production transaction writer. If a mounted
output directory is used, it is a fresh per-job filesystem/volume with a hard byte/inode limit and
is read by the supervisor only after the worker cgroup is empty.

### 3.1 Identity and filesystem

Use a dedicated, non-login worker UID/GID with no supplementary groups and no access to developer
credentials. The sandbox root contains only a minimal runtime, exact candidate build, declared
read-only toolchain, and job input. Mount repository source and toolchain read-only; do not mount
the host home, `/run` sockets, Docker/Podman sockets, SSH/GPG agents, package-manager caches,
`/proc` from the host, or arbitrary `/sys` paths. The root filesystem is read-only except a per-job
tmpfs/output mount with explicit size and inode ceilings. Use a fresh mount namespace and a private
mount propagation mode.

The supervisor creates the bundle from trusted regular files, rejects path components outside the
manifest, and opens inputs without following symlinks. It verifies file type, ownership, link count,
size and digest before mounting. The worker's namespace contains no path to the original host
workspace; thus a candidate-created symlink or hardlink can refer only to the sandbox namespace. The
supervisor rejects absolute paths, `..`, duplicate/ambiguous artifact names, symlinks, hardlinks and
non-regular output objects in returned artifacts. Cleanup is performed by the supervisor only after
worker termination and is constrained to the exact per-job directory/volume identity.

### 3.2 Network and syscall policy

Create a fresh network namespace with no interfaces/routes and no inherited network namespace,
socket, proxy variables or resolver configuration. Deny DNS, host loopback, host-gateway, link-local
and cloud metadata destinations; test these from inside the actual sandbox. Network namespace
creation alone is not considered sufficient evidence: the qualification must verify that no usable
route, socket handoff, host service or DNS path exists. If the chosen runtime cannot establish
default-denied networking, refuse to launch.

Apply a reviewed, versioned seccomp allowlist appropriate to the pinned runtime. Deny privilege
escalation, namespace/mount changes after setup, tracing, keyring access, raw/network socket
creation, module loading and other unnecessary syscalls. Set no-new-privileges; drop capabilities;
prohibit setuid transitions. The profile must be derived from observed legitimate worker syscalls
and tested against attempts to bypass the filesystem/network boundary. Do not copy a broad generic
profile and call it qualified.

### 3.3 Resource and lifecycle controls

Use a dedicated cgroup v2 subtree per job with hard memory and swap policy, CPU quota, `pids.max`,
and an enforced kill operation for cancellation/timeout. Use a parent-owned monotonic wall deadline;
the worker cannot extend it. Set `RLIMIT_FSIZE`, `RLIMIT_NOFILE`, `RLIMIT_CORE=0`, and other
justified rlimits as defense in depth. Bound request, response, artifact, diagnostic, log and
temporary bytes; bound artifact count, path length and file count. Worker stdout/stderr are pipes
drained by the supervisor with byte ceilings and are never treated as protocol or trusted
diagnostics.

On timeout, cancellation, malformed framing, output overflow, worker crash or supervisor protocol
error: stop accepting output, kill the entire cgroup (not just the direct child), wait until it is
empty, close pipes, validate/clean the exact workspace, and return a bounded failure envelope with
no artifact considered successful. Cleanup failure is itself a blocking security failure and
requires operator-visible diagnostics; do not silently reuse a dirty workspace.

Exact ceilings are intentionally not invented here. A later implementation proposal must derive them
from supported fixture and compiler workloads, state max concurrent workers and aggregate host
budget, and measure parser/IR/compiler/oracle memory together. The single-document Phase 02
benchmark is not a concurrent worker budget.

## 4. Candidate evidence and replay contract

The candidate record is a supervisor-produced envelope with four independently identifiable parts.
All hashes use a named algorithm (initial proposal: SHA-256); canonical encodings, schema versions,
and byte units are explicit. Raw source and secret-bearing environment values are not copied into
reports.

| Identity  | Minimum bound evidence                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source    | Admitted source SHA-256 and UTF-8 byte length; admission-policy version; IR schema and canonical IR digest; effective-options digest; fixture ID.                                                                                                            |
| Compiler  | Candidate source-tree/build digest; immutable revision or source bundle digest; dependency lockfile digest; runtime/compiler/toolchain versions; build recipe/image digest. A mutable tag or caller string alone is insufficient.                            |
| Execution | Supervisor and protocol versions; sandbox implementation/version and binary digest; kernel/runtime identity; isolation-policy digest; worker UID identity class; namespace/cgroup controls observed; resource ceilings; start/end and enforced wall outcome. |
| Artifact  | Supervisor-observed logical path; regular-file/type/size checks; exact artifact SHA-256 and byte length; native framework validator identity/result; independent artifact-oracle schema, analyzer and projection digest.                                     |

The supervisor binds these fields into a versioned `candidate-execution-evidence-v1` envelope and
computes the digest after verifying them. If evidence must cross processes/machines, use a
separately approved authenticated transport/signature with key custody and verification rules; the
current in-process `WeakSet` is not such a mechanism. Until that decision exists, records are local
supervisor observations, not portable attestations. Replaying a capture requires the exact immutable
source/IR/options/compiler/toolchain/policy inputs; a replay mismatch is recorded, not overwritten.

Candidate-supplied claims such as “generated”, compiler version, artifact path, semantic projection,
success, or timeout status are untrusted input. The worker only returns bounded artifact bytes and
bounded stable diagnostic codes/status fields. The supervisor derives artifact digests, path
identity, runtime identity and outcome. A supplied artifact fixture remains a supplied fixture and
cannot be relabeled as sandbox-generated output.

## 5. Versioned IR-to-emitter interface (design only)

Proposed request boundary:

```text
EmitterRequestV1 {
  protocol: "svger-emitter-request-v1"
  irVersion: "svger-ir-v1"
  source: { sha256, utf8ByteLength, admissionPolicyVersion }
  ir: IRDocumentV1                 // validated, immutable snapshot; no parser objects
  effectiveOptions: canonical options subset
  emitter: { id, version, buildDigest }
  limits: { maxArtifactBytes, maxArtifactCount }
}
```

The parent serializes a bounded, canonical representation and validates it before launch. The worker
revalidates the protocol/schema/version and required invariants; it does not trust TypeScript types,
brands, object freezing, or parent-only validation. The request contains no callbacks, file paths to
production, logger with secrets, cache keys, filesystem services, parser state, writer, or
integration objects. IR v1's current experimental TypeScript declarations are not by themselves a
complete runtime validator or an authorization token; malformed/unsupported values must be rejected
at this boundary.

Proposed response:

```text
EmitterResultV1 {
  protocol: "svger-emitter-result-v1"
  outcome: "complete" | "partial" | "unsupported" | "failed"
  artifacts: [{ logicalPath, mediaType, contentBytes }]
  diagnostics: [{ code, severity, boundedSafeMessage? }]
  coverage: [{ feature, status: "complete" | "partial" | "unsupported" }]
}
```

All response fields and aggregate framing are bounded and validated. `logicalPath` is a portable
artifact name, not an output destination. `complete` is allowed only when every required semantic
state is supported and emitted; partial/unsupported states must name the feature and stable code,
never substitute default geometry/style/text or omit opaque/foreign content silently. `failed`,
malformed output, missing required artifacts, non-deterministic protocol framing or unknown fields
are blocking failures. The emitter receives no authority to state its own semantic validity or
promotion eligibility. Artifact meaning is analyzed independently outside its process.

Production artifact planning and transactional writes remain owned by the existing application
service. No emitter result is written into production output or cache under this design.

## 6. Linux feasibility comparison

| Approach                                                  | Strengths for this workload                                                                                                         | Gaps / operational burden                                                                                                                                                                                  | Design position                                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `nsjail` + dedicated identity + cgroup v2                 | One launcher exposes namespace, seccomp, rlimit and cgroup controls; supports a no-network namespace and per-job process isolation. | Kernel/configuration compatibility, binary supply chain, cgroup delegation/privileges and policy correctness need qualification; deployment availability varies.                                           | Preferred first feasibility prototype; not yet installed, pinned or approved.                                              |
| Bubblewrap (`bwrap`) + external supervisor/cgroup manager | Small namespace/mount-oriented launcher; useful for constructing a read-only filesystem view and network namespace.                 | Resource accounting, whole-tree lifecycle, protocol, quotas and evidence remain external responsibilities; more components and TOCTOU/lifecycle integration to qualify.                                    | Viable if existing host policy already standardizes it; not preferred as a standalone boundary.                            |
| Rootless OCI runtime (e.g. Podman)                        | Familiar image/toolchain pinning and filesystem/resource configuration; can fit controlled CI/container hosts.                      | Rootless networking and resource controls depend on host setup; daemon/helper/socket exposure and image provenance must be controlled; generic “containerized” is not proof of denied host/network access. | Fallback where platform operations already qualify and enforce the runtime; require no-network, cgroup and identity tests. |
| Disposable VM/microVM                                     | Stronger kernel boundary and easier whole-VM teardown; useful when kernel attack surface is outside accepted risk.                  | Higher startup/memory/storage cost, image maintenance, guest/host protocol, toolchain distribution and operational complexity.                                                                             | Escalation option if process/container sandbox residual risk is unacceptable.                                              |

This is a design comparison, not a benchmark or deployment recommendation for every host. Linux
Landlock may add defense-in-depth filesystem restrictions but does not by itself supply process,
network, CPU, memory, or complete lifecycle isolation. No path or mount policy can make a
compromised host kernel trustworthy. Primary references reviewed for the mechanisms are linked
below.

## 7. Qualification matrix for a later implementation gate

No tests in this matrix were run by Directive 026; each is a required future acceptance test.

| Area                | Required adversarial evidence                                                                                                                                                                                                    | Fail-closed outcome                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Identity/secrets    | Canary credential files, environment values, agent sockets and host application paths are absent/inaccessible; no inherited descriptors beyond an allowlist.                                                                     | Worker cannot start if identity or descriptor audit fails.                    |
| Filesystem          | Read-only source/toolchain; host sentinel unchanged; traversal, absolute paths, symlink/hardlink, procfs, mount, socket and race attempts fail; only bounded output tmpfs writable.                                              | Any escape, unexpected object or cleanup residue blocks capture.              |
| Network             | Attempts to reach public IP, DNS, host/loopback service, link-local and metadata addresses fail from the worker; no proxy or connected socket is inherited.                                                                      | Any successful path blocks qualification; no network-enabled fallback.        |
| Resources           | CPU saturation, memory exhaustion, fork bomb, file-size/inode floods, FD exhaustion and oversized stdout/stderr/artifact responses hit the configured controls.                                                                  | Supervisor reports bounded failure; host remains within declared envelope.    |
| Lifecycle           | Timeout/cancel/crash/protocol truncation kills descendants; cgroup empties; no workspace, process or descriptor leak across repeated jobs.                                                                                       | Dirty job is quarantined; no reuse and no successful evidence.                |
| Protocol/provenance | Wrong protocol/IR version, duplicate/invalid path, forged compiler identity, tampered artifact digest, replay mismatch, malformed/oversized JSON and candidate-supplied success labels are rejected or independently overridden. | No artifact/evidence accepted from untrusted fields.                          |
| Semantic/framework  | Framework-native compilation and independent source/artifact oracle are separate from emitter claims; unsupported IR states remain partial/unsupported; valid-but-mutated outputs block comparison.                              | Incomplete/invalid/unresolved semantic evidence cannot be promotion eligible. |
| Reproducibility     | Repeated identical requests bind same input/toolchain/policy and compare deterministic artifact/result digests; repeat across the minimum supported Node/kernel matrix.                                                          | Nondeterminism is reported and blocks qualification; no baseline overwrite.   |

Tests must use disposable host sentinels and credentials fabricated solely for the test. No real
credential values are mounted or printed. Containment qualification runs on the exact binary/image,
kernel class, policy digest and configuration proposed for deployment. Unit tests of the wrapper are
not substitutes for inside-sandbox OS-level adversarial tests.

## 8. Bounded next implementation proposal

After review of this design, the next possible authorization should be limited to a disposable Linux
feasibility spike outside `src/`: select one exact sandbox version/build, produce a minimal worker
that consumes a validated IR v1 fixture and returns a deterministic inert artifact, and execute only
synthetic tests from the matrix. The spike must not implement SVG/framework generation, invoke the
production service, access caches/writers, publish artifacts, or change package exports/runtime
dependencies. It must report controls actually enforced, controls unavailable, residual risks,
resource measurements and cleanup results. A separate management decision must authorize even this
spike before it is run.

The spike exit gate should require: (a) explicit platform/kernel prerequisites and no unsandboxed
fallback; (b) verified dedicated identity, read-only mounts, no-network behavior, cgroup/resource
limits and whole-tree kill; (c) bounded protocol and independent artifact hashing; (d) all
applicable containment tests passing; (e) reproducible compiler/toolchain/policy identity; and (f)
owner review of unresolved risks. Only then should a later directive consider a framework-specific
emitter.

## 9. Open decisions and authorization boundary

- Exact supported Linux distributions, kernel features, user-namespace policy, cgroup-v2 delegation,
  and whether a dedicated worker account is available in local/CI environments.
- Exact sandbox implementation/version and who owns binary/image updates and vulnerability response.
- Limits and aggregate concurrency envelope derived from representative compiler workloads.
- Whether evidence remains local or needs an authenticated cross-machine signature/attestation and
  how keys are provisioned, rotated and verified.
- Whether independent native compilers/oracles run in the same constrained worker or a second
  isolated worker with separately pinned identity and toolchain.
- The support policy for non-Linux developers: local candidate execution remains unavailable unless
  an equivalently qualified boundary is provided; ordinary production generation remains unchanged.
- The still-open Phase 01 governance and security-incident controls; this design does not close
  GOV-001/GOV-002 or SEC-INC-001 and does not authorize release/publishing.

Directive 026 is satisfied only by design review of this threat model, isolation architecture,
candidate evidence contract, IR-to-emitter interface, qualification matrix, operational comparison
and bounded proposal. It authorizes no sandbox installation, untrusted execution, candidate emitter,
production code change, runtime/development dependency, parser selection, framework shadow routing,
Phase 03.4/03.5 migration, remote repository action, or publishing.

## 10. Review 046 follow-up — local feasibility assessment

Engineering Review 046 provisionally closes the design work, subject to review of this local
document. It keeps Phase 03.3B and Phase 03 overall open, and recommends the limited Directive 027
feasibility spike. The spike's explicit stop condition applies when required isolation tooling is
not available without installation or privileged host changes.

Environment assessment performed on 2026-10-19 in the development workspace:

- Linux x86_64, kernel `6.12.94-1-MANJARO`; current process identity is UID/GID 1000 with the
  supplementary `nfsnobody` group. This is not evidence of a dedicated candidate-worker identity.
- `unshare` is present. `nsjail`, `bwrap`, `podman`, `docker`, and `systemd-run` were not found on
  `PATH`. The low-level `unshare` binary alone does not supply the reviewed supervisor, immutable
  job bundle, resource policy, bounded protocol, evidence binding, or whole-job cleanup controls.
- A cgroup v2 hierarchy and CPU, memory, and PID controllers are visible. The hierarchy root is
  read-only to this process. No cgroup was created or modified, and writable delegation was not
  established as a qualified per-job resource boundary.
- No sandbox launcher was installed, no privileged or system configuration was changed, and no
  candidate or controlled isolation probe was executed. This is an environment inventory, not a
  containment result.

**Directive 027 result: stopped at environment assessment.** The required qualified isolation
environment is not available as-is, and this directive explicitly excludes installing it or making
privileged host changes without separate approval. Filesystem/network/resource containment,
process-tree termination, artifact provenance through an isolated workload, and evidence-forgery
resistance remain untested. Do not treat the presence of Linux namespaces or cgroup controllers as
proof that these controls work.

To resume the feasibility spike, provide an already provisioned environment with an approved,
versioned sandbox launcher, dedicated worker identity, delegated per-job cgroup v2 controls, and
network/filesystem policy. Alternatively, obtain separate authorization for installation or host
configuration. Until then, no candidate execution, IR emitter, production route, or migration is
authorized by this record.

## References

- [Linux kernel Landlock documentation](https://kernel.org/doc/html/latest/userspace-api/landlock.html)
  — unprivileged filesystem restrictions and their composition with ordinary access controls;
  defense in depth only.
- [Google nsjail project](https://github.com/google/nsjail) — namespaces, cgroups, rlimits and
  seccomp-BPF feature surface.
- [Bubblewrap project documentation](https://github.com/containers/bubblewrap/blob/main/bwrap.xml) —
  namespace/mount setup controls.
- [Podman create documentation](https://docs.podman.io/en/stable/markdown/podman-create.1.html) —
  container configuration surface; host-specific rootless behavior still requires direct
  qualification.
