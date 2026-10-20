# Phase 02.5 — Parser Performance and Resource Qualification

Status: benchmark execution complete on Node 18.20.6 and 24.13.1. Review 029 accepted the
measurements as reference-host characterization only. They do not select a production parser or
authorize Phase 03. The Phase 02.6 contract and non-selection decision are recorded in the
[decision record](phase2-parser-decision.md).

## Reproduction and limits

The deterministic corpus and driver are in
[`performance-fixtures.mjs`](../experiments/phase2/performance-fixtures.mjs),
[`performance-worker.mjs`](../experiments/phase2/performance-worker.mjs), and
[`run-performance-qualification.mjs`](../experiments/phase2/run-performance-qualification.mjs). The
complete machine-readable observations are in
[`performance-results.json`](../experiments/phase2/performance-results.json).

From a clean checkout with the locked development dependencies installed and `dist/` built, run:

```sh
node experiments/phase2/run-performance-qualification.mjs \
  --node18=/absolute/path/to/node-v18.20.6/bin/node \
  --node24=/absolute/path/to/node-v24.13.1/bin/node \
  --output=experiments/phase2/performance-results.json
```

The runner excludes fixture construction and module loading from the timed region. Each
fixture/configuration/runtime pair runs in a disposable child with `--expose-gc`,
`--max-old-space-size=384`, and a 45-second watchdog. Cold means the first document operation after
module/fixture initialization in that child; warm samples follow in the same process. A single-op
memory child holds each representation across a forced GC to estimate retained structure, then
releases it and measures cleanup. On Linux, process peak RSS comes from `/proc/self/status` `VmHWM`;
heap high-water samples are taken after operations and can miss intra-operation peaks. Memory
figures are measurements, not assertions or cross-machine promises.

The comparison separates the current security scanner, scanner plus Saxes events without a tree,
scanner plus the Saxes qualification adapter/tree, xmldom parse-to-DOM, xmldom plus a full DOM walk,
and scanner plus the source-span index. xmldom's public `DOMParser` always materializes a DOM, so a
parser-only/no-DOM xmldom configuration is not available; parse-to-DOM and parse-plus-walk are
reported separately rather than implying that the DOM cost can be removed.

## Deterministic corpus

Seed: `0x5a17c0de`. Sizes are UTF-8 bytes; counts include the outer SVG element. The near-depth
fixture reaches depth 242 against the unchanged scanner ceiling of 256. The near-byte fixture is
9,437,286 bytes (about 90% of the 10 MiB input cap).

| Fixture          |     Bytes | Elements | Attributes | Max depth | Warm iterations per configuration |
| ---------------- | --------: | -------: | ---------: | --------: | --------------------------------: |
| Small            |        85 |        2 |          3 |         2 |                               100 |
| Medium           |       642 |       16 |         10 |         4 |                               100 |
| Large            |   187,267 |    4,921 |      9,721 |         3 |                                30 |
| Text-heavy       |    16,947 |      321 |        161 |         3 |                                50 |
| Attribute-heavy  |   199,295 |      193 |     11,617 |         3 |                                30 |
| Near-depth-limit |     1,748 |      242 |          2 |       242 |                                10 |
| Near-byte-limit  | 9,437,286 |        1 |          1 |         1 |                                 2 |

Rejected fixtures cover a mismatched tag, depth 257, external DTD/entity declaration, active script,
and input above 10 MiB. Scanner, adapter, and xmldom paths all reject these before candidate
construction and report the same established security-boundary error code. The isolated raw-parser
cleanup characterization additionally repeated a malformed document ten times: Saxes emitted a
handled parse error; xmldom threw a parse error that the worker caught. These raw-parser probes
bypass the scanner only to characterize parser cleanup and are not an admitted application path.

## Latency and throughput

All values below are warm per-document median milliseconds; each cell is Node 18.20.6 / Node
24.13.1. The complete report also records cold first-operation latency, warm elapsed time, and
documents/second. p95 is included when at least 20 warm observations exist; p99 is included only for
the 100-iteration small and medium workloads. The near-limit fixture has two warm samples, so its
reported median/throughput is a coarse observation, not a tail-latency estimate.

| Configuration                 | Large, 187 KB | Attribute-heavy, 199 KB | Near-depth, 242 | Near-byte, 9.44 MB |
| ----------------------------- | ------------: | ----------------------: | --------------: | -----------------: |
| Security scanner              |   7.84 / 6.37 |             5.44 / 4.70 |     0.90 / 0.49 |      50.31 / 55.16 |
| Scanner + Saxes events        |  10.79 / 8.90 |             7.86 / 6.74 |     1.27 / 0.91 |      72.32 / 89.11 |
| Scanner + Saxes adapter/tree  | 22.64 / 20.69 |           16.28 / 14.71 |     1.49 / 1.20 |    275.37 / 269.93 |
| Scanner + xmldom parse-to-DOM | 16.34 / 14.49 |            11.91 / 9.93 |     1.90 / 1.43 |      66.58 / 71.31 |
| Scanner + xmldom DOM walk     | 16.17 / 14.75 |           13.11 / 10.79 |     1.85 / 1.39 |      66.64 / 71.63 |
| Scanner + source-span index   | 13.31 / 13.13 |             9.21 / 8.76 |     0.89 / 0.63 |      53.53 / 59.47 |

Near-byte warm throughput was 3.37/3.64 documents per second for the Saxes adapter, 12.48/14.02 for
xmldom parse-to-DOM, and 15.55/18.13 for the scanner (Node 18 / Node 24). Processing one 9.44 MB
text fixture through the adapter is materially more expensive than admission alone, but remained
bounded in the disposable process. No ranking should be inferred from sub-millisecond small-fixture
differences.

