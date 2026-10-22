import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const addonPath = process.env.SVGER_NODE_API_ADDON;
const testRoot = process.env.SVGER_NODE_API_TEST_ROOT;
assert.ok(addonPath, 'SVGER_NODE_API_ADDON must point to the built .node file');
assert.ok(testRoot, 'SVGER_NODE_API_TEST_ROOT must be a private, ACL-verified directory');
const addon = require(addonPath);
const helper = fileURLToPath(new URL('./child-parent-lock.mjs', import.meta.url));
const fixtureScript = fileURLToPath(new URL('./fixtures.ps1', import.meta.url));
const baseResources = addon.liveResourceCount();
const baseAuthorizationHandles = addon.authorizationHandleCount();
const basePending = addon.pendingWorkCount();

function fixturePath(label) {
  return path.join(testRoot, `svger-${label}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function runChild(parentPath, mode = 'acquire') {
  const result = spawnSync(process.execPath, [helper, addonPath, parentPath, mode], {
    encoding: 'utf8',
    timeout: 8000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
}

function runFixture(action, targetPath) {
  const result = spawnSync('pwsh', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', fixtureScript, '-Action', action, '-Path', targetPath,
  ], { encoding: 'utf8', timeout: 8000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function waitUntil(predicate, label, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.ok(predicate(), label);
}

async function startPollingChild(parentPath) {
  const child = spawn(process.execPath, [helper, addonPath, parentPath, 'poll'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('lock polling child did not start')), 3000);
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    const check = () => {
      if (stdout.includes('polling\n')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', check);
  });
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code !== 0) return reject(new Error(`polling child failed (${code}/${signal}): ${stderr}`));
      try {
        resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)));
      } catch (error) {
        reject(new Error(`invalid polling child output: ${stdout}; ${stderr}; ${error.message}`));
      }
    });
  });
  return { completed };
}

test('parent lock excludes another process and can be acquired after close', async () => {
  const parent = fixturePath('lock-contention');
  runFixture('create', parent);
  try {
    const session = addon.openLockedSession(parent);
    assert.equal(addon.liveResourceCount(), baseResources + 1);
    assert.equal(addon.authorizationHandleCount(), baseAuthorizationHandles + 2);
    assert.equal(addon.pendingWorkCount(), basePending);

    const whileHeld = runChild(parent);
    assert.equal(whileHeld.status, 'busy');
    assert.equal(whileHeld.code, 'E_PARENT_LOCK_BUSY');
    assert.equal(whileHeld.category, 'busy');
    assert.equal(whileHeld.retryable, true);

    session.close();
    session.close();
    assert.equal(addon.liveResourceCount(), baseResources);
    assert.equal(addon.authorizationHandleCount(), baseAuthorizationHandles);
    assert.deepEqual(runChild(parent), { status: 'acquired' });
    assert.deepEqual(await fs.readdir(parent), ['.svger-recovery-parent.lock']);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('authorization failures do not create a lock or change fixture entries', async () => {
  const parent = fixturePath('untrusted-write');
  runFixture('create', parent);
  runFixture('everyone-write', parent);
  const before = await fs.readdir(parent);
  assert.throws(
    () => addon.openLockedSession(parent),
    error => error.code === 'E_PARENT_UNTRUSTED_WRITE_ACE' &&
      error.category === 'authorization' && error.retryable === false
  );
  assert.deepEqual(await fs.readdir(parent), before);
  assert.equal(addon.liveResourceCount(), baseResources);
  assert.equal(addon.authorizationHandleCount(), baseAuthorizationHandles);
  await fs.rm(parent, { recursive: true, force: true });
});

test('owner mismatch is rejected when the runner can construct a verified foreign-owner fixture', async context => {
  const parent = fixturePath('owner-mismatch');
  runFixture('create', parent);
  if (runFixture('system-owner', parent) !== 'true') {
    await fs.rm(parent, { recursive: true, force: true });
    context.skip('runner cannot set and verify SYSTEM as the disposable directory owner; owner gate remains open');
    return;
  }
  try {
    const before = await fs.readdir(parent);
    assert.throws(
      () => addon.openLockedSession(parent),
      error => error.code === 'E_PARENT_OWNER' &&
        error.category === 'authorization' && error.retryable === false
    );
    assert.deepEqual(await fs.readdir(parent), before);
    assert.equal(addon.liveResourceCount(), baseResources);
    assert.equal(addon.authorizationHandleCount(), baseAuthorizationHandles);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('reparse-point parent is rejected without creating a lock', async () => {
  const target = fixturePath('reparse-target');
  const link = fixturePath('reparse-parent');
  runFixture('create', target);
  try {
    await fs.symlink(target, link, 'junction');
    const before = await fs.readdir(target);
    assert.throws(
      () => addon.openLockedSession(link),
      error => error.code === 'E_PARENT_REPARSE' &&
        error.category === 'authorization' && error.retryable === false
    );
    assert.deepEqual(await fs.readdir(target), before);
    assert.equal(addon.liveResourceCount(), baseResources);
    assert.equal(addon.authorizationHandleCount(), baseAuthorizationHandles);
  } finally {
    await fs.rm(link, { recursive: true, force: true });
    await fs.rm(target, { recursive: true, force: true });
  }
});

test('partial initialization releases parent and lock handles', async () => {
  const parent = fixturePath('init-failure');
  runFixture('create', parent);
  try {
    assert.throws(
      () => addon.openLockedSession(parent, { failAfterLock: true }),
      error => error.code === 'E_SESSION_INIT_INJECTED' && error.category === 'io'
    );
    assert.equal(addon.liveResourceCount(), baseResources);
    assert.equal(addon.authorizationHandleCount(), baseAuthorizationHandles);
    assert.deepEqual(runChild(parent), { status: 'acquired' });
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('process termination releases an unclosed parent lock', async () => {
  const parent = fixturePath('process-exit');
  runFixture('create', parent);
  try {
    const child = spawnSync(process.execPath, [helper, addonPath, parent, 'exit-holding'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /lock-acquired; exiting without close/);
    assert.deepEqual(runChild(parent), { status: 'acquired' });
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('lock ownership remains held through pending native work and close', { timeout: 8000 }, async () => {
  const parent = fixturePath('pending-work');
  runFixture('create', parent);
  try {
    const session = addon.openLockedSession(parent);
    const poller = await startPollingChild(parent);
    const operation = session.probe(350);
    await waitUntil(() => session.snapshot().activeOperations === 1, 'native probe did not start');
    session.close();
    assert.deepEqual(await operation, { sequence: 1 });
    const result = await poller.completed;
    assert.equal(result.acquired, true);
    assert.ok(result.busyAttempts > 0, 'competitor must observe the lock while work is pending');
    assert.equal(addon.authorizationHandleCount(), baseAuthorizationHandles);
    assert.equal(addon.liveResourceCount(), baseResources);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});
