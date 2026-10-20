# Phase 03.3B-6 — Oracle Robustness and Qualification Gate

Status: Directive 025 implementation and local qualification complete. Results remain experimental;
this gate does not authorize candidate generation, promotion, production routing, or publishing.

## 1. Gate contract and schema versions

The evidence pipeline now rejects inconsistent state before comparing projections. Current
experimental schemas are source oracle v3, Svelte artifact oracle v4, capture v5, qualification v5,
and three-way artifact comparison v4. The capture analyzer identity is checked against the current
artifact-oracle version (4.0.0); incompatible or stale evidence is not compared as semantic output.

The comparison outcomes remain `match`, `mismatch`, and `inconclusive`. A positive edge requires
complete coverage in every required dimension, valid semantics on both sides, equal canonical
projection digests, and valid artifact provenance. A malformed capture is replaced for comparison
with a bounded failed envelope; it cannot contribute its supplied projection or artifacts to a
partial positive result.

## 2. Structural enforcement

| Invariant            | Enforcement                                                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema compatibility | Exact source/artifact/capture schema and analyzer identity checks; old or incompatible capture records are rejected before semantic comparison.                                                                                     |
| Coverage state       | Exact six-dimension set and allowed values; aggregate `coverageStatus` must agree with the per-dimension states.                                                                                                                    |
| Analysis state       | `analysisStatus`, compatibility `status`, `coverageStatus`, projection presence, and validity must form an allowed state combination. Invalid parser results require unresolved coverage, null projection, and unresolved validity. |
| Projection integrity | Required projection shape is checked; the canonical SHA-256 must match the observed projection.                                                                                                                                     |
| Validity integrity   | Issue records are bounded to safe diagnostic codes and allowed states, sorted, unique, and consistent with `valid`/`invalid`/`unresolved`.                                                                                          |
| Artifact provenance  | Exactly one captured Svelte artifact is required; its content and path digests, analyzer name/version, parser version, framework scope, and static-only scope are verified.                                                         |
| Capture provenance   | Only same-process frozen capture records are trusted. Clones/deserialized objects and malformed array entries are sanitized and fail closed.                                                                                        |
| Comparison policy    | `match` requires all dimension comparisons to match and both validity states to be valid. Invalid observations yield mismatch; unresolved or incomplete observations yield inconclusive. Promotion remains unconditionally blocked. |
| Report safety        | Reports contain fixed failure/mismatch codes, digests, bounded state values, and sorted lists; no SVG text, generated content, filesystem paths, or raw diagnostic messages are returned.                                           |

`validateOracleAnalysis()` exposes the pure experimental state validator for direct adversarial
tests. It does not confer trust: `compareQualifiedCaptures()` separately requires capture provenance
from the in-process capture API.

## 3. Adversarial and metamorphic evidence

`tests/phase3/shadow-capture-qualification.test.mjs` now covers:

- invalid coverage aggregation, valid-state contradictions, stale schema, malformed projection
  shape/digest, and attempted coverage upgrades;
- complete extraction paired with duplicate/ambiguous references (`invalid`) and dangling references
  (`unresolved`), with no positive comparison outcome;
- unsupported attributes, namespace rebinding, CSS references, and dynamic syntax remaining partial
  or unresolved rather than being silently treated as a complete match;
- accepted namespace-prefix and lexical-equivalence transformations, alongside ID/IDREF, namespace
  URI, text-boundary/order, whitespace, `xml:space`, geometry, and accessibility mutations;
- cloned, stale-schema, null, and malformed capture records failing closed without being reported as
  actual semantic mismatches;
- deterministic report ordering, redaction, input-capture immutability, and false promotion on all
  failure paths.

The three comparison relationships remain independent: Source→Legacy, Source→Candidate, and
Legacy↔Candidate. A legacy/candidate match cannot mask a source invariant lost by both outputs.

## 4. Enforcement versus evidence and assumptions

Structurally enforced: state validation, canonical digest binding, exact schema/analyzer identity,
same-process capture provenance, bounded diagnostic vocabulary, deterministic sorting, report
redaction, and the promotion prohibition.

Test-supported rather than exhaustive: semantic correctness of each projection for every legal
combination in the declared SVG grammar; completeness of the metamorphic fixture matrix; and
correctness of the existing XML and Svelte parsers. The tests are selected adversarial evidence, not
a proof of all SVG behavior.

Caller/environment assumptions: admitted source must still come through the existing security
boundary; candidate artifacts are supplied data and are parsed but never evaluated; the native
Svelte compiler subprocess is the existing bounded validation mechanism, not a sandbox for arbitrary
candidate code. This work adds no filesystem sandbox, renderer, runtime evaluator, or candidate
emitter.

## 5. Reproduction and local verification

Run after dependencies are installed:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts \
  --outDir experiments/phase3/.build --rootDir experiments \
  --module ES2022 --moduleResolution Bundler --target ES2022 --strict \
  --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node tests/phase3/shadow-capture-qualification.test.mjs
node tests/phase3/shadow-comparison-harness.test.mjs
node tests/phase3/parser-to-ir-differential.test.mjs
npm run quality:full
npm run package:conformance
```

Verification was run on 2026-10-19 with Node 20.20.2 and Svelte compiler 4.2.19. Focused Phase 3
capture/oracle, comparison-harness, and parser-to-IR suites passed. `quality:full` passed with 0
lint errors and the existing 14 approved warnings. Package conformance passed at 754 files / 634,361
bytes, 6,262 bytes under the 640,623-byte cap. Prettier and `git diff --check` passed. These are
local working-tree results; no remote CI or clean-checkout certification is claimed.

## 6. Authorization boundary

Directive 025 changes are confined to experimental oracle/capture modules, tests, and this
qualification record. No `src/` code, dependency, package export, public API, production parser,
candidate emitter, dynamic evaluator, browser renderer, filesystem sandbox, production route, or
publishing policy is changed. Full 03.3B candidate generation, Phase 03.4 migration, Phase 03.5
default switch, promotion, and publishing remain unauthorized.
