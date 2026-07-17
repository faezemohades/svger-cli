import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { recoverOutputTransactions } from '../../dist/index.js';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-p1-recover-'));
const output = path.join(fixture, 'output');
const stage = path.join(fixture, '.svger-stage-recovery');
const backup = path.join(stage, 'backup');
const stagedFiles = path.join(stage, 'files');
await fs.mkdir(output);
await fs.mkdir(backup, { recursive: true });
await fs.mkdir(stagedFiles);

const createdOutput = path.join(output, 'Created.tsx');
const restoredOutput = path.join(output, 'Restored.tsx');
const restoredBackup = path.join(backup, 'Restored.tsx');
await fs.writeFile(createdOutput, 'new-created');
await fs.writeFile(restoredOutput, 'new-restored');
await fs.writeFile(restoredBackup, 'original-restored');

const journal = {
  schemaVersion: '1.0.0',
  id: 'recovery-test',
  state: 'committing',
  outputDir: output,
  stageDir: stage,
  entries: [
    {
      outputPath: createdOutput,
      stagedPath: path.join(stagedFiles, 'Created.tsx'),
      backupPath: path.join(backup, 'Created.tsx'),
      hadOriginal: false,
      committed: true,
    },
    {
      outputPath: restoredOutput,
      stagedPath: path.join(stagedFiles, 'Restored.tsx'),
      backupPath: restoredBackup,
      hadOriginal: true,
      committed: true,
    },
  ],
};
await fs.writeFile(
  path.join(fixture, '.svger-transaction-recovery-test.json'),
  JSON.stringify(journal)
);

const recovered = await recoverOutputTransactions(fixture);
assert.deepEqual(recovered, { inspected: 1, recovered: 1, diagnostics: [] });
await assert.rejects(fs.access(createdOutput));
assert.equal(await fs.readFile(restoredOutput, 'utf8'), 'original-restored');
await assert.rejects(fs.access(stage));

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const cli = spawnSync(
  process.execPath,
  [
    path.join(repository, 'dist', 'cli.js'),
    'recover',
    fixture,
    '--format',
    'json',
  ],
  { encoding: 'utf8' }
);
assert.equal(cli.status, 0, cli.stderr);
assert.deepEqual(JSON.parse(cli.stdout), {
  inspected: 0,
  recovered: 0,
  diagnostics: [],
});

await fs.rm(fixture, { recursive: true, force: true });
console.log('Phase 1 transaction recovery contracts passed.');
