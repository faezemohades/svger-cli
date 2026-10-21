import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALLOWED_COUNTS,
  isAllowedOrigin,
  parseBenchmarkRequest,
  validateWorkerResult,
} from './contracts.mjs';

test('only the published Pages origin and documented local preview origins are allowed', () => {
  assert.equal(isAllowedOrigin('https://faezemohades.github.io'), true);
  assert.equal(isAllowedOrigin('http://localhost:8000'), true);
  assert.equal(isAllowedOrigin('https://attacker.example'), false);
  assert.equal(isAllowedOrigin('null'), false);
});

test('only exact fixture-count requests are accepted', () => {
  for (const count of ALLOWED_COUNTS) assert.deepEqual(parseBenchmarkRequest({ count }), { count });
  for (const value of [
    { count: 49 }, { count: 171 }, { count: '50' }, { count: 50, path: '/tmp' },
    null, [],
  ]) assert.equal(parseBenchmarkRequest(value), null);
});

test('worker reports are bounded by count and typed metrics', () => {
  const result = {
    schemaVersion: 1, fileCount: 50, succeeded: 50, failed: 0,
    engineVersion: '1.0.0', wallTimeMs: 4, cpuTimeMs: 3,
    cpuCoreEquivalent: 0.75, peakRssBytes: 1000, outputBytes: 5000,
    fixtureSha256: 'a'.repeat(64),
    outputSha256: 'b'.repeat(64),
  };
  assert.equal(validateWorkerResult(result, 50), true);
  assert.equal(validateWorkerResult({ ...result, fileCount: 49 }, 50), false);
  assert.equal(validateWorkerResult({ ...result, succeeded: 51 }, 50), false);
  assert.equal(validateWorkerResult({ ...result, fixtureSha256: 'bad' }, 50), false);
  assert.equal(validateWorkerResult({ ...result, outputSha256: 'bad' }, 50), false);
  assert.equal(validateWorkerResult({ ...result, cpuCoreEquivalent: Number.NaN }, 50), false);
  assert.equal(validateWorkerResult({ ...result, engineVersion: '' }, 50), false);
});
