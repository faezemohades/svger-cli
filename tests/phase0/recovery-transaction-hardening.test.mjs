import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recoverOutputTransactions } from '../../dist/index.js';

const lexicalFixture = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-recovery-hardening-')
);
const fixture = await fs.realpath(lexicalFixture);
console.log(
  `Recovery hardening fixture paths: lexical=${lexicalFixture}; physical=${fixture}`
);
const recoveryRoot = path.join(fixture, 'transactions');
await fs.mkdir(recoveryRoot);

function paths(id) {
  const stageDir = path.join(recoveryRoot, `.svger-stage-${id}`);
  const outputDir = path.join(recoveryRoot, `output-${id}`);
  return { stageDir, outputDir };
}

function journal(id, overrides = {}) {
  const { stageDir, outputDir } = paths(id);
  const outputPath = path.join(outputDir, 'Icon.tsx');
  return {
    schemaVersion: '1.0.0',
    id,
    state: 'committing',
    outputDir,
    stageDir,
    entries: [
      {
        outputPath,
        stagedPath: path.join(stageDir, 'files', 'Icon.tsx'),
        backupPath: path.join(stageDir, 'backup', 'Icon.tsx'),
        hadOriginal: false,
        committed: true,
      },
    ],
    ...overrides,
  };
}

async function writeJournal(id, value) {
  const journalPath = path.join(
    recoveryRoot,
    `.svger-transaction-${id}.json`
  );
  await fs.writeFile(journalPath, JSON.stringify(value), { mode: 0o600 });
  await fs.chmod(journalPath, 0o600);
}

// A legitimate interrupted transaction restores an original output and removes
// the transaction artifacts. A second recovery is intentionally a no-op.
{
  const id = 'legitimate';
  const value = journal(id, {
    entries: [
      {
        outputPath: path.join(paths(id).outputDir, 'Icon.tsx'),
        stagedPath: path.join(paths(id).stageDir, 'files', 'Icon.tsx'),
        backupPath: path.join(paths(id).stageDir, 'backup', 'Icon.tsx'),
        hadOriginal: true,
        committed: true,
      },
    ],
  });
  await fs.mkdir(path.dirname(value.entries[0].backupPath), {
    recursive: true,
  });
  await fs.chmod(value.stageDir, 0o700);
  await fs.mkdir(value.outputDir, { recursive: true });
  await fs.writeFile(value.entries[0].outputPath, 'replacement');
  await fs.writeFile(value.entries[0].backupPath, 'original');
  await writeJournal(id, value);
  assert.deepEqual(await recoverOutputTransactions(recoveryRoot), {
    inspected: 1,
    recovered: 1,
    diagnostics: [],
  });
  assert.equal(
    await fs.readFile(value.entries[0].outputPath, 'utf8'),
    'original'
  );
  assert.deepEqual(await recoverOutputTransactions(recoveryRoot), {
    inspected: 0,
    recovered: 0,
    diagnostics: [],
  });
}

// An interruption after stage cleanup is already committed. Old journals lack
// the explicit committed state, so recovery must retain its output.
{
  const id = 'cleanup-interrupted';
  const value = journal(id, { state: 'committed' });
  await fs.mkdir(value.outputDir, { recursive: true });
  await fs.writeFile(value.entries[0].outputPath, 'committed output');
  await writeJournal(id, value);
  assert.equal((await recoverOutputTransactions(recoveryRoot)).recovered, 1);
  assert.equal(
    await fs.readFile(value.entries[0].outputPath, 'utf8'),
    'committed output'
  );
}

const outsideFile = path.join(fixture, 'must-not-change.txt');
await fs.writeFile(outsideFile, 'protected');

// Path traversal/absolute escape cannot point rollback at a non-transaction file.
{
  const id = 'path-escape';
  const value = journal(id);
  value.entries[0].outputPath = outsideFile;
  await writeJournal(id, value);
}

// A stage directory symlink must be rejected before any recursive cleanup.
{
  const id = 'symlink-escape';
  const value = journal(id);
  const externalStage = path.join(fixture, 'external-stage');
  await fs.mkdir(externalStage);
  await fs.writeFile(path.join(externalStage, 'sentinel'), 'protected');
  await fs.symlink(externalStage, value.stageDir, 'dir');
  await writeJournal(id, value);
}

