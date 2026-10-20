# Phase 03.3B-1 — Isolated Shadow Capture and Oracle Qualification

Status: Directive 019 capture tooling is accepted experimentally under Engineering Review 040;
Directive 020 is closed. Directive 021 oracle coverage design and Svelte-JavaScript fixture
qualification are recorded in [the 03.3B-2 design](phase3.3b-2-oracle-coverage-design.md). Neither
decision authorizes a candidate emitter, framework migration, production routing, or Phase 03.4.
This record preserves the Directive 019–022 capture contract history. Directive 023 versions the
qualification envelope as v3 and adds a distinct source-oracle subset; the current result is in the
[03.3B-4 qualification](phase3.3b-4-static-source-oracle-qualification.md).

## Capture contract and provenance

`experiments/phase3/shadow-capture-contract-v1.mjs` originally versioned records as
`svger-shadow-capture-v1`. Directive 022 extends the experimental shape to
`svger-shadow-capture-v2`, adding artifact-bound Svelte-JS semantic analysis and three-way
comparison evidence. Records include the fixture ID and SHA-256/UTF-8 size of the exact SVG input,
role and output origin, effective framework/language/optimization options, captured outcome and
security decision, generated or supplied artifacts, source-derived semantic evidence,
artifact-derived evidence where qualified, framework-validation result, compiler identity, capture
runtime/platform/architecture, and isolation status. See the
[03.3B-3 artifact-oracle qualification](phase3.3b-3-artifact-oracle-qualification.md).

Legacy compiler identity records the package version, Git `HEAD` when available, and a digest of the
exact compiled `dist/**/*.js` tree used by the generator. Candidate fixture origin is explicitly
`supplied-captured-fixture`; no candidate compiler, revision, or generation runtime is asserted.
Native framework validation separately records its compiler and version. Capture records are
immutable and, within this process, only records returned by the capture functions are accepted by
`compareQualifiedCaptures`. This is an in-process provenance guard, not a cryptographic signature or
a portable attestation for deserialized records.

The harness receives semantic values only from an independent source path: mandatory input
admission, the experimental Saxes XML adapter, and the Phase 03.2C XML-to-IR-v1 lowering. The
candidate capture API has no semantic-projection argument. Projections retain ordered text/CDATA,
expanded element/attribute names, ID/reference observations, accessibility attributes, titles, and
descriptions. Coverage is attached per dimension. The current lowerer reports references and
accessibility as partial; that evidence is therefore visible but fails the qualification gate.
Partial observations are never presented as complete equivalence.

## Execution boundary and resource limits

Legacy generation and native Svelte compilation run in separate Node child processes. Each process
uses a fresh temporary working directory, a reduced environment, a 192 MiB V8 old-space ceiling, an
enforced wall-clock timeout, bounded stdin/stdout, and no configured application output or cache
path. The fixed worker invokes only `SVGProcessor.generateComponent()` for legacy generation; it
does not call the processor's file-writing path or receive a writer/cache object. A caller may
provide up to eight explicit absolute guard paths. Their file contents and relevant metadata are
hashed before/after execution; the report stores only a digest and status. The temporary workspace
must remain empty and is removed after success, failure, or timeout.

This is not an OS filesystem sandbox: Node and imported modules still run with the process user's
filesystem permissions. The isolation claim is limited to the fixed, reviewed worker and the absence
of caller-supplied executable callbacks and production output/cache paths. The 192 MiB limit is a V8
heap ceiling, not a total RSS guarantee. Guarding is only as complete as the explicitly supplied
paths. The capture record states these limitations rather than implying containment of arbitrary
candidate code.

The runner enforces a maximum 4 MiB input, 4 MiB artifact, 8 MiB child output, 64 KiB child stderr,
10-second default timeout (maximum configurable timeout 120 seconds), and 10,000 guarded entries /
256 MiB of guarded file contents. A timeout is produced by the parent killing the child and is
distinct from a caller-provided timeout label. Child crashes, malformed protocols, output-limit
failures, guard changes, and unexpected temporary files are represented as failed or blocking
evidence.

## Framework validation and candidate boundary

The qualified native compiler path is Svelte 4's compiler for generated or supplied JavaScript-mode
`.svelte` artifacts. Its exact `VERSION`, status, stable diagnostic codes, and enforced timeout are
captured. Svelte TypeScript mode is marked unverified because this repository has no separately
qualified Svelte TypeScript preprocessor. React, Preact, Solid, Vue, Angular, Lit, Vanilla, and
React Native outputs are also marked `not-checked`; parser/transpiler success is not substituted for
a native framework result. Invalid Svelte output is blocking.

No candidate framework emitter was implemented. `captureCandidateFixture()` stores only the artifact
supplied by the caller and compiles it where the qualified Svelte path applies. It does not create a
candidate from the legacy result. The regression covers valid, invalid, and semantically
altered-but-valid supplied Svelte output. The altered fixture demonstrates that native compiler
validity and source-derived semantics do not establish candidate semantic equivalence; it remains
non-promotable and is detailed in the 03.3B-2 design record.

