import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigService } from '../../dist/services/config.js';
import {
  explainConfiguration,
  resolveConfiguration,
} from '../../dist/index.js';
import { createBuildPlan } from '../../dist/application/build-plan.js';
import { runBounded } from '../../dist/application/bounded-scheduler.js';
import { discoverSVGInputs } from '../../dist/application/source-discovery.js';

const defaults = ConfigService.getInstance().getDefaultConfig();
const resolved = resolveConfiguration(defaults, [
  {
    origin: 'compiler',
    value: { react: { memo: true } },
  },
  {
    origin: 'request',
    value: { react: { forwardRef: false } },
  },
]);
assert.equal(resolved.config.react.memo, true);
assert.equal(resolved.config.react.forwardRef, false);
assert.equal(resolved.config.react.componentType, 'functional');
assert.equal(resolved.origins['react.memo'], 'compiler');
assert.equal(resolved.origins['react.forwardRef'], 'request');
assert.ok(Object.isFrozen(resolved.config.react));
assert.deepEqual(
  explainConfiguration(resolved).map(entry => entry.path),
  [...explainConfiguration(resolved).map(entry => entry.path)].sort((a, b) =>
    a.localeCompare(b, 'en')
  )
);

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-p1-plan-'));
const source = path.join(fixture, 'source');
const output = path.join(source, 'generated');
await fs.mkdir(path.join(source, 'nested'), { recursive: true });
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(source, 'Zulu.SVG'), '<svg/>');
await fs.writeFile(path.join(source, 'alpha.svg'), '<svg/>');
await fs.writeFile(path.join(source, '.hidden.svg'), '<svg/>');
await fs.writeFile(path.join(source, 'nested', 'beta.svg'), '<svg/>');
await fs.writeFile(path.join(output, 'ignored.svg'), '<svg/>');

const sources = await discoverSVGInputs({
  sourceDir: source,
  outputDir: output,
  recursive: true,
});
assert.deepEqual(
  sources.map(item => item.relativePath),
  ['alpha.svg', 'nested/beta.svg', 'Zulu.SVG']
);

const collisionSources = [
  { absolutePath: '/tmp/a.svg', relativePath: 'a.svg' },
  { absolutePath: '/tmp/A.svg', relativePath: 'A.svg' },
];
const adapter = {
  componentName(fileName) {
    return fileName.replace(/\.svg$/i, '').toUpperCase();
  },
  outputFileName(componentName) {
    return `${componentName}.tsx`;
  },
};
assert.throws(
  () => createBuildPlan(collisionSources, '/tmp/out', adapter),
  error => error.code === 'E_NAME_COLLISION' && error.exitCode === 7
);
const resolvedCollision = createBuildPlan(
  collisionSources,
  '/tmp/out',
  adapter,
  'last'
);
assert.equal(resolvedCollision.items[0].relativePath, 'A.svg');
assert.equal(resolvedCollision.diagnostics[0].severity, 'warning');

let active = 0;
let peak = 0;
const scheduled = await runBounded(
  [1, 2, 3, 4, 5],
  async value => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return value * 2;
  },
  { concurrency: 2, batchSize: 3, preserveOrder: true }
);
assert.deepEqual(scheduled, [2, 4, 6, 8, 10]);
assert.equal(peak, 2);

await fs.rm(fixture, { recursive: true, force: true });
console.log(
  'Phase 1 configuration, discovery, planning, and scheduler passed.'
);