// Corrupt JSON and incomplete original-file recovery metadata produce diagnostics
// and leave both the journal and output untouched.
const corruptJournalPath = path.join(
  recoveryRoot,
  '.svger-transaction-corrupt.json'
);
await fs.writeFile(corruptJournalPath, '{', { mode: 0o600 });
await fs.chmod(corruptJournalPath, 0o600);
{
  const id = 'incomplete';
  const value = journal(id, {
    entries: [
      {
        outputPath: path.join(paths(id).outputDir, 'Icon.tsx'),
        stagedPath: path.join(paths(id).stageDir, 'files', 'Icon.tsx'),
        backupPath: path.join(paths(id).stageDir, 'backup', 'Icon.tsx'),
        hadOriginal: true,
        committed: true,
      },
    ],
  });
  await fs.mkdir(value.outputDir, { recursive: true });
  await fs.writeFile(value.entries[0].outputPath, 'do not delete');
  await writeJournal(id, value);
}

const rejected = await recoverOutputTransactions(recoveryRoot);
assert.equal(rejected.inspected, 4);
assert.equal(rejected.recovered, 0);
assert.equal(rejected.diagnostics.length, 4);
assert.equal(await fs.readFile(outsideFile, 'utf8'), 'protected');
assert.equal(
  await fs.readFile(
    path.join(paths('incomplete').outputDir, 'Icon.tsx'),
    'utf8'
  ),
  'do not delete'
);
await fs.access(path.join(recoveryRoot, '.svger-transaction-path-escape.json'));

// A forged journal must not delete an unrelated existing sibling output merely
// because it is lexically inside the recovery root.
{
  const id = 'forged-sibling';
  const value = journal(id);
  const foreignStage = path.join(
    recoveryRoot,
    '.svger-stage-00000000-0000-0000-0000-000000000000-foreign'
  );
  value.stageDir = foreignStage;
  value.entries[0].stagedPath = path.join(foreignStage, 'files', 'Icon.tsx');
  value.entries[0].backupPath = path.join(foreignStage, 'backup', 'Icon.tsx');
  await fs.mkdir(value.outputDir, { recursive: true });
  await fs.writeFile(value.entries[0].outputPath, 'unrelated output');
  await writeJournal(id, value);
  const report = await recoverOutputTransactions(recoveryRoot);
  assert.equal(report.recovered, 0);
  assert.ok(
    report.diagnostics.some(diagnostic =>
      diagnostic.startsWith('.svger-transaction-forged-sibling.json:')
    )
  );
  assert.equal(
    await fs.readFile(value.entries[0].outputPath, 'utf8'),
    'unrelated output'
  );
  await fs.access(path.join(recoveryRoot, `.svger-transaction-${id}.json`));
}

// If recovery was interrupted after backup->output restoration but before the
// journal was removed, a second invocation must recognize the restored output
// and complete cleanup without deleting it.
{
  const id = 'rollback-resume';
  const value = journal(id, {
    entries: [
      {
        outputPath: path.join(paths(id).outputDir, 'Icon.tsx'),
        stagedPath: path.join(paths(id).stageDir, 'files', 'Icon.tsx'),
        backupPath: path.join(paths(id).stageDir, 'backup', 'Icon.tsx'),
        hadOriginal: true,
        committed: true,
      },
    ],
  });
  await fs.mkdir(value.outputDir, { recursive: true });
  await fs.writeFile(value.entries[0].outputPath, 'restored original');
  await fs.mkdir(path.join(value.stageDir, 'rollback'), { recursive: true });
  await fs.chmod(value.stageDir, 0o700);
  await fs.writeFile(
    path.join(value.stageDir, 'rollback', '0'),
    'restore-started'
  );
  await writeJournal(id, value);
  const report = await recoverOutputTransactions(recoveryRoot);
  assert.equal(report.recovered, 1);
  assert.equal(report.inspected, 6);
  assert.equal(report.diagnostics.length, 5);
  assert.equal(
    await fs.readFile(value.entries[0].outputPath, 'utf8'),
    'restored original'
  );
}

await fs.rm(fixture, { recursive: true, force: true });
console.log('Recovery transaction hardening regressions passed.');
