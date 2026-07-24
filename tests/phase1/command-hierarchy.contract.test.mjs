import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CleanCommand,
  ConfigCommand,
  ConfigExplainCommand,
  GenerateCommand,
  LockCommand,
  MigrateCommand,
  OptimizeCommand,
  PluginsCommand,
  RecoverCommand,
  UnlockCommand,
  WatchCommand,
  executeCommand,
} from '../../dist/index.js';

for (const CommandType of [
  CleanCommand,
  ConfigCommand,
  ConfigExplainCommand,
  GenerateCommand,
  LockCommand,
  MigrateCommand,
  OptimizeCommand,
  PluginsCommand,
  RecoverCommand,
  UnlockCommand,
  WatchCommand,
]) {
  assert.equal(typeof CommandType.prototype.validate, 'function');
  assert.equal(typeof CommandType.prototype.execute, 'function');
}

let executed = false;
await assert.rejects(
  executeCommand(
    {
      validate() {
        throw new Error('validation stopped dispatch');
      },
      async execute() {
        executed = true;
      },
    },
    {}
  ),
  /validation stopped dispatch/
);
assert.equal(executed, false);

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const cliPath = path.join(repository, 'dist', 'cli.js');
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-p1-command-'));
await fs.mkdir(path.join(fixture, 'icons'));
await fs.writeFile(path.join(fixture, 'icons', 'plain.svg'), '<svg/>');

const javascript = spawnSync(
  process.execPath,
  [cliPath, 'build', 'icons', 'output', '--no-typescript', '--format', 'json'],
  { cwd: fixture, encoding: 'utf8' }
);
assert.equal(javascript.status, 0, javascript.stderr);
assert.equal(JSON.parse(javascript.stdout).exitCode, 0);
await fs.access(path.join(fixture, 'output', 'Plain.jsx'));
await fs.access(path.join(fixture, 'output', 'index.js'));

const unknown = spawnSync(
  process.execPath,
  [cliPath, 'build', 'icons', 'ignored', '--unknown-option'],
  { cwd: fixture, encoding: 'utf8' }
);
assert.equal(unknown.status, 2);
await assert.rejects(fs.access(path.join(fixture, 'ignored')));

const explain = spawnSync(
  process.execPath,
  [cliPath, 'config', 'explain', 'framework', '--format', 'json'],
  { cwd: fixture, encoding: 'utf8' }
);
assert.equal(explain.status, 0, explain.stderr);
assert.deepEqual(JSON.parse(explain.stdout), [
  { path: 'framework', origin: 'default', value: 'react' },
]);

await fs.mkdir(path.join(fixture, 'unsafe'));
await fs.writeFile(
  path.join(fixture, 'unsafe', 'unsafe.svg'),
  '<svg><script>alert(1)</script></svg>'
);
const unsafeOptimize = spawnSync(
  process.execPath,
  [cliPath, 'optimize', 'unsafe', 'optimized'],
  { cwd: fixture, encoding: 'utf8' }
);
assert.equal(unsafeOptimize.status, 5);

await fs.rm(fixture, { recursive: true, force: true });
console.log('Phase 1 command hierarchy and typed option contracts passed.');
