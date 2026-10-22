import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  recoverOutputTransactions,
  writeOutputFileAtomic,
} from '../../dist/index.js';

const lexicalFixture = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-p1-recover-')
);
const fixture = await fs.realpath(lexicalFixture);
console.log(
  `Recovery fixture paths: lexical=${lexicalFixture}; physical=${fixture}`
);
const atomicRoot = path.join(fixture, 'atomic');
await writeOutputFileAtomic(atomicRoot, 'Atomic.tsx', 'first');
await writeOutputFileAtomic(atomicRoot, 'Atomic.tsx', 'second');
assert.equal(
  await fs.readFile(path.join(atomicRoot, 'Atomic.tsx'), 'utf8'),
  'second'
);
assert.deepEqual(await fs.readdir(atomicRoot), ['Atomic.tsx']);
const cancelledController = new AbortController();
cancelledController.abort('contract cancellation');
await assert.rejects(
  writeOutputFileAtomic(
    path.join(fixture, 'cancelled-atomic'),
    'Cancelled.tsx',
    'content',
    cancelledController.signal
  ),
  error => error.code === 'ABORT_ERR'
);
await assert.rejects(fs.access(path.join(fixture, 'cancelled-atomic')));
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

async function assertRejectedJournalPaths({
  id,
  recoveryRoot,
  rewritePath = value => value,
  outputPath = null,
  expectedDiagnostic,
}) {
  const output = path.join(recoveryRoot, `output-${id}`);
  const stage = path.join(recoveryRoot, `.svger-stage-${id}`);
  const outputFile = path.join(output, 'Icon.tsx');
  const actualOutputPath = outputPath ?? outputFile;
  await fs.mkdir(output);
  await fs.mkdir(path.join(stage, 'backup'), { recursive: true });
  await fs.mkdir(path.join(stage, 'files'), { recursive: true });
  await fs.writeFile(outputFile, 'must remain unchanged');

  const relativeOutputPath =
    outputPath === null
      ? path.relative(output, actualOutputPath)
      : 'Icon.tsx';
  const journal = {
    schemaVersion: '1.0.0',
    id,
    state: 'committing',
    outputDir: rewritePath(output),
    stageDir: rewritePath(stage),
    entries: [
      {
        outputPath: rewritePath(actualOutputPath),
        stagedPath: rewritePath(
          path.join(stage, 'files', relativeOutputPath)
        ),
        backupPath: rewritePath(
          path.join(stage, 'backup', relativeOutputPath)
        ),
        hadOriginal: false,
        committed: true,
      },
    ],
  };
  const journalPath = path.join(
    recoveryRoot,
    `.svger-transaction-${id}.json`
  );
  await fs.writeFile(journalPath, JSON.stringify(journal));

  const report = await recoverOutputTransactions(recoveryRoot);
  assert.equal(report.inspected, 1);
  assert.equal(report.recovered, 0);
  assert.equal(report.diagnostics.length, 1);
  assert.match(report.diagnostics[0], expectedDiagnostic);
  assert.equal(await fs.readFile(outputFile, 'utf8'), 'must remain unchanged');
  await fs.access(journalPath);
  await fs.access(stage);
}

// A real filesystem alias is exercised when the temporary directory has one.
// Otherwise the independent noncanonical-path case below still runs.
if (lexicalFixture !== fixture) {
  const id = 'filesystem-alias';
  const recoveryRoot = path.join(fixture, 'filesystem-alias-recovery');
  const aliasRecoveryRoot = `${lexicalFixture}${path.sep}filesystem-alias-recovery`;
  await fs.mkdir(recoveryRoot);
  assert.equal(await fs.realpath(aliasRecoveryRoot), recoveryRoot);

  await assertRejectedJournalPaths({
    id,
    recoveryRoot,
    rewritePath: value =>
      `${aliasRecoveryRoot}${path.sep}${path.relative(recoveryRoot, value)}`,
    expectedDiagnostic:
      /Journal paths are outside the authorized transaction scope\./,
  });
} else {
  console.log(
    'No filesystem path alias for the recovery fixture; deterministic noncanonical-path coverage follows.'
  );
}

// Noncanonical lexical spellings are always rejected, independently of whether
// the host exposes a physical filesystem alias such as /var -> /private/var.
{
  const id = 'noncanonical-path';
  const recoveryRoot = path.join(fixture, 'noncanonical-recovery');
  await fs.mkdir(recoveryRoot);
  await assertRejectedJournalPaths({
    id,
    recoveryRoot,
    rewritePath: value =>
      `${path.dirname(value)}${path.sep}.${path.sep}${path.basename(value)}`,
    expectedDiagnostic:
      /Journal paths are outside the authorized transaction scope\./,
  });
}

// A canonical journal with an output entry outside its declared output
// directory is a separate escape regression; it must not remove the sentinel.
{
  const id = 'canonical-output-escape';
  const recoveryRoot = path.join(fixture, 'canonical-escape-recovery');
  const outsideSentinel = path.join(fixture, 'outside-recovery-sentinel.txt');
  await fs.mkdir(recoveryRoot);
  await fs.writeFile(outsideSentinel, 'must remain unchanged');
  await assertRejectedJournalPaths({
    id,
    recoveryRoot,
    outputPath: outsideSentinel,
    expectedDiagnostic: /Journal output path escapes outputDir\./,
  });
  assert.equal(
    await fs.readFile(outsideSentinel, 'utf8'),
    'must remain unchanged'
  );
}

await fs.rm(fixture, { recursive: true, force: true });
console.log('Phase 1 transaction recovery contracts passed.');
