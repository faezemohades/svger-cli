# Phase 00.7 — Concurrency and Resource Lifecycle Inventory

Status: Phase 00.7 approved and closed under Engineering Review 019. QG-002 is closed by the Phase
00.8 lint policy. SEC-INC-001 remains open; package publishing remains prohibited until the exposed
credentials are revoked and account activity reviewed.

## Resource ownership and lifetime

| Resource                                         | Owner and lifetime                                                                                                  | Initial risk                                                                                                                                       | Current handling                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Output transaction staging directory and journal | One `commitOutputTransaction` call; normally removed on completion, retained after incomplete rollback for recovery | Concurrent transactions could snapshot/rename the same final paths in an interleaved order                                                         | In-process FIFO lock keyed by resolved output directory serializes the full commit lifecycle. Recovery journals remain the crash-recovery authority. This is not a cross-process lock.                                                                          |
| Cache write temporary file                       | One cache write                                                                                                     | `${pid}`-only names collided for concurrent writes of the same key                                                                                 | Each write uses a UUID-qualified temporary name and removes it in `finally`.                                                                                                                                                                                    |
| Content-addressable cache entries                | Cache directory lifetime                                                                                            | No count or byte ceiling                                                                                                                           | Eviction removes oldest regular cache entries until the configured/default entry and byte limits are met. Defaults are 1,000 entries and 256 MiB; callers may set lower positive safe-integer limits.                                                           |
| Performance-engine result cache                  | `PerformanceEngine` instance lifetime                                                                               | Unbounded map; expired entries were only removed when read by key                                                                                  | 500-entry LRU bound, five-minute expiry checked on access, plus explicit `clearCache()`.                                                                                                                                                                        |
| Processor job history                            | `SVGProcessor` instance lifetime                                                                                    | One cleanup timer per successful job and a large queue safety cap                                                                                  | No delayed timer. Active jobs remain visible; recent completed history is bounded to 500 records. Failed jobs are removed immediately.                                                                                                                          |
| Bounded-scheduler workers                        | One build batch                                                                                                     | `Promise.all` could reject before other already-started workers settled; workers could continue claiming queued work                               | A first worker failure stops new claims; all in-flight workers settle before the scheduler propagates failure. The application commits outputs only after successful generation completion.                                                                     |
| File watcher and debounce timers                 | `FileWatcherService` watcher registration                                                                           | Watcher, handler, and timer retention depends on explicit stop/shutdown                                                                            | `stopWatching` clears debounce timers and handler references; `shutdown` stops owned watchers. Consumers must call the provided stop/dispose operation.                                                                                                         |
| Watch abort listeners and in-flight watch jobs   | `SVGService` watch registration/event                                                                               | Manual stop did not itself cancel a current event; registration signal listener could outlive manual stop                                          | Manual stop removes the abort listener and aborts that watch's active processing controllers. Active job identity includes watcher ID and file path, so overlapping registrations remain isolated. File-watcher callbacks check registration before dispatch.   |
| Webpack watch debounce timer                     | Webpack plugin instance/watch lifecycle                                                                             | Replacing a debounce timer left the prior hook promise pending; shutdown did not dispose it; thrown callback errors could leave waiters unresolved | Debounced calls share a merged changed-file batch and settle all waiters on success or failure. `watchClose` calls `dispose()`, which cancels pending debounce and releases waiters. HMR bookkeeping is enabled only when a dev-server HMR consumer is present. |
| Plugin registrations and metrics                 | `EnhancedPluginManager` instance                                                                                    | Registrations remain until unregister/shutdown; metrics have a finite 1,000-event cap                                                              | Existing explicit unregister/cleanup and metric cap retained; lifecycle tests will verify isolation where manager instances are scoped.                                                                                                                         |

## Concurrency boundary

Output serialization and cache bounds are process-local. They protect concurrent tasks in one
Node.js process, not multiple CLI processes sharing a destination. Cross-process coordination,
distributed locks, and attacker-resistant filesystem transactions are out of scope. Applications
that run competing processes must coordinate externally and keep output/cache directories under
their control.

The output transaction lock covers the entire commit, including the initial `hadOriginal`
observation, final renames, journal state updates, and cleanup. A failed operation releases its
queue slot in `finally`; the in-memory lock map removes idle directory keys.

## Reproducible regression coverage

`tests/phase0/concurrency-resource-lifecycle.test.mjs` covers simultaneous same-directory multi-file
commits, same-key concurrent cache writes, bounded disk cache growth, a barrier-controlled worker
failure with active work, and bounded completed processor history. The worker test uses explicit
promises as barriers rather than timing sleeps. Run it with:

```sh
npm run test:phase0:resources
```

The resource regression script also exercises Webpack watch disposal, transaction failure and FIFO
lock release, byte-limited concurrent cache writes, watcher cancellation isolation, 25 watcher
create/debounce/abort/dispose cycles, and processor completion history. It verifies that
`getProcessingStats().total` is retained/active queue size, not a lifetime counter: the baseline
implementation computed it from the queue, whose completed records expired after 30 seconds and
whose failed records were immediately removed. No lifetime metric compatibility change is needed.

The script runs five cycles of 5,000 unique performance-cache insertions, checks the 500-entry cap
each cycle, and clears the cache between cycles. With `--expose-gc`, it prints the observed heap
delta without making exact GC timing a pass/fail threshold. The 2026-10-18 run retained 500 entries
at peak, zero after disposal, and reported a 125,948-byte post-GC heap delta. This is an
environment-specific sample, not a universal threshold. The final Phase 00.8 package smoke reported
754 files and 634,074 bytes, 6,549 bytes below the approved 640,623-byte ceiling.

Verification completed: Phase 00 and Phase 1 validation chains, integrations, resource regressions,
package smoke, TypeScript, repository lint budget, Jest, privacy, and `git diff --check`. The lint
gate reports zero errors and 14 visible approved `no-explicit-any` warnings. RES-001 and RES-002 are
covered by deterministic transaction-failure/alias/FIFO tests and watcher-isolation/repeated-
disposal tests. Engineering Review 019 formally approved and closed this phase.
