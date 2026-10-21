import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_REQUEST_BYTES,
  isAllowedOrigin,
  parseBenchmarkRequest,
  validateWorkerResult,
} from './contracts.mjs';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolRoot, '../..');
const port = Number(process.env.SVGER_BENCHMARK_PORT ?? 4317);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('SVGER_BENCHMARK_PORT must be an integer from 0 to 65535.');
}
const workerPath = path.join(toolRoot, 'worker.mjs');
const activePackagePath = path.join(repositoryRoot, 'dist/processors/svg-processor.js');
const svgrCorePackagePath = path.join(toolRoot, 'node_modules/@svgr/core/package.json');
const svgrJsxPackagePath = path.join(toolRoot, 'node_modules/@svgr/plugin-jsx/package.json');
let running = false;

function send(response, status, body, origin) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(origin ? {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
    } : {}),
  });
  response.end(JSON.stringify(body));
}

function runWorker(engine, count, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Benchmark request was interrupted.'));
      return;
    }
    const child = spawn(process.execPath, [workerPath, engine, String(count)], {
      cwd: repositoryRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH ?? '' },
    });
    const stdout = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => child.kill('SIGKILL'), 180_000);
    const abortWorker = () => child.kill('SIGKILL');
    signal?.addEventListener('abort', abortWorker, { once: true });
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortWorker);
    };
    child.stdout.on('data', chunk => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > 16 * 1024) child.kill('SIGKILL');
      else stdout.push(chunk);
    });
    child.stderr.on('data', chunk => {
      stderrBytes += chunk.length;
      if (stderrBytes > 16 * 1024) child.kill('SIGKILL');
    });
    child.on('error', error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      cleanup();
      if (code !== 0) {
        reject(new Error(code === null ? 'Benchmark worker was terminated.' : `Worker exited with code ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString('utf8')));
      } catch {
        reject(new Error('Benchmark worker returned an invalid result.'));
      }
    });
  });
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  const host = request.headers.host?.toLowerCase();
  const hostName = host?.replace(/:\d+$/u, '');
  if (!['127.0.0.1', 'localhost'].includes(hostName)) {
    send(response, 403, { error: 'host_not_allowed' });
    return;
  }
  if (!isAllowedOrigin(origin)) {
    send(response, 403, { error: 'origin_not_allowed' });
    return;
  }
  if (request.method === 'OPTIONS' && request.url === '/run') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '300',
      'Vary': 'Origin, Access-Control-Request-Private-Network',
      ...(request.headers['access-control-request-private-network'] === 'true'
        ? { 'Access-Control-Allow-Private-Network': 'true' }
        : {}),
    });
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/health') {
    const ready = await Promise.all([
      activePackagePath,
      svgrCorePackagePath,
      svgrJsxPackagePath,
    ].map(filename => stat(filename).then(() => true, () => false)))
      .then(states => states.every(Boolean));
    send(response, ready ? 200 : 503, {
      service: 'svger-local-comparison',
      ready,
      requiresBuiltCheckout: true,
      requiresBenchmarkDependencies: true,
    }, origin);
    return;
  }
  if (request.method !== 'POST' || request.url !== '/run') {
    send(response, 404, { error: 'not_found' }, origin);
    return;
  }
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    send(response, 415, { error: 'json_required' }, origin);
    return;
  }
  let body = '';
  let bodyBytes = 0;
  let oversized = false;
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    send(response, 413, { error: 'request_too_large' }, origin);
    request.destroy();
    return;
  }
  request.setEncoding('utf8');
  request.on('data', chunk => {
    if (oversized) return;
    bodyBytes += Buffer.byteLength(chunk);
    if (bodyBytes > MAX_REQUEST_BYTES) {
      oversized = true;
      send(response, 413, { error: 'request_too_large' }, origin);
      response.once('finish', () => request.destroy());
    }
    else body += chunk;
  });
  request.on('end', async () => {
    if (oversized) return;
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      send(response, 400, { error: 'invalid_json' }, origin);
      return;
    }
    const input = parseBenchmarkRequest(parsed);
    if (!input) {
      send(response, 400, { error: 'unsupported_fixture_count', allowedCounts: [50, 100, 170] }, origin);
      return;
    }
    if (running) {
      send(response, 429, { error: 'benchmark_already_running' }, origin);
      return;
    }
    running = true;
    const controller = new AbortController();
    response.once('close', () => {
      if (!response.writableEnded) controller.abort();
    });
    try {
      const toolPackage = JSON.parse(await readFile(path.join(toolRoot, 'package.json'), 'utf8'));
      const results = [];
      for (const engine of ['svger', 'svgr']) {
        const result = await runWorker(engine, input.count, controller.signal);
        if (!validateWorkerResult(result, input.count) || result.engine !== engine) {
          throw new Error('Benchmark worker returned an inconsistent report.');
        }
        results.push(result);
      }
      if (results[0].fixtureSha256 !== results[1].fixtureSha256) {
        throw new Error('Benchmark workers did not use identical fixture inputs.');
      }
      if (results.some(result => result.fileCount !== input.count)) {
        throw new Error('Benchmark worker reported an inconsistent fixture count.');
      }
      send(response, 200, {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        fixtureCount: input.count,
        fixturesSha256: results[0].fixtureSha256,
        methodology: {
          scope: 'in-memory SVG-to-React-JavaScript transformation; package import/startup and file writes excluded',
          cpu: 'process user plus system CPU time measured by Node process.cpuUsage(); core-equivalent is process CPU time divided by wall time, not whole-system CPU utilization',
          memory: 'peak resident set size sampled within each worker every 10ms, including imported runtime/package baseline; short peaks may be missed',
          outputIntegrity: 'SHA-256 over ordered successful output text and per-input success/failure markers',
          hostSpecific: true,
          uploads: false,
        },
        versions: {
          node: process.version,
          svger: results[0].engineVersion,
          svgr: results[1].engineVersion,
          svgrRequested: toolPackage.dependencies['@svgr/core'],
        },
        results,
      }, origin);
    } catch {
      if (controller.signal.aborted || response.destroyed) return;
      send(response, 503, {
        error: 'benchmark_unavailable',
        message: 'The local run did not complete. Check the companion terminal, rebuild the checkout, and verify the benchmark dependencies.',
      }, origin);
    } finally {
      running = false;
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  const activePort = address && typeof address === 'object' ? address.port : port;
  process.stdout.write(`SVGER local benchmark companion listening at http://127.0.0.1:${activePort}\n`);
  process.stdout.write('This service binds to loopback only and never uploads results.\n');
});
