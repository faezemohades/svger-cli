# Phase 03.2A — Isolated Compiler IR v1 Prototype

Status: Phase 03.2A was accepted by Engineering Review 034. This document records the original
representation-only checkpoint; subsequent parser-contract lowering and ownership qualification is
recorded in [the Phase 03.2B report](phase3.2b-xml-lowering-qualification.md). Neither report
authorizes production compiler work or Phase 03.3.

## Boundary and fixture method

`experiments/phase3/ir-v1.ts` defines an experimental, versioned, parser-independent IR and a
runtime publication validator. It is outside `src/`, is not exported by the package, and adds no
dependency. It models ordered elements/attributes/children, expanded names and QNames,
source/generated/unknown provenance, text/CDATA/comments, known/unknown/foreign-opaque
interpretation tags, and typed resolved/unresolved/opaque/invalid values. Analysis sidecars keep
root geometry, ID definitions, reference coverage and outcomes, CSS declarations/coverage, and
accessibility metadata distinct from the syntax-like tree.

`tests/phase3/ir-v1-conformance.test.mjs` is a controlled fixture adapter, not an XML parser. It
first sends source through the existing `applySVGInputSafety` reject-mode boundary, requires the
source to remain byte-for-byte unchanged, and only then builds the explicitly-authored structural
records. There is no route from raw input to an experimental parser. The Phase 00 safe and rejected
security corpora are also run through the same boundary to check established admission outcomes.

The current security boundary rejects unknown namespace declarations. Accordingly, the admitted
opaque-extension fixture uses an unknown SVG element and opaque attribute; the schema has a
`foreign-opaque` state, but no claim is made that foreign-namespace source is currently admissible.
The prototype does not parse XML, establish semantic truth from source, resolve the CSS cascade, or
serialize IR back to markup. Semantic sidecar values are fixture-authored examples of the approved
state vocabulary.

## Runtime invariants and ownership

`validateAndFreezeIR(unknown)` checks the exact IR version, source metadata and UTF-8 byte length,
root SVG namespace/name, node and attribute shapes, expanded-name/QName consistency, semantic state
variants, ordered arrays, supported reference/coverage variants, CSS declaration ordering, traversal
ceilings, and provenance spans. Every source span is UTF-16 with an exclusive end and is verified
against the exact retained source slice. Cycles, shared mutable object aliases, non-data values,
non-finite numbers, malformed records, excessive depth/counts, and invalid source slices fail
closed. The validator defensively clones and deeply freezes the published result; it does not freeze
or retain the caller's mutable fixture object. It validates representation invariants, not XML
parsing, security admission, or the semantic correctness of fixture-authored interpretations.

No process-global document state or result cache is used. Ordering is preserved as supplied; the
prototype does not sort or normalize authored content. Tests cover text/CDATA ordering, inherited
and overridden `xml:space` states, `xlink:href` expanded names, unknown SVG content, duplicate IDs,
unresolved/opaque references, declaration order and `!important`, percentage geometry, accessible
title and ARIA attributes, deterministic reconstruction, mutation isolation, and bad-span/version
rejection. A hostile script fixture and every Phase 00 rejected corpus case retain their established
admission error codes.

## Verification and memory characterization

Verified on Node `20.20.2` / npm `10.8.2`:

```sh
npm run build
npx tsc experiments/phase3/ir-v1.ts experiments/phase3/lower-xml-to-ir.ts --outDir experiments/phase3/.build --rootDir experiments --module ES2022 --moduleResolution Bundler --target ES2022 --strict --noUnusedLocals --noUnusedParameters --skipLibCheck --types node
node --expose-gc tests/phase3/ir-v1-conformance.test.mjs
node --expose-gc tests/phase3/xml-to-ir-lowering.test.mjs
npm run test:phase2:parser
npx prettier --check experiments/phase3/ir-v1.ts tests/phase3/ir-v1-conformance.test.mjs
```

The Phase 02 parser qualification suite passed as a compatibility cross-check; the prototype does
not import or route through either experimental parser. The Phase 00 safe/rejected security corpus
passed inside the Phase 03.2A conformance test. Prettier passed on the final files.

One informational retained-heap sample used a 20,536-byte UTF-8 synthetic admitted SVG with 1,201
element records (root plus 1,200 children), source spans and attributes, and a defensively copied IR
held together after explicit GC. Recent incremental `heapUsed` deltas ranged from 5,044,504 to
5,126,504 bytes, with the latest at 5,126,504 bytes. These are noisy characterization samples,
include runtime/object overhead, and are not a threshold or a per-input scaling claim. The test
emits the sample only when run with `--expose-gc`; it stores no persistent state, and all references
are local to the test block for ordinary process-lifetime cleanup.

## Limits and next gate

This prototype proves that the approved schema vocabulary can represent the selected admitted
fixtures and that publication validation enforces structural/provenance invariants. It does not
prove a production parser, a source-to-IR interpreter, complete XML or SVG semantic correctness,
foreign namespace admission, rendering equivalence, framework compatibility, production lifecycle
budgets, or production readiness. It changes no production artifacts, framework templates, public
API, dependencies, package exports, or default pipeline. Phase 03.3 shadow generation and all
production integration remain unauthorized pending a separate management decision.