The source-span index initially measured roughly 370–466 ms on the 187–199 KB element/attribute
fixtures. Inspection found that each attribute's entity scan continued traversing the remainder of
the document. The experimental index now scans only that attribute's source slice; it measured
13.31/13.13 ms for the large fixture and 9.21/8.76 ms for the attribute-heavy fixture. This
correction is confined to `experiments/phase2/`; it does not affect production code or scanner
policy.

## Memory and resource behavior

Single-document retained-structure estimates are MiB above a forced-GC baseline. Peak RSS is the
increment above the process's pre-operation RSS, measured by Linux `VmHWM`. Values are Node 18 /
Node 24.

| Fixture / configuration    | Retained heap estimate | Incremental peak RSS |
| -------------------------- | ---------------------: | -------------------: |
| Large / scanner            |        0.09 / 0.11 MiB |      21.5 / 24.6 MiB |
| Large / Saxes adapter tree |        2.65 / 2.65 MiB |      27.5 / 31.5 MiB |
| Large / xmldom DOM         |        6.77 / 6.90 MiB |      27.4 / 35.9 MiB |
| Large / source spans       |        2.79 / 2.82 MiB |      30.5 / 36.8 MiB |
| Near-byte / scanner        |        0.07 / 0.06 MiB |      26.1 / 27.1 MiB |
| Near-byte / Saxes adapter  |        0.12 / 0.12 MiB |      26.1 / 26.8 MiB |
| Near-byte / xmldom DOM     |        0.13 / 0.14 MiB |      25.7 / 27.9 MiB |
| Near-byte / source spans   |        0.08 / 0.08 MiB |      26.1 / 27.1 MiB |

The near-byte case is predominantly one large text node; its source string is already resident
before the per-operation baseline, so the retained-heap delta is not the document's total memory.
The large structural fixture makes the tree cost visible: the adapter retains about 2.7 MiB, while
xmldom retains about 6.8–6.9 MiB for the same 187 KB source. Allocation/high-water behavior during
30 repeated large-document operations was more variable than the one-document retained estimate,
particularly for source spans on Node 24. Forced-GC cleanup deltas were usually small but not
uniformly zero; V8 heap/RSS high-water and post-GC values are environment-sensitive. Repeated
malformed-parser probes completed without child hangs or uncaught worker failures.

No allocation curve within accepted input/depth/element/attribute limits indicated unbounded growth.
These fixtures do not prove safety under arbitrary concurrent same-process parsing: the runner
serializes each workload and constrains each child to a 384 MiB V8 old-space ceiling. The 10 MiB
scanner input cap, depth/element/per-element-attribute limits, and security policy were not relaxed.

## Qualification findings and proposed Phase 03 baseline

- The Saxes event-only path adds moderate parse cost after admission. Building the ordered adapter
  tree costs more: about 20–23 ms for the 187 KB / 4,921-element case and about 270–275 ms for the
  9.44 MB text case on this host.
- xmldom is faster than the tree adapter on the large structure fixture and has a larger retained
  tree. Its public DOM API does not offer a no-tree mode, and its malformed-input limitations and
  maintenance/security review remain independent selection blockers.
- Depth 242 did not create a latency or memory discontinuity. Attribute-heavy and element-heavy
  fixtures increased adapter/tree allocation roughly with structure size. Near-byte text scanning
  was roughly linear in input size for all measured paths.
- The experimental source index now behaves approximately linearly on the measured fixtures; its
  single-document retained metadata is comparable to the Saxes tree on the large fixture.
- This evidence supports predictable bounded behavior on a single document under the current
  admission limits. It does not resolve Saxes' archived-upstream status, xmldom strictness, the Node
  18.17 exact floor, production dependency security, or concurrent batch memory behavior.

Candidate Phase 03 reference guardrails for management review—not enabled gates—are: ≤30 ms p95 for
the 187 KB / ~5k-element structural fixture, ≤350 ms observed median for a 9.44 MB near-cap text
fixture, ≤3.2 MiB retained structural heap for the large fixture, and ≤40 MiB incremental peak RSS
for one parse on this reference host. These round the slower observed Saxes-adapter values upward
with headroom. The near-cap latency had only two warm samples, so any hard gate must first increase
that sample count and repeat on a clean controlled host. A concurrent compiler budget cannot be set
until Phase 03 defines batch concurrency and lifetime of retained IR.

The optional `sharp` visual-diff/rasterization path remains restricted: do not process untrusted SVG
inputs through it until the inherited native dependency advisories are remediated or a separately
reviewed safe policy is approved. This is a documented operational restriction, not a code/API
change.

## Verification and decision boundary

On the clean qualification checkout, `npm run quality:full`, `npm run test:phase2:parser`, and
`npm run package:conformance` passed with Node 18.20.6 / npm 10.8.2. Package conformance contained
754 files and measured 634,254 bytes, below the existing 640,623-byte cap. The parser suite also
passed on Node 24.13.1 after the source-span index correction. `git diff --check` passed on
2026-10-19.

This work changes only `experiments/phase2/` and Phase 02 documentation. Production parsing, public
API, generators, optimizers, output contracts, dependency versions, scanner limits, and release
authorization remain unchanged. Phase 02.5 is accepted as reference characterization. Phase 02.6 has
completed its internal contract and no-selection decision; Phase 03 remains unauthorized. See the
[Phase 02.6 decision record](phase2-parser-decision.md).
