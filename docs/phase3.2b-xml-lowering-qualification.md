# Phase 03.2B — Structural XML-to-IR Lowering and Ownership Qualification

Status: Directive 015 experimental work completed; results submitted for management review. This
does not authorize Phase 03.3 or production compiler integration.

## Boundary and lowering contract

`experiments/phase3/lower-xml-to-ir.ts` consumes the implementation-neutral `SourceDocument` and
`XmlDocument` types in `experiments/phase2/parser-contract-v1.ts`. It imports no parser package,
Saxes event, xmldom node, production compiler module, or filesystem service. Its fixture adapter
first passes source through the existing `applySVGInputSafety` reject-mode boundary and confirms the
source is unchanged. It then constructs a controlled Phase 02 contract document with exact token
spans. The lowerer itself is not an admission boundary and does not parse raw source.

The lowerer retains document prolog/epilog comments, ordered attributes and mixed children, expanded
names and original QNames, decoded text, separate CDATA/comment nodes, and only qualified source
spans. It validates namespace bindings (including the rule that default namespaces do not apply to
unprefixed attributes), element and attribute QNames, source ranges, start/end token names,
attribute uniqueness, dense ordering, and Phase 02 input/depth/element/attribute/text ceilings. A
missing span becomes `unknown` provenance; no offset is inferred from a QName or decoded value. The
test fixture also checks a non-BMP character to distinguish UTF-16 code-unit offsets from UTF-8 byte
offsets.

The controlled lowering fixture covers inherited/reset `xml:space`, namespaced `xlink:href`, title
and ARIA content, duplicate IDs, resolved/ambiguous/unresolved references, opaque SVG extension
elements/attributes, inline CSS, comments, entity-decoded text, CDATA, and percentage geometry. CSS
remains `lexically-retained`; geometry remains authored `opaque` or `unresolved` when absent; the
reference graph is `partial`; unknown features are not treated as unused. Semantic values carry an
`authored`, `inferred`, or `not-established` evidence label where applicable. The fixture verifies,
for example, that an explicit `xml:space="default"` is authored while an inherited child state is
inferred. It does not claim full SVG/CSS semantics or rendering equivalence.

The current admission scanner rejects unknown foreign namespace declarations, so the executable
admitted fixture uses an unknown element in the SVG namespace. The IR's `foreign-opaque` variant is
still representable, but foreign-namespace admission is not established by this experiment.

## Ownership experiment

Two publication modes are compared:

- `copy`: lower into fresh mutable IR records, then validate, defensively clone, and deep-freeze the
  published graph. Mutating the Phase 02 input after publication does not affect the IR.
- `share-verified-immutable`: require the source and XML contract document to be deeply frozen;
  share immutable expanded-name records, lower all other structures into owned records, then
  validate and freeze those owned records in place. Mutable inputs are rejected. Tests prove shared
  object identity survives publication in this mode.

The validator no longer equates all aliasing with error. Verified deeply frozen aliases are
accepted; copy mode defensively reproduces them as separate records. Cycles and repeated mutable
objects remain invalid. This is an experiment, not a general persistent-data-structure
implementation: only expanded name records are shared, not complete XML nodes or mutable sidecars.
Weak-reference checks after scope exit and explicit GC observed both published results becoming
collectible; no module-level document or result cache exists.

## Resource characterization

Run with `--expose-gc` to report allocation deltas before collection, retained `heapUsed` deltas
after two GC checkpoints, per-stage timings, shared-name identity, and weak-reference release
observations. The synthetic fixture is 700 child elements plus an SVG root and a 9,036-byte source.
Source text, contract structure, lowering, sidecar construction, and validation/publication are
sampled separately. These are process heap observations, not object-size measurements; runtime/GC
movement can make a post-GC delta small or negative. They are informational and establish no
threshold or scaling coefficient.

One Node `20.20.2` sample:

| Stage                | Defensive copy: allocation / retained delta | Verified sharing: allocation / retained delta |
| -------------------- | ------------------------------------------: | --------------------------------------------: |
| Source               |                     167,240 / 280,408 bytes |                        93,096 / 235,584 bytes |
| XML structural input |                      514,816 / 95,552 bytes |                       514,352 / 258,432 bytes |
| XML-to-IR lowering   |                   2,193,728 / 550,000 bytes |                     4,450,144 / 241,592 bytes |
| Semantic sidecars    |                     739,240 / 221,984 bytes |                       740,752 / 463,048 bytes |
| Validate and publish |                 6,514,616 / 2,431,952 bytes |                     5,693,752 / 219,472 bytes |

Allocation samples include transient garbage between checkpoints; post-GC retained deltas are
relative to the prior stage and are sensitive to V8 heap reuse. In this run, immutable sharing
preserved name identity and had lower retained deltas for the source, lowered structure, and
publication stages, but higher retained deltas for the structural input and sidecars. It also had
higher lowering allocation and was slower in the measured lowering stage. The noisy data do not
justify a production ownership policy. The test prints current-run results so the table is a
reproducible example, not a universal benchmark claim.

## Reproduction and verification

On Node `20.20.2` / npm `10.8.2`, the following focused sequence passed:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts --outDir experiments/phase3/.build --rootDir experiments --module ES2022 --moduleResolution Bundler --target ES2022 --strict --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node --expose-gc tests/phase3/ir-v1-conformance.test.mjs
node --expose-gc tests/phase3/xml-to-ir-lowering.test.mjs
npm run test:svg-security-corpus
npm run test:phase2:parser
npm run quality:full
```

The temporary TypeScript output is under ignored `experiments/phase3/.build/`, not `dist/`, so it
cannot enter the package archive. The focused Phase 03 tests report their measurements and
assertions without thresholds. The existing Phase 00 security corpus and Phase 02 parser
qualification passed as separate compatibility checks. `quality:full` passed locally, including
TypeScript, the approved lint budget (zero errors and 14 approved warnings), 155 Jest tests,
unit/config/E2E/integration suites, Phase 00, Phase 01, and package smoke. Package smoke produced
754 files at 634,254 bytes. This is local working-tree evidence, not a clean-checkout remote CI
result.

## Limits and decision boundary

This establishes that a controlled structure satisfying the Phase 02 contract lowers into the
approved IR vocabulary with tested namespace, ordering, evidence-state, and provenance behavior. It
does not establish that any XML parser produces a fully qualified `XmlDocument`, that all parser
token spans are accurate, that foreign namespace documents pass current admission, or that sidecar
analysis is complete. It adds no runtime/development dependency, production parser, generated
artifact, framework behavior, public API, package export, or default configuration. Phase 03.3
shadow generation remains unauthorized.
