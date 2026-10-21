import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { validateWorkerResult } from './contracts.mjs';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolRoot, '../..');
const workerPath = path.join(toolRoot, 'worker.mjs');
const serverPath = path.join(toolRoot, 'server.mjs');
const expectedSvgr = JSON.parse(
  await readFile(path.join(toolRoot, 'package.json'), 'utf8')
);

for (const file of [
  path.join(repositoryRoot, 'dist/processors/svg-processor.js'),
  path.join(toolRoot, 'node_modules/@svgr/core/package.json'),
  path.join(toolRoot, 'node_modules/@svgr/plugin-jsx/package.json'),
]) {
  await stat(file);
}

async function runWorker(engine, count) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath, engine, String(count)], {
      cwd: repositoryRoot,
      env: { PATH: process.env.PATH ?? '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    const timeout = setTimeout(() => child.kill('SIGKILL'), 180_000);
    child.stdout.on('data', chunk => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > 16 * 1024) child.kill('SIGKILL');
      else stdout.push(chunk);
    });
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', code => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(
          `${engine} worker exited with ${String(code)}: ${Buffer.concat(stderr).toString('utf8').slice(0, 1000)}`
        ));
        return;
      }
      try {
        const result = JSON.parse(Buffer.concat(stdout).toString('utf8'));
        assert.equal(validateWorkerResult(result, count), true);
        assert.equal(result.engine, engine);
        assert.ok(result.succeeded > 0, `${engine} transformed no fixtures for count ${count}`);
        assert.equal(result.outputBytes > 0, true);
        const expectedCpuCoreEquivalent = result.wallTimeMs === 0
          ? 0
          : result.cpuTimeMs / result.wallTimeMs;
        assert.ok(Math.abs(result.cpuCoreEquivalent - expectedCpuCoreEquivalent) < 1e-9);
        if (engine === 'svgr') assert.equal(result.engineVersion, expectedSvgr.dependencies['@svgr/core']);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

const workloadResults = [];
for (const count of [50, 100, 170]) {
  const byEngine = {};
  for (const engine of ['svger', 'svgr']) {
    const first = await runWorker(engine, count);
    const repeat = await runWorker(engine, count);
    for (const key of [
      'engineVersion', 'fileCount', 'succeeded', 'failed',
      'fixtureSha256', 'outputSha256', 'outputBytes',
    ]) {
      assert.equal(repeat[key], first[key], `${engine} ${count}: nondeterministic ${key}`);
    }
    byEngine[engine] = first;
  }
  assert.equal(
    byEngine.svger.fixtureSha256,
    byEngine.svgr.fixtureSha256,
    `${count}: engines did not receive identical fixture bytes and order`
  );
  workloadResults.push({
    count,
    fixtureSha256: byEngine.svger.fixtureSha256,
    svger: { version: byEngine.svger.engineVersion, succeeded: byEngine.svger.succeeded, failed: byEngine.svger.failed },
    svgr: { version: byEngine.svgr.engineVersion, succeeded: byEngine.svgr.succeeded, failed: byEngine.svgr.failed },
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: repositoryRoot,
      env: { PATH: process.env.PATH ?? '', SVGER_BENCHMARK_PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Timed out waiting for the local benchmark companion.'));
    }, 10_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)/u);
      if (!match) return;
      clearTimeout(timer);
      resolve({ child, origin: `http://127.0.0.1:${match[1]}`, port: Number(match[1]) });
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Benchmark companion exited before listening (${String(code)}): ${stderr}`));
    });
  });
}

async function checkHttpBoundary() {
  const { child, origin, port } = await startServer();
  const allowedOrigin = 'https://faezemohades.github.io';
  const local = (route, options = {}) => fetch(`${origin}${route}`, options);
  try {
    assert.equal((await local('/health')).status, 403, 'requests without Origin must fail closed');
    assert.equal((await local('/health', { headers: { Origin: 'https://attacker.example' } })).status, 403);
    const unexpectedHostStatus = await new Promise((resolve, reject) => {
      const request = http.request({
        host: '127.0.0.1', port, path: '/health', method: 'GET',
        headers: { Origin: allowedOrigin, Host: `attacker.example:${port}` },
      }, response => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
      });
      request.once('error', reject);
      request.end();
    });
    assert.equal(unexpectedHostStatus, 403, 'unapproved Host values must be rejected');

    const preflight = await local('/run', {
      method: 'OPTIONS',
      headers: {
        Origin: allowedOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
        'Access-Control-Request-Private-Network': 'true',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), allowedOrigin);
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
    assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');

    const health = await local('/health', { headers: { Origin: allowedOrigin } });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ready, true);

    const request = (body, extra = {}, signal) => local('/run', {
      method: 'POST',
      headers: { Origin: allowedOrigin, 'Content-Type': 'application/json', ...extra },
      body,
      signal,
    });
    assert.equal((await request('{')).status, 400, 'malformed JSON must be rejected');
    assert.equal((await request(JSON.stringify({ count: 49 }))).status, 400);
    assert.equal((await request(JSON.stringify({ count: 50, path: '/etc/passwd' }))).status, 400);
    assert.equal((await request('{}', { 'Content-Type': 'text/plain' })).status, 415);

    const oversized = await request(JSON.stringify({ padding: 'x'.repeat(2048) }));
    assert.equal(oversized.status, 413, 'oversized bodies must be rejected');

    const firstRun = request(JSON.stringify({ count: 170 }));
    await delay(20);
    assert.equal((await request(JSON.stringify({ count: 50 }))).status, 429,
      'a second benchmark must be rejected while one is active');
    const firstResponse = await firstRun;
    assert.equal(firstResponse.status, 200);
    const report = await firstResponse.json();
    assert.equal(report.fixtureCount, 170);
    assert.equal(report.results.length, 2);
    assert.equal(report.results[0].fixtureSha256, report.results[1].fixtureSha256);
    assert.equal(report.results[0].outputSha256.length, 64);
    assert.equal(report.methodology.uploads, false);
    assert.match(report.methodology.cpu, /not whole-system CPU utilization/u);
    assert.match(report.methodology.memory, /short peaks may be missed/u);

    const controller = new AbortController();
    const interruptedRun = request(JSON.stringify({ count: 170 }), {}, controller.signal);
    await delay(100);
    assert.equal((await request(JSON.stringify({ count: 50 }))).status, 429,
      'the cancellation fixture must be active before aborting it');
    controller.abort();
    await interruptedRun.catch(() => undefined);
    let recovered = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const response = await request(JSON.stringify({ count: 50 }));
      if (response.status === 429) {
        await delay(100);
        continue;
      }
      assert.equal(response.status, 200, 'the companion must accept work after client cancellation');
      recovered = true;
      break;
    }
    assert.equal(recovered, true, 'the interrupted worker did not release the active-job slot');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
}

await checkHttpBoundary();
process.stdout.write(`${JSON.stringify({
  qualification: 'passed',
  workloadResults,
  httpBoundary: 'passed',
  note: 'This is local Node HTTP integration evidence, not a real browser test or OS sandbox certification.',
}, null, 2)}\n`);