## Qualification gate and known limitations

`compareQualifiedCaptures()` passes only capture-created, immutable records to the Phase 03.3A
comparator. It checks fixture/source identity, role, options, unique capture IDs, repeated samples,
per-side toolchain consistency, environment consistency, semantic provenance/coverage, native
compiler identity/status, timeouts, workspace cleanliness, and guard-path stability. Any incomplete
semantic evidence, missing native validation, failed validation, timeout, crash, mismatched fixture,
duplicate sample ID, or observed write prevents promotion. The comparison report includes digests of
toolchain/environment context so a stable result is explicitly scoped to those captured versions.

Two identical runs establish consistency only for those recorded samples in that captured
environment. They do not prove cross-platform, cross-runtime, concurrency, or dependency-upgrade
determinism. Candidate captures are caller-supplied and not signed; source-derived projections do
not establish that an external candidate compiler was honestly identified. The wrapper cannot prove
a candidate's provenance beyond the capture process and supplied evidence. References and
accessibility remain partial, so the present experiment cannot produce a promotion-eligible
semantic-equivalence result. No performance threshold is introduced.

## Reproduction

From the repository root, after installing the existing lockfile dependencies:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts \
  --outDir experiments/phase3/.build --rootDir experiments \
  --module ES2022 --moduleResolution Bundler --target ES2022 --strict \
  --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node tests/phase3/shadow-capture-qualification.test.mjs
```

The test captures two actual legacy Svelte-JS generations, checks the native compiler identity and
enforced timeout, verifies source/configured-output/cache fixtures remain unchanged, exercises
invalid candidate compilation and security-rejection output, tests timeout enforcement and
unverified-framework behavior, and verifies caller-authored/deserialized records are rejected. These
are bounded experimental observations, not a candidate-equivalence certification.

## Verification record

On 2026-10-19, the Phase 00 SVG security corpus, Phase 02 parser qualification, Phase 03.2A–03.2C
conformance tests, Phase 03.3A comparison tests, and this capture qualification test passed under
Node 20.20.2. `npm run test:phase1` passed. Before Directive 020, `npm run quality:full` passed on
its second invocation, including package smoke at 754 files / 634,254 bytes. That result predates
the test instrumentation below.

The first `quality:full` invocation failed in the existing Phase 00.7 resource-lifecycle test at its
final FIFO-order assertion for a failed transaction followed by symlink-alias/direct-path commits.
The pre-correction evidence was four isolated serial passes and four overlapping test processes,
three of which failed with `second-left` observed where `third-left` was expected. This reproduced
only under overlapping runs and did not demonstrate mixed transaction files.

Directive 020 triage established the ordering contract and corrected the test synchronization point.
`withOutputDirectoryLock()` canonicalizes the requested directory asynchronously (`mkdir` and
`realpath`) and appends a promise tail to the canonical-key map only after those operations finish.
FIFO is therefore the order in which waiters register on that map, not the order in which callers
invoke `commitOutputTransaction()`. The old test launched alias and direct-path requests in request
order but used completion of both `realpath` wrappers plus two microtask turns as a proxy for waiter
registration. That proxy was not valid: the two asynchronous canonicalizations can complete in
either order. The transaction tail chain itself appends and releases in registration order; the
failure rollback completed before queued operations proceeded, and the final pair was never mixed.
Symlink and direct paths are confirmed to resolve to the same canonical directory in the regression.

The regression now observes an internal test-only pending-waiter count and starts the third request
only after the alias request has registered; it then waits until both waiters are registered before
releasing the injected transaction failure. This keeps the FIFO assertion tied to the actual
contract boundary and retains rollback restoration, canonical alias identity, pair atomicity, and
lock cleanup assertions. No lock scheduling or transaction behavior was changed; the internal
counter is diagnostic instrumentation only. After correction, four isolated runs passed, followed by
eight overlapping runs with all eight passing.

The capture qualification retains its filesystem-watch mutation regression and adds deterministic
failure injection by wrapping `fs.mkdtemp` in the test. The injected write occurs after the guard
snapshot and before the worker launch, so mutation classification is verified without relying on
watcher delivery timing. Both paths assert `guardStatus: mutated` and the blocking
`unauthorized-write` qualification result; the original guarded file is restored in `finally`.

After correction, `npm run quality:full` passed, including the Phase 00.7 resource-lifecycle suite,
Phase 01 contracts, and package smoke. `npm run package:conformance` also passed with 754 files and
634,361 packed bytes, 6,262 bytes below the existing 640,623-byte ceiling. The updated conformance
report records the resulting archive digest. `git diff --check` passed. The standalone eight-run
overlap repetition and the post-correction full gate both completed without the FIFO assertion.

No runtime dependency, production adapter, package export, production compiler route, configured
artifact, or persistent cache was changed. Phase 03.3B full framework emission, Phase 03.4
migration, Phase 03.5 default switch, production parser selection, and publishing remain
unauthorized.
