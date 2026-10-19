import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ContentAddressableCache,
  NullLogger,
  PerformanceEngine,
  SVGProcessor,
  commitOutputTransaction,
} from '../../dist/index.js';
import { runBounded } from '../../dist/application/bounded-scheduler.js';
import { getOutputTransactionLockCountForTesting } from '../../dist/application/output-transaction.js';
import { SvgerWebpackPlugin } from '../../dist/integrations/webpack.js';
import { SVGService } from '../../dist/services/svg-service.js';
import { fileWatcher } from '../../dist/services/file-watcher.js';
import { svgProcessor } from '../../dist/processors/svg-processor.js';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-phase07-'));

function createTrackedSignal() {
  const listeners = new Set();
  const signal = {
    aborted: false,
    reason: undefined,
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
  };
  return {
    signal,
    abort() {
      signal.aborted = true;
      for (const listener of [...listeners]) listener();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

// Concurrent commits into a shared output directory must never interleave the
// files from two independently generated artifact sets.
{
  const output = path.join(fixture, 'shared-output');
  const commits = Array.from({ length: 20 }, (_, index) => {
    const marker = `build-${index}`;
    return commitOutputTransaction(output, [
      { outputFileName: 'left.txt', content: marker },
      { outputFileName: 'right.txt', content: marker },
    ]);
  });
  await Promise.all(commits);
  assert.equal(
    await fs.readFile(path.join(output, 'left.txt'), 'utf8'),
    await fs.readFile(path.join(output, 'right.txt'), 'utf8')
  );
  assert.deepEqual(
    (await fs.readdir(fixture)).filter(
      name =>
        name.startsWith('.svger-transaction-') ||
        name.startsWith('.svger-stage-')
    ),
    []
  );
  assert.equal(getOutputTransactionLockCountForTesting(), 0);
}

// A partially applied transaction failure restores the prior output, releases
// its directory lock, and permits already-queued aliases in FIFO order.
{
  const output = path.join(fixture, 'failure-output');
  const outputAlias = path.join(fixture, 'failure-output-alias');
  await fs.mkdir(output);
  let symlinkAliasCreated = true;
  try {
    await fs.symlink(
      output,
      outputAlias,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) throw error;
    symlinkAliasCreated = false;
  }
  await fs.writeFile(path.join(output, 'left.txt'), 'original-left');
  await fs.writeFile(path.join(output, 'right.txt'), 'original-right');

  let notifyFailurePoint;
  let releaseFailurePoint;
  let notifyRollbackRestored;
  const failurePointReached = new Promise(resolve => {
    notifyFailurePoint = resolve;
  });
  const rollbackRestored = new Promise(resolve => {
    notifyRollbackRestored = resolve;
  });
  const failureGate = new Promise(resolve => {
    releaseFailurePoint = resolve;
  });
  let failureInjected = false;
  const originalRename = fs.rename;
  const originalRealpath = fs.realpath;
  let directRealpathCalls = 0;
  let notifyAliasResolved;
  let notifyThirdResolved;
  const aliasResolved = new Promise(resolve => {
    notifyAliasResolved = resolve;
  });
  const thirdResolved = new Promise(resolve => {
    notifyThirdResolved = resolve;
  });

  fs.rename = async (source, destination) => {
    if (
      !failureInjected &&
      String(source).includes(`${path.sep}files${path.sep}right.txt`) &&
      destination === path.join(output, 'right.txt')
    ) {
      failureInjected = true;
      notifyFailurePoint();
      await failureGate;
      throw Object.assign(new Error('injected transaction rename failure'), {
        code: 'EIO',
      });
    }
    const renamed = await originalRename.call(fs, source, destination);
    if (
      String(source).includes(`${path.sep}backup${path.sep}left.txt`) &&
      destination === path.join(output, 'left.txt')
    ) {
      notifyRollbackRestored();
    }
    return renamed;
  };
  fs.realpath = async candidate => {
    const result = await originalRealpath.call(fs, candidate);
    if (
      symlinkAliasCreated &&
      path.resolve(String(candidate)) === outputAlias
    ) {
      notifyAliasResolved();
    }
    if (path.resolve(String(candidate)) === output) {
      directRealpathCalls++;
      if (!symlinkAliasCreated && directRealpathCalls === 2) {
        notifyAliasResolved();
      }
      if (directRealpathCalls === (symlinkAliasCreated ? 2 : 3)) {
        notifyThirdResolved();
      }
    }
    return result;
  };

  try {
    const failed = commitOutputTransaction(output, [
      { outputFileName: 'left.txt', content: 'failed-left' },
      { outputFileName: 'right.txt', content: 'failed-right' },
    ]);
    await failurePointReached;

    let secondSettled = false;
    let thirdSettled = false;
    const second = commitOutputTransaction(
      symlinkAliasCreated
        ? outputAlias
        : path.join(output, '..', 'failure-output'),
      [
        { outputFileName: 'left.txt', content: 'second-left' },
        { outputFileName: 'right.txt', content: 'second-right' },
      ]
    ).then(() => {
      secondSettled = true;
    });
    const third = commitOutputTransaction(output, [
      { outputFileName: 'left.txt', content: 'third-left' },
      { outputFileName: 'right.txt', content: 'third-right' },
    ]).then(() => {
      thirdSettled = true;
    });

    await Promise.all([aliasResolved, thirdResolved]);
    // Let both realpath continuations enqueue behind the held first commit.
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(secondSettled, false);
    assert.equal(thirdSettled, false);
    assert.equal(getOutputTransactionLockCountForTesting(), 1);

    releaseFailurePoint();
    await rollbackRestored;
    assert.equal(
      await fs.readFile(path.join(output, 'left.txt'), 'utf8'),
      'original-left'
    );
    assert.equal(
      await fs.readFile(path.join(output, 'right.txt'), 'utf8'),
      'original-right'
    );
    await assert.rejects(
      failed,
      error => error?.code === 'E_OUTPUT_TRANSACTION'
    );
    await Promise.all([second, third]);
    assert.equal(
      await fs.readFile(path.join(output, 'left.txt'), 'utf8'),
      'third-left'
    );
    assert.equal(
      await fs.readFile(path.join(output, 'right.txt'), 'utf8'),
      'third-right'
    );
    assert.equal(getOutputTransactionLockCountForTesting(), 0);
    assert.deepEqual(
      (await fs.readdir(fixture)).filter(
        name =>
          name.startsWith('.svger-transaction-') ||
          name.startsWith('.svger-stage-')
      ),
      []
    );
  } finally {
    releaseFailurePoint();
    fs.rename = originalRename;
    fs.realpath = originalRealpath;
  }

  for (let index = 0; index < 25; index++) {
    await commitOutputTransaction(
      path.join(fixture, `unique-output-${index}`),
      [{ outputFileName: 'one.txt', content: String(index) }]
    );
  }
  assert.equal(
    getOutputTransactionLockCountForTesting(),
    0,
    'completed unique destinations must not remain in the lock table'
  );
}

// Repeated unique-key workloads remain bounded; with --expose-gc, emit a
// reproducible before/after heap sample without making GC timing a test oracle.
{
  const engine = new PerformanceEngine();
  global.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  let maxObservedEntries = 0;
  for (let cycle = 0; cycle < 5; cycle++) {
    for (let index = 0; index < 5_000; index++) {
      engine.setCachedResult(`stress-${cycle}-${index}`, {
        payload: 'x'.repeat(1024),
      });
    }
    const cacheSize = engine.monitorMemoryUsage().cacheSize;
    assert.equal(cacheSize, 500);
    maxObservedEntries = Math.max(maxObservedEntries, cacheSize);
    engine.clearCache();
  }
  assert.equal(engine.monitorMemoryUsage().cacheSize, 0);
  global.gc?.();
  const heapAfter = process.memoryUsage().heapUsed;
  console.log(
    JSON.stringify({
      memoryStress: 'performance-cache-5x5000-unique-keys',
      maxObservedEntries,
      cycles: 5,
      retainedEntries: engine.monitorMemoryUsage().cacheSize,
      gcExposed: typeof global.gc === 'function',
      heapDeltaBytes: heapAfter - heapBefore,
    })
  );
}

// Webpack watch shutdown disposes a pending debounce and settles the hook
// promise instead of leaving compilation suspended indefinitely.
{
  let watchRun;
  let watchClose;
  const plugin = new SvgerWebpackPlugin({
    source: fixture,
    watch: { debounce: 60_000 },
  });
  const compiler = {
    options: { watch: true },
    hooks: {
      beforeCompile: { tapPromise() {} },
      watchRun: {
        tapPromise(_name, callback) {
          watchRun = callback;
        },
      },
      watchClose: {
        tap(_name, callback) {
          watchClose = callback;
        },
      },
    },
  };
  plugin.apply(compiler);
  const pendingRun = watchRun({
    watchFileSystem: {
      watcher: { mtimes: { [path.join(fixture, 'pending.svg')]: Date.now() } },
    },
  });
  watchClose();
  await pendingRun;
  assert.equal(plugin.watchDebounceWaiters.length, 0);
  assert.equal(plugin.pendingChangedFiles.size, 0);
}

// A failed Webpack watch conversion rejects the waiting compilation hook.
{
  let watchRun;
  const plugin = new SvgerWebpackPlugin({
    source: fixture,
    watch: { debounce: 1 },
  });
  plugin.apply({
    options: { watch: true },
    hooks: {
      beforeCompile: { tapPromise() {} },
      watchRun: {
        tapPromise(_name, callback) {
          watchRun = callback;
        },
      },
      watchClose: { tap() {} },
    },
  });
  await assert.rejects(
    watchRun({
      watchFileSystem: {
        watcher: {
          mtimes: {
            [path.join(fixture, 'missing-watch-input.svg')]: Date.now(),
          },
        },
      },
    }),
    error => error?.code === 'ENOENT'
  );
  plugin.dispose();
}

// Cache temp paths are unique under same-key contention, and disk entries are
// bounded even when callers submit many distinct keys concurrently.
{
  const cacheDirectory = path.join(fixture, 'bounded-cache');
  const cache = new ContentAddressableCache(cacheDirectory, {
    maxEntries: 3,
    maxBytes: 4096,
  });
  const keys = Array.from({ length: 12 }, (_, index) =>
    index.toString(16).padStart(64, '0')
  );
  await Promise.all(
    keys.map((key, index) => cache.write(key, `content-${index}`))
  );
  const versionDirectory = path.join(cacheDirectory, '1.0.0');
  const entries = await fs.readdir(versionDirectory);
  assert.ok(entries.length <= 3);
  assert.ok(entries.every(name => /^[a-f0-9]{64}\.json$/u.test(name)));

  const contestedKey = 'f'.repeat(64);
  await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      cache.write(contestedKey, `contender-${index}`)
    )
  );
  const contested = await cache.read(contestedKey, { evictCorrupt: false });
  assert.equal(contested.status, 'hit');
  assert.match(contested.content, /^contender-\d+$/u);
  assert.deepEqual(
    (await fs.readdir(versionDirectory)).filter(name => name.endsWith('.tmp')),
    []
  );
  const entryBytes = async () =>
    (
      await Promise.all(
        (await fs.readdir(versionDirectory)).map(
          async name => (await fs.stat(path.join(versionDirectory, name))).size
        )
      )
    ).reduce((total, size) => total + size, 0);
  assert.ok((await entryBytes()) <= 4096);

  const byteLimitedCache = new ContentAddressableCache(
    path.join(fixture, 'byte-limited-cache'),
    { maxEntries: 100, maxBytes: 2048 }
  );
  await Promise.all(
    Array.from({ length: 24 }, (_, index) =>
      byteLimitedCache.write(
        (index + 100).toString(16).padStart(64, '0'),
        `payload-${index}-`.repeat(48)
      )
    )
  );
  const byteLimitedDirectory = path.join(
    fixture,
    'byte-limited-cache',
    '1.0.0'
  );
  const byteLimitedEntries = await fs.readdir(byteLimitedDirectory);
  const byteLimitedSize = (
    await Promise.all(
      byteLimitedEntries.map(
        async name =>
          (await fs.stat(path.join(byteLimitedDirectory, name))).size
      )
    )
  ).reduce((total, size) => total + size, 0);
  assert.ok(byteLimitedEntries.length <= 100);
  assert.ok(byteLimitedSize <= 2048);
}

// The scheduler must not report failure while an already-started worker is
// still running, and must not launch queued work after the first worker fails.
{
  let releaseFirst;
  let signalFirstStarted;
  let signalFailure;
  const firstStarted = new Promise(resolve => {
    signalFirstStarted = resolve;
  });
  const failureObserved = new Promise(resolve => {
    signalFailure = resolve;
  });
  const firstGate = new Promise(resolve => {
    releaseFirst = resolve;
  });
  let active = 0;
  let indexTwoStarted = false;
  let schedulerSettled = false;
  const scheduled = runBounded(
    [0, 1, 2],
    async index => {
      if (index === 0) {
        active++;
        signalFirstStarted();
        try {
          await firstGate;
          return index;
        } finally {
          active--;
        }
      }
      if (index === 1) {
        await firstStarted;
        signalFailure();
        throw new Error('deterministic worker failure');
      }
      indexTwoStarted = true;
      return index;
    },
    { concurrency: 2 }
  );
  scheduled.catch(() => undefined);
  scheduled.then(
    () => {
      schedulerSettled = true;
    },
    () => {
      schedulerSettled = true;
    }
  );
  await failureObserved;
  await Promise.resolve();
  assert.equal(schedulerSettled, false);
  assert.equal(active, 1);
  assert.equal(indexTwoStarted, false);
  releaseFirst();
  await assert.rejects(scheduled, /deterministic worker failure/u);
  assert.equal(active, 0);
}

// Completed processor bookkeeping is a bounded recent-history window and does
// not require delayed cleanup timers.
{
  const input = path.join(fixture, 'icon.svg');
  const output = path.join(fixture, 'processor-output');
  await fs.writeFile(input, '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>');
  const processor = new SVGProcessor({ logger: new NullLogger() });
  for (let index = 0; index < 510; index++) {
    const result = await processor.processSVGFile(input, output, {
      framework: 'vanilla',
      typescript: false,
      optimize: 'none',
    });
    assert.equal(result.success, true);
  }
  assert.deepEqual(processor.getProcessingStats(), {
    total: 500,
    pending: 0,
    processing: 0,
    completed: 500,
    failed: 0,
  });
  processor.clearQueue();
  assert.deepEqual(processor.getProcessingStats(), {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });
}

// Stopping one of two watchers for the same source must abort only that
// registration's active job, detach only its listener, and clear only its
// pending debounce state.
{
  const source = path.join(fixture, 'watch-isolation-source');
  const output = path.join(fixture, 'watch-isolation-output');
  const input = path.join(source, 'same.svg');
  await fs.mkdir(source);
  await fs.writeFile(input, '<svg/>');
  const service = SVGService.getInstance();
  const registrationA = createTrackedSignal();
  const registrationB = createTrackedSignal();
  const activeSignals = [];
  const releases = new Map();
  let signalBothStarted;
  const bothStarted = new Promise(resolve => {
    signalBothStarted = resolve;
  });
  const originalProcessSVGFile = svgProcessor.processSVGFile;
  let watchA;
  let watchB;

  svgProcessor.processSVGFile = (_file, _out, options) =>
    new Promise(resolve => {
      const signal = options.signal;
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      };
      const onAbort = () =>
        finish({
          success: false,
          error: Object.assign(new Error('watch job aborted'), {
            code: 'ABORT_ERR',
          }),
        });
      signal.addEventListener('abort', onAbort, { once: true });
      activeSignals.push(signal);
      releases.set(signal, () =>
        finish({ success: true, componentName: 'Same', filePath: input })
      );
      if (activeSignals.length === 2) signalBothStarted();
    });

  try {
    watchA = await service.startWatching({
      src: source,
      out: output,
      signal: registrationA.signal,
    });
    watchB = await service.startWatching({
      src: source,
      out: output,
      signal: registrationB.signal,
    });
    const event = { type: 'change', filePath: input, timestamp: Date.now() };
    const jobA = service.handleWatchEvent(watchA, event, output);
    const jobB = service.handleWatchEvent(watchB, event, output);
    await bothStarted;
    assert.equal(activeSignals[0].aborted, false);
    assert.equal(activeSignals[1].aborted, false);

    fileWatcher.handleFileEvent(watchA, 'change', input);
    fileWatcher.handleFileEvent(watchB, 'change', input);
    assert.equal(fileWatcher.getWatchStats().pendingEvents, 2);

    service.stopWatching(watchA);
    assert.equal(activeSignals[0].aborted, true);
    assert.equal(activeSignals[1].aborted, false);
    assert.equal(registrationA.listenerCount, 0);
    assert.equal(registrationB.listenerCount, 1);
    assert.deepEqual(fileWatcher.getWatchStats(), {
      activeWatchers: 1,
      pendingEvents: 1,
      totalHandlers: 1,
    });
    await jobA;

    releases.get(activeSignals[1])();
    await jobB;
    service.stopWatching(watchB);
    assert.equal(registrationB.listenerCount, 0);
    assert.deepEqual(fileWatcher.getWatchStats(), {
      activeWatchers: 0,
      pendingEvents: 0,
      totalHandlers: 0,
    });
  } finally {
    if (watchA) service.stopWatching(watchA);
    if (watchB) service.stopWatching(watchB);
    svgProcessor.processSVGFile = originalProcessSVGFile;
  }
}

