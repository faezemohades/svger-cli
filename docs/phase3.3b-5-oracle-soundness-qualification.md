# Phase 03.3B-5 — Oracle Soundness and Static Compatibility Qualification

Status: Directive 024 qualification accepted in Engineering Review 044. Its result remains
experimental static evidence; it does not authorize candidate generation, promotion, production
routing, or a parser selection. Directive 025 follow-up is recorded in
[the 03.3B-6 qualification](phase3.3b-6-oracle-robustness-qualification.md).

## 1. Result model

The oracle contract now reports three separate questions:

| Result              | Field                                                            | Meaning                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extraction coverage | `analysisStatus`, `coverageStatus`, and per-dimension `coverage` | Whether the bounded grammar accounted for the relevant observed syntax. `analysisStatus` is the extraction result; legacy `status` remains an alias. `complete` is not a correctness claim.              |
| Semantic validity   | `validity.status` and bounded `validity.issues`                  | `valid`, `invalid`, or `unresolved`; duplicates and ambiguous targets are invalid, while dangling/external references and incomplete analysis are unresolved.                                            |
| Comparison outcome  | Edge/report `outcome`                                            | `match` requires equal complete projections and valid observations; `mismatch` means a semantic projection differs or an observation is invalid; `inconclusive` means evidence is partial or unresolved. |

A fully covered duplicate-ID document therefore remains `coverageStatus: complete` but has
`validity: invalid`. A fully covered document with a dangling local reference remains complete but
has `validity: unresolved`. Neither can produce a matching/promotion-eligible comparison.
Unsupported syntax lowers coverage and leaves validity unresolved rather than treating omitted
behavior as valid.

Directive 024 introduced source oracle v2, Svelte artifact oracle v3, capture/qualification v4, and
three-way artifact comparison v3. Directive 025 subsequently versions the hardened contracts as
source oracle v3, Svelte artifact oracle v4, capture v5, qualification v5, and comparison v4. The
historical 03.3B-4 record continues to describe the earlier v1/v2 contracts.

## 2. Text and namespace soundness

The qualification tests independently constructed source and artifact fixtures for:

- equivalent predefined/numeric character-reference spelling;
- source CDATA lowered to equivalent emitted character data; Svelte's parser rejects CDATA markup in
  the artifact, so that form returns unresolved analysis rather than an invented projection;
- mixed text around nested `<tspan>` nodes, where moving text across the element boundary changes
  the text projection and blocks the Source→Candidate edge;
- whitespace-preserving text, where trimming changes the projection;
- effective `xml:space`, including an explicit mode mutation;
- namespace prefix substitution, which remains equivalent after expanded-name resolution, and a
  namespace-URI change, which remains partial or mismatched rather than normalized away.

Adjacent parser text chunks are coalesced only within the same element path and effective whitespace
mode. Nested-element position/order remains represented by paths and ordered records. Character data
content is compared after XML decoding; CDATA lexical delimiters are not claimed as semantic content
and original source remains the lexical authority outside this oracle.

## 3. Reference integrity and coverage soundness

Validity is independently derived on both source IR and Svelte AST observations:

- duplicate IDs and ambiguous local/ARIA targets produce `invalid` evidence;
- dangling local references and unresolved ARIA IDREF tokens produce `unresolved` evidence;
- external references remain unresolved within the no-browser-resolution contract;
- unsupported attributes, namespace bindings, CSS URL references, dynamic syntax, and incomplete
  parser observations lower coverage and cannot be promoted as complete matches.

Issue records contain stable codes and states only; the comparison report does not expose source,
artifact text, paths, or raw values. `promotion-not-authorized` remains unconditional.

## 4. Compatibility evidence

The three comparison edges remain separate and include extraction, validity, and comparison
outcomes:

| Edge              | Evidence source                                                                  | Interpretation                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Source→Legacy     | Admitted source lowered to IR versus independently parsed legacy Svelte output   | Measures legacy compatibility only for the declared static subset; legacy dynamic props/spreads can make coverage partial. |
| Source→Candidate  | Same admitted source versus caller-supplied Svelte artifact parsed independently | Detects candidate mutations; this is not candidate generation or execution.                                                |
| Legacy↔Candidate | Independently parsed artifact projections                                        | Compares the two outputs without using source projection as either artifact's parser result.                               |

Positive prefix/attribute-order and lexical-equivalence fixtures match. ID, IDREF, namespace,
text-order/boundary, geometry, accessibility, and `xml:space` mutations block their respective
edges. Identical projections with invalid or unresolved references are explicitly `mismatch` or
`inconclusive`, never `match`.

## 5. Reproduction and verification

Run after the locked dependencies are installed:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts \
  --outDir experiments/phase3/.build --rootDir experiments \
  --module ES2022 --moduleResolution Bundler --target ES2022 --strict \
  --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node tests/phase3/shadow-capture-qualification.test.mjs
node tests/phase3/shadow-comparison-harness.test.mjs
```

On 2026-10-19, Node 20.20.2 with Svelte 4.2.19 passed the focused capture/oracle qualification,
03.3A comparison harness, and Phase 03 parser-to-IR differential suites. `npm run quality:full`
passed, including lint at 0 errors/14 approved warnings, Phase 00/01 suites, and offline package
smoke. `npm run package:conformance` passed with 754 files and a 634,361-byte archive, 6,262 bytes
below the 640,623-byte cap. Prettier and `git diff --check` passed. These are local working-tree
results, not remote CI or clean-checkout certification.

## 6. Authorization boundary

Directive 024 changes are limited to experimental oracle/comparison modules, associated tests, and
qualification documentation. No `src/` code, dependencies, package exports, public API, candidate
emitter, framework runner, production parser, production route, or publishing policy is changed.
Phase 03.3B candidate generation, Phase 03.4 migration, Phase 03.5 default switch, promotion, and
publishing remain unauthorized.
