import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';
import { resolveOutputArtifactPath } from '../security/input-safety.js';

const JOURNAL_PREFIX = '.svger-transaction-';
const JOURNAL_SUFFIX = '.json';

interface TransactionEntry {
  outputPath: string;
  stagedPath: string;
  backupPath: string;
  hadOriginal: boolean;
  committed: boolean;
}

interface TransactionJournal {
  schemaVersion: '1.0.0';
  id: string;
  state: 'prepared' | 'committing';
  outputDir: string;
  stageDir: string;
  entries: TransactionEntry[];
}

export interface OutputContent {
  outputFileName: string;
  content: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return false;
    throw error;
  }
}

async function writeJournalAtomic(
  journalPath: string,
  journal: TransactionJournal
): Promise<void> {
  const temporaryPath = `${journalPath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(journal, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.rename(temporaryPath, journalPath);
}

async function rollbackJournal(journal: TransactionJournal): Promise<void> {
  for (const entry of [...journal.entries].reverse()) {
    const backupExists = await exists(entry.backupPath);
    const outputExists = await exists(entry.outputPath);
    const stagedExists = await exists(entry.stagedPath);

    if (backupExists) {
      if (outputExists) await fs.rm(entry.outputPath, { force: true });
      await fs.rename(entry.backupPath, entry.outputPath);
    } else if (outputExists && (entry.committed || !stagedExists)) {
      await fs.rm(entry.outputPath, { force: true });
    }
  }
}

/** Commit a complete set of files through same-filesystem atomic renames. */
export async function commitOutputTransaction(
  outputDir: string,
  contents: readonly OutputContent[]
): Promise<void> {
  if (contents.length === 0) return;
  const resolvedOutputDir = path.resolve(outputDir);
  const parentDir = path.dirname(resolvedOutputDir);
  await fs.mkdir(parentDir, { recursive: true });
  const id = randomUUID();
  const stageDir = await fs.mkdtemp(path.join(parentDir, '.svger-stage-'));
  const filesDir = path.join(stageDir, 'files');
  const backupDir = path.join(stageDir, 'backup');
  await fs.mkdir(filesDir);
  await fs.mkdir(backupDir);

  const entries: TransactionEntry[] = [];
  const journalPath = path.join(
    parentDir,
    `${JOURNAL_PREFIX}${id}${JOURNAL_SUFFIX}`
  );

  try {
    for (const item of contents) {
      const outputPath = resolveOutputArtifactPath(
        resolvedOutputDir,
        item.outputFileName
      );
      const stagedPath = resolveOutputArtifactPath(
        filesDir,
        item.outputFileName
      );
      const backupPath = resolveOutputArtifactPath(
        backupDir,
        item.outputFileName
      );
      await fs.mkdir(path.dirname(stagedPath), { recursive: true });
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.writeFile(stagedPath, item.content, 'utf8');
      entries.push({
        outputPath,
        stagedPath,
        backupPath,
        hadOriginal: await exists(outputPath),
        committed: false,
      });
    }

    const journal: TransactionJournal = {
      schemaVersion: '1.0.0',
      id,
      state: 'prepared',
      outputDir: resolvedOutputDir,
      stageDir,
      entries,
    };
    await writeJournalAtomic(journalPath, journal);
    await fs.mkdir(resolvedOutputDir, { recursive: true });
    journal.state = 'committing';
    await writeJournalAtomic(journalPath, journal);

    for (const entry of entries) {
      if (entry.hadOriginal) {
        await fs.rename(entry.outputPath, entry.backupPath);
      }
      await fs.rename(entry.stagedPath, entry.outputPath);
      entry.committed = true;
      await writeJournalAtomic(journalPath, journal);
    }

    await fs.rm(stageDir, { recursive: true, force: true });
    await fs.rm(journalPath, { force: true });
  } catch (error) {
    try {
      await rollbackJournal({
        schemaVersion: '1.0.0',
        id,
        state: 'committing',
        outputDir: resolvedOutputDir,
        stageDir,
        entries,
      });
      await fs.rm(stageDir, { recursive: true, force: true });
      await fs.rm(journalPath, { force: true });
      await fs.rm(`${journalPath}.tmp`, { force: true });
    } catch {
      // Preserve the journal and staging directory for explicit recovery.
    }
    throw new DiagnosticError(
      'E_OUTPUT_TRANSACTION',
      'The output transaction failed and was rolled back.',
      { exitCode: ExitCode.FilesystemFailure, cause: error }
    );
  }
}

export interface RecoveryReport {
  inspected: number;
  recovered: number;
  diagnostics: readonly string[];
}

/** Inspect a specific parent directory and roll back incomplete transactions. */
export async function recoverOutputTransactions(
  searchDirectory: string
): Promise<RecoveryReport> {
  const directory = path.resolve(searchDirectory);
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch (error) {
    throw new DiagnosticError(
      'E_RECOVERY_SCAN',
      `Unable to inspect transaction journals in ${directory}.`,
      { exitCode: ExitCode.FilesystemFailure, cause: error }
    );
  }

  const journals = names
    .filter(
      name => name.startsWith(JOURNAL_PREFIX) && name.endsWith(JOURNAL_SUFFIX)
    )
    .sort((left, right) => left.localeCompare(right, 'en'));
  const diagnostics: string[] = [];
  let recovered = 0;

  for (const name of journals) {
    const journalPath = path.join(directory, name);
    try {
      const journal = JSON.parse(
        await fs.readFile(journalPath, 'utf8')
      ) as TransactionJournal;
      if (
        journal.schemaVersion !== '1.0.0' ||
        !Array.isArray(journal.entries)
      ) {
        throw new Error('Unsupported transaction journal schema.');
      }
      await rollbackJournal(journal);
      await fs.rm(journal.stageDir, { recursive: true, force: true });
      await fs.rm(journalPath, { force: true });
      recovered++;
    } catch (error) {
      diagnostics.push(
        `${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return Object.freeze({
    inspected: journals.length,
    recovered,
    diagnostics: Object.freeze(diagnostics),
  });
}