// Repeated watcher create/debounce/abort/dispose cycles leave no registered
// watchers, callbacks, debounce timers, or accumulating watch handles.
{
  const source = path.join(fixture, 'watch-cycle-source');
  await fs.mkdir(source);
  const input = path.join(source, 'cycle.svg');
  await fs.writeFile(input, '<svg/>');
  const service = SVGService.getInstance();
  const watcherHandleCount = () =>
    (process.getActiveResourcesInfo?.() ?? []).filter(name =>
      /(?:fs)?watch|fsevent/i.test(name)
    ).length;
  const baselineWatchHandles = watcherHandleCount();

  for (let index = 0; index < 25; index++) {
    const registration = createTrackedSignal();
    const watchId = await service.startWatching({
      src: source,
      out: path.join(fixture, `watch-cycle-output-${index}`),
      signal: registration.signal,
    });
    fileWatcher.handleFileEvent(watchId, 'change', input);
    assert.equal(fileWatcher.getWatchStats().pendingEvents, 1);
    registration.abort();
    assert.equal(registration.listenerCount, 0);
    assert.deepEqual(fileWatcher.getWatchStats(), {
      activeWatchers: 0,
      pendingEvents: 0,
      totalHandlers: 0,
    });
  }
  // Native watcher close notifications are delivered on the next loop turn;
  // allow both close and cleanup callbacks to run without sleeping on a timer.
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(watcherHandleCount() <= baselineWatchHandles);
}

await fs.rm(fixture, { recursive: true, force: true });
console.log(
  'Phase 00.7 resource lifecycle and concurrency regressions passed.'
);
