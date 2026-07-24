import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = path.join(repository, 'dist', 'cli.js');
const builderPath = path.join(repository, 'dist', 'builder.js');
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-p1-entry-'));
await fs.mkdir(path.join(fixture, 'icons'));
await fs.writeFile(
  path.join(fixture, 'icons', 'same.svg'),
  '<svg viewBox="0 0 10 10"><path d="M0 0h1v1z"/></svg>'
);

const cli = spawnSync(
  process.execPath,
  [cliPath, 'build', 'icons', 'cli-output', '--format', 'json'],
  { cwd: fixture, encoding: 'utf8' }
);
assert.equal(cli.status, 0, cli.stderr);
const cliReport = JSON.parse(cli.stdout);
assert.equal(cliReport.schemaVersion, '1.0.0');

const warnings = [];
process.on('warning', warning => {
  if (warning.code === 'DEP_SVGER_BUILDER') warnings.push(warning);
});
process.chdir(fixture);
const { buildAll } = await import(pathToFileURL(builderPath));
const facadeReport = await buildAll({ src: 'icons', out: 'facade-output' });
await buildAll({ src: 'icons', out: 'facade-output' });
await new Promise(resolve => setImmediate(resolve));
assert.equal(warnings.length, 1);
assert.equal(facadeReport.schemaVersion, '1.0.0');

assert.equal(
  await fs.readFile(path.join(fixture, 'cli-output', 'Same.tsx'), 'utf8'),
  await fs.readFile(path.join(fixture, 'facade-output', 'Same.tsx'), 'utf8')
);
assert.equal(
  await fs.readFile(path.join(fixture, 'cli-output', 'index.ts'), 'utf8'),
  await fs.readFile(path.join(fixture, 'facade-output', 'index.ts'), 'utf8')
);

const ndjson = spawnSync(
  process.execPath,
  [cliPath, 'build', 'icons', 'cli-output', '--format', 'ndjson', '--check'],
  { cwd: fixture, encoding: 'utf8' }
);
assert.equal(ndjson.status, 0, ndjson.stderr);
assert.deepEqual(
  ndjson.stdout
    .trim()
    .split('\n')
    .map(line => JSON.parse(line).type),
  ['report', 'artifact', 'artifact', 'diagnostic', 'summary']
);

const invalidFormat = spawnSync(
  process.execPath,
  [cliPath, 'build', 'icons', 'invalid-output', '--format', 'yaml'],
  { cwd: fixture, encoding: 'utf8' }
);
assert.equal(invalidFormat.status, 2);
assert.match(invalidFormat.stdout, /E_INVALID_REPORT_FORMAT/);
await assert.rejects(fs.access(path.join(fixture, 'invalid-output')));

process.chdir(repository);
await fs.rm(fixture, { recursive: true, force: true });
console.log('Phase 1 CLI and deprecated facade share the canonical build path.');
