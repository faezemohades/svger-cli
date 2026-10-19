# Configuration and Pipeline Contract (Phase 00.6)

## Precedence

Compiler/service builds resolve values in this order, from lowest to highest:

1. Built-in `ConfigService` defaults.
2. The current working directory's `.svgconfig.json`.
3. Compiler creation options.
4. Per-build `config` overrides.
5. Explicit per-build fields such as `framework`, `typescript`, and input-safety policy.

Objects merge recursively, arrays replace, and `undefined` means “not supplied.” Explicit `false`,
`0`, and empty strings are retained by resolution; individual fields may reject them during
validation when they are not meaningful (for example, a zero concurrency or an empty required
configuration string). The resolved object is cloned and deeply frozen, so later mutations to
caller-owned layers cannot alter a build.

The legacy `SVGService` and Webpack/Vite/Rollup/Babel/Jest integrations use the same resolver:
built-in defaults, configuration file, then integration/request configuration and explicit
integration fields. Public compatibility entrypoints and their established option names remain in
place.

Configuration explanations use the same resolution path as execution. Values under paths whose
names indicate tokens, secrets, passwords, credentials, or API keys are redacted.

## Failure and determinism behavior

Invalid framework, optimization, limit, and recognized enum settings fail with actionable stable
diagnostics before source processing. Unknown top-level settings fail rather than being silently
ignored. Security validation remains fail-closed and runs independently of optimization settings.
At this checkpoint, `frameworkOptions.scriptSetup` is supported for Vue and
`frameworkOptions.standalone` for Angular; other framework-option keys or cross-framework uses are
rejected instead of being silently ignored.

Optimizer stage exceptions produce `E_OPTIMIZER_STAGE_FAILED` with the original exception retained
as `cause`; plugin hook exceptions produce `E_PLUGIN_HOOK_FAILED`. Neither stage logs exception
details or treats failure as successful output. Compiler builds select an optimizer pipeline per
generation request, so concurrent builds with different optimization levels cannot mutate one
another's settings. The existing cache fingerprint includes the resolved configuration and
optimization level; repeated builds therefore reuse only equivalent generated content.

Public diagnostics redact credential-shaped assignments in messages, file/hint fields, metadata,
and logger output. JSON, NDJSON, and pretty report formatting apply the same redaction to supplied
diagnostic objects. Sanitized exceptions retain the original error as `cause` for programmatic
debugging; report schemas serialize only the safe diagnostic fields and never serialize a cause.
This redaction protects labeled credential values; it is not a general-purpose scrubber for
arbitrary unlabeled strings.

Compiler-service builds do not commit any component or barrel output when generation of any item
fails, including failures after earlier items completed. Batch integrations generate in a private
staging directory and commit only after every component and the index succeeds. A failed generation
cleans the temporary stage and leaves any existing output files untouched; transaction journals
are created only when the commit phase starts.

Output planning/order and transactional commit behavior remain governed by the Phase 00.3 artifact
manifest and Phase 00.1 output transaction contracts.

## Regression coverage and remaining gates

`tests/phase0/configuration-pipeline-consistency.test.mjs` covers recursive precedence, explicit
falsy values, frozen snapshots, secret redaction, actionable invalid settings, optimizer/plugin
causes, supported framework/language override behavior in Vite/Rollup/Webpack, cache-hit
equivalence, repeated builds, concurrent optimization settings, redaction through CLI and report
renderers, and late optimizer/plugin failures through the compiler service and Vite batch integration.
The late-failure cases verify existing outputs remain unchanged and temporary transaction artifacts
are cleaned. The entrypoint safety matrix also verifies that build-tool hooks fail the build instead
of swallowing containment errors. Existing integration, cache, recovery, generator, semantic,
visual, and package suites remain required.

CFG-001 and CFG-002 have focused regression evidence under Directive 007B. Phase 00.6 was approved
under Engineering Review 017. QG-002 was closed during Phase 00.8 with zero lint errors and a
budgeted, explicitly allowed warning category. SEC-INC-001 remains open under the management-
approved security exception; release and publishing with the exposed credentials remain blocked.
