import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSVGCompiler } from '../../dist/index.js';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-p1-cache-'));
await fs.mkdir(path.join(fixture, 'icons'));
await fs.writeFile(
  path.join(fixture, 'icons', 'cached.svg'),
  '<svg viewBox="0 0 2 2"><path d="M0 0h1v1z"/></svg>'
);
const compiler = await createSVGCompiler({ cwd: fixture });
const first = await compiler.build({ src: 'icons', out: 'output' });
assert.equal(first.status, 'success');
const cacheVersionDirectory = path.join(fixture, '.svger-cache', '1.0.0');
const initialEntries = await fs.readdir(cacheVersionDirectory);
assert.equal(initialEntries.length, 1);

const second = await compiler.build({ src: 'icons', out: 'output' });
assert.ok(second.diagnostics.some(item => item.code === 'I_CACHE_HIT'));

const javascript = await compiler.build({
  src: 'icons',
  out: 'javascript-output',
  typescript: false,
});
assert.ok(!javascript.diagnostics.some(item => item.code === 'I_CACHE_HIT'));
assert.equal((await fs.readdir(cacheVersionDirectory)).length, 2);

const corruptPath = path.join(cacheVersionDirectory, initialEntries[0]);
await fs.writeFile(corruptPath, '{not-json');
const verification = await compiler.build({
  src: 'icons',
  out: 'output',
  mode: 'dry-run',
});
assert.ok(
  verification.diagnostics.some(item => item.code === 'W_CACHE_CORRUPT')
);
assert.equal(await fs.readFile(corruptPath, 'utf8'), '{not-json');

const repaired = await compiler.build({ src: 'icons', out: 'output' });
assert.ok(repaired.diagnostics.some(item => item.code === 'W_CACHE_CORRUPT'));
assert.equal(
  JSON.parse(await fs.readFile(corruptPath, 'utf8')).schemaVersion,
  '1.0.0'
);

const unsafeFixture = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-p1-no-cache-')
);
await fs.mkdir(path.join(unsafeFixture, 'icons'));
await fs.writeFile(
  path.join(unsafeFixture, 'icons', 'unsafe.svg'),
  '<svg><script>alert(1)</script></svg>'
);
const unsafeCompiler = await createSVGCompiler({ cwd: unsafeFixture });
const unsafe = await unsafeCompiler.build({ src: 'icons', out: 'output' });
assert.equal(unsafe.status, 'failed');
await assert.rejects(fs.access(path.join(unsafeFixture, 'output')));
await assert.rejects(fs.access(path.join(unsafeFixture, '.svger-cache')));

await fs.rm(fixture, { recursive: true, force: true });
await fs.rm(unsafeFixture, { recursive: true, force: true });
console.log('Phase 1 content-addressable cache contracts passed.');
