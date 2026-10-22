import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const addonPath = process.env.SVGER_NODE_API_ADDON;
assert.ok(addonPath, 'SVGER_NODE_API_ADDON must point to the built .node file');
const addon = require(addonPath);
const baseline = addon.liveResourceCount();
const baselinePending = addon.pendingWorkCount();

test('explicit close is idempotent and closed operations reject structurally', async () => {
  const session = addon.openSession();
  assert.equal(addon.liveResourceCount(), baseline + 1);
  assert.deepEqual(await session.probe(5), { sequence: 1 });
  assert.equal(session.snapshot().closed, false);

  session.close();
  session.close();
  assert.equal(addon.liveResourceCount(), baseline);
  assert.equal(session.snapshot().closed, true);
  await assert.rejects(session.probe(), error => {
    assert.equal(error.code, 'E_SESSION_CLOSED');
    assert.equal(error.category, 'unsupported');
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(addon.liveResourceCount(), baseline);
});

test('native initialization failure releases an already-acquired resource', () => {
  assert.throws(
    () => addon.openSession({ failAfterResource: true }),
    error => {
      assert.equal(error.code, 'E_SESSION_INIT_INJECTED');
      assert.equal(error.category, 'io');
      assert.equal(error.retryable, false);
      return true;
    }
  );
  assert.equal(addon.liveResourceCount(), baseline);
});

test('asynchronous calls on one session are serialized', async () => {
  const session = addon.openSession();
  try {
    const results = await Promise.all([
      session.probe(40),
      session.probe(40),
      session.probe(10),
    ]);
    assert.deepEqual(results.map(result => result.sequence).sort(), [1, 2, 3]);
    const snapshot = session.snapshot();
    assert.equal(snapshot.activeOperations, 0);
    assert.equal(snapshot.peakConcurrentOperations, 1);
  } finally {
    session.close();
  }
  assert.equal(addon.liveResourceCount(), baseline);
  assert.equal(addon.pendingWorkCount(), baselinePending);
});

test('close waits for an executing operation before releasing its handle', async () => {
  const session = addon.openSession();
  const pending = session.probe(250);
  const deadline = Date.now() + 2000;
  while (session.snapshot().activeOperations === 0 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(session.snapshot().activeOperations, 1, 'probe should be executing');

  // close() is synchronous in this prototype and must wait on the per-session
  // operation mutex. It may return only after the native worker releases it.
  session.close();
  assert.equal(session.snapshot().closed, true);
  assert.deepEqual(await pending, { sequence: 1 });
  assert.equal(addon.liveResourceCount(), baseline);
  assert.equal(addon.pendingWorkCount(), baselinePending);
});

test('queue failure disposes work and receiver ownership', () => {
  const session = addon.openSession();
  assert.throws(
    () => session.probe(10, { failQueue: true }),
    error => {
      assert.equal(error.code, 'E_SESSION_QUEUE_INJECTED');
      assert.equal(error.category, 'io');
      assert.equal(error.retryable, true);
      return true;
    }
  );
  assert.equal(addon.liveResourceCount(), baseline + 1);
  assert.equal(addon.pendingWorkCount(), baselinePending);
  session.close();
  assert.equal(addon.liveResourceCount(), baseline);
});

test('queued cancellation rejects structurally and disposes all ownership', { timeout: 6000 }, async () => {
  assert.equal(process.env.UV_THREADPOOL_SIZE, '4', 'use the qualified four-worker pool');
  const blockers = Array.from({ length: 4 }, () => addon.openSession());
  const blockerOperations = blockers.map(session => session.probe(700));
  const deadline = Date.now() + 2000;
  while (
    blockers.some(session => session.snapshot().activeOperations !== 1) &&
    Date.now() < deadline
  ) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.ok(blockers.every(session => session.snapshot().activeOperations === 1));

  const cancelledSession = addon.openSession();
  const cancelledOperation = cancelledSession.probe(10, { cancelAfterQueue: true });
  await assert.rejects(cancelledOperation, error => {
    assert.equal(error.code, 'E_SESSION_CANCELLED');
    assert.equal(error.category, 'busy');
    assert.equal(error.retryable, true);
    return true;
  });
  await Promise.all(blockerOperations);
  for (const session of [...blockers, cancelledSession]) session.close();
  assert.equal(addon.liveResourceCount(), baseline);
  assert.equal(addon.pendingWorkCount(), baselinePending);
});

test('wrapper finalization releases a session resource', { timeout: 5000 }, async () => {
  assert.equal(typeof global.gc, 'function', 'run Node with --expose-gc');
  function finalizationSignal() {
    let resolveFinalized;
    const finalized = new Promise(resolve => {
      resolveFinalized = resolve;
    });
    return {
      finalized,
      registry: new FinalizationRegistry(resolveFinalized),
    };
  }
  async function waitForFinalization(signal, label) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      global.gc();
      const completed = await Promise.race([
        signal.finalized.then(() => true),
        new Promise(resolve => setTimeout(() => resolve(false), 10)),
      ]);
      if (completed) return;
    }
    assert.fail(`${label} was not finalized after repeated garbage collection`);
  }
  function abandonSession(registry) {
    const session = addon.openSession();
    registry.register(session, 'idle session');
  }
  const abandoned = finalizationSignal();
  abandonSession(abandoned.registry);
  assert.equal(addon.liveResourceCount(), baseline + 1);
  await waitForFinalization(abandoned, 'idle session wrapper');
  assert.equal(addon.liveResourceCount(), baseline);

  async function abandonDuringProbe(registry) {
    const session = addon.openSession();
    const operation = session.probe(100);
    registry.register(session, 'session with pending probe');
    return operation;
  }
  const pending = finalizationSignal();
  const operation = await abandonDuringProbe(pending.registry);
  assert.equal(addon.liveResourceCount(), baseline + 1);
  await operation;
  await waitForFinalization(pending, 'session wrapper retained by pending work');
  assert.equal(addon.liveResourceCount(), baseline);
  assert.equal(addon.pendingWorkCount(), baselinePending);
});

test('worker environment shutdown drains pending native work', { timeout: 7000 }, async () => {
  const workerScript = fileURLToPath(
    new URL('./child-worker-shutdown.mjs', import.meta.url)
  );
  const worker = new Worker(workerScript, {
    workerData: addonPath,
    type: 'module',
  });
  const started = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('worker did not start native probe')), 3000);
    worker.once('message', message => {
      clearTimeout(timer);
      resolve(message);
    });
    worker.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
  assert.equal(started, 'probe-active');
  const terminated = await worker.terminate();
  assert.equal(typeof terminated, 'number');
  assert.equal(addon.liveResourceCount(), baseline);
  assert.equal(addon.pendingWorkCount(), baselinePending);
});

test('process termination releases an unclosed native session handle', () => {
  const childScript = fileURLToPath(
    new URL('./child-unclosed-session.mjs', import.meta.url)
  );
  const child = spawnSync(process.execPath, [childScript, addonPath], {
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /session-opened; exiting without explicit close/);
  assert.equal(addon.liveResourceCount(), baseline);
});
