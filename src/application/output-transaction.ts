import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';
import { sanitizePublicError } from '../contracts/diagnostics.js';
import { resolveOutputArtifactPath } from '../security/input-safety.js';

const JOURNAL_PREFIX = '.svger-transaction-';
const JOURNAL_SUFFIX = '.json';
const MAX_JOURNAL_SIZE_BYTES = 1024 * 1024;
const MAX_JOURNAL_ENTRIES = 10_000;

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
  state: 'prepared' | 'committing' | 'committed';
  outputDir: string;
  stageDir: string;
  entries: TransactionEntry[];
}

interface ValidatedTransactionJournal extends TransactionJournal {
  readonly recoveryDirectory: string;
  readonly stageIdentityBound: boolean;
}

const JOURNAL_KEYS = new Set([
  'schemaVersion',
  'id',
  'state',
  'outputDir',
  'stageDir',
  'entries',
]);
const ENTRY_KEYS = new Set([
  'outputPath',
  'stagedPath',
  'backupPath',
  'hadOriginal',
  'committed',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: Set<string>
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.size && actualKeys.every(key => keys.has(key))
  );
}

function isAbsoluteNormalizedPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    path.isAbsolute(value) &&
    path.resolve(value) === value
  );
}

function isDirectChild(root: string, candidate: string): boolean {
  return path.dirname(candidate) === root;
}

function isBoundStageName(stageDir: string, id: string): boolean {
  return path.basename(stageDir).startsWith(`.svger-stage-${id}-`);
}

function boundStageId(stageDir: string): string | undefined {
  const match = path
    .basename(stageDir)
    .match(/^\.svger-stage-([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})-/i);
  return match?.[1];
}

function isDescendant(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function lstatOrUndefined(
  filePath: string
): Promise<import('fs').Stats | undefined> {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return undefined;
    throw error;
  }
}

/**
 * Resolves the nearest existing parent and proves that it stays in the recovery
 * directory. This prevents a journal from using a symlinked intermediate
 * directory to escape an otherwise lexically contained path.
 */
async function assertNoSymlinkEscape(
  recoveryDirectory: string,
  candidate: string,
  label: string
): Promise<void> {
  if (!isDescendant(recoveryDirectory, candidate)) {
    throw new Error(`${label} escapes the authorized recovery directory.`);
  }

  let ancestor = candidate;
  let stat = await lstatOrUndefined(ancestor);
  if (stat?.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link.`);
  }
  while (stat === undefined) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) {
      throw new Error(`${label} has no authorized existing parent.`);
    }
    ancestor = parent;
    stat = await lstatOrUndefined(ancestor);
    if (stat?.isSymbolicLink()) {
      throw new Error(`${label} traverses a symbolic link.`);
    }
  }

  const physicalAncestor = await fs.realpath(ancestor);
  if (
    !isDescendant(recoveryDirectory, physicalAncestor) &&
    physicalAncestor !== recoveryDirectory
  ) {
    throw new Error(`${label} escapes through a symbolic link.`);
  }
}

async function assertRegularFileOrAbsent(
  filePath: string,
  label: string
): Promise<void> {
  const stat = await lstatOrUndefined(filePath);
  if (stat === undefined) return;
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular file when present.`);
  }
}

function assertPrivateOwned(stat: import('fs').Stats, label: string): void {
  const uid = process.getuid?.();
  if (uid !== undefined && stat.uid !== uid) {
    throw new Error(`${label} is not owned by the recovery user.`);
  }
  if ((stat.mode & 0o022) !== 0) {
    throw new Error(`${label} is writable by another user.`);
  }
}

async function validateJournal(
  rawJournal: unknown,
  journalName: string,
  recoveryDirectory: string
): Promise<ValidatedTransactionJournal> {
  if (!isRecord(rawJournal) || !hasExactKeys(rawJournal, JOURNAL_KEYS)) {
    throw new Error('Journal schema is malformed.');
  }
  if (rawJournal.schemaVersion !== '1.0.0') {
    throw new Error('Unsupported transaction journal schema.');
  }
  if (
    typeof rawJournal.id !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(rawJournal.id) ||
    journalName !== `${JOURNAL_PREFIX}${rawJournal.id}${JOURNAL_SUFFIX}`
  ) {
    throw new Error('Journal identity does not match its file name.');
  }
  if (
    rawJournal.state !== 'prepared' &&
    rawJournal.state !== 'committing' &&
    rawJournal.state !== 'committed'
  ) {
    throw new Error('Journal state is invalid.');
  }
  if (
    !isAbsoluteNormalizedPath(rawJournal.outputDir) ||
    !isAbsoluteNormalizedPath(rawJournal.stageDir) ||
    !isDirectChild(recoveryDirectory, rawJournal.outputDir) ||
    !isDirectChild(recoveryDirectory, rawJournal.stageDir) ||
    !path.basename(rawJournal.stageDir).startsWith('.svger-stage-') ||
    !Array.isArray(rawJournal.entries) ||
    rawJournal.entries.length === 0 ||
    rawJournal.entries.length > MAX_JOURNAL_ENTRIES
  ) {
    throw new Error(
      'Journal paths are outside the authorized transaction scope.'
    );
  }
  const stageId = boundStageId(rawJournal.stageDir);
  if (stageId !== undefined && stageId !== rawJournal.id) {
    throw new Error('Stage directory identity does not match the journal.');
  }

  await assertNoSymlinkEscape(
    recoveryDirectory,
    rawJournal.outputDir,
    'outputDir'
  );
  await assertNoSymlinkEscape(
    recoveryDirectory,
    rawJournal.stageDir,
    'stageDir'
  );
  const stageStat = await lstatOrUndefined(rawJournal.stageDir);
  if (stageStat !== undefined && !stageStat.isDirectory()) {
    throw new Error('stageDir must be a directory when present.');
  }
  if (stageStat !== undefined) {
    assertPrivateOwned(stageStat, 'stageDir');
  }

  const entries: TransactionEntry[] = [];
  const outputPaths = new Set<string>();
  for (const rawEntry of rawJournal.entries) {
    if (!isRecord(rawEntry) || !hasExactKeys(rawEntry, ENTRY_KEYS)) {
      throw new Error('Journal entry schema is malformed.');
    }
    if (
      !isAbsoluteNormalizedPath(rawEntry.outputPath) ||
      !isAbsoluteNormalizedPath(rawEntry.stagedPath) ||
      !isAbsoluteNormalizedPath(rawEntry.backupPath) ||
      typeof rawEntry.hadOriginal !== 'boolean' ||
      typeof rawEntry.committed !== 'boolean'
    ) {
      throw new Error('Journal entry contains invalid values.');
    }
    if (!isDescendant(rawJournal.outputDir, rawEntry.outputPath)) {
      throw new Error('Journal output path escapes outputDir.');
    }
    const relativeOutputPath = path.relative(
      rawJournal.outputDir,
      rawEntry.outputPath
    );
    if (
      rawEntry.stagedPath !==
        path.join(rawJournal.stageDir, 'files', relativeOutputPath) ||
      rawEntry.backupPath !==
        path.join(rawJournal.stageDir, 'backup', relativeOutputPath) ||
      outputPaths.has(rawEntry.outputPath)
    ) {
      throw new Error(
        'Journal entry paths do not match the transaction layout.'
      );
    }
    outputPaths.add(rawEntry.outputPath);
    await assertNoSymlinkEscape(
      recoveryDirectory,
      rawEntry.outputPath,
      'outputPath'
    );
    await assertNoSymlinkEscape(
      recoveryDirectory,
      rawEntry.stagedPath,
      'stagedPath'
    );
    await assertNoSymlinkEscape(
      recoveryDirectory,
      rawEntry.backupPath,
      'backupPath'
    );
    await assertRegularFileOrAbsent(rawEntry.outputPath, 'outputPath');
    await assertRegularFileOrAbsent(rawEntry.stagedPath, 'stagedPath');
    await assertRegularFileOrAbsent(rawEntry.backupPath, 'backupPath');
    entries.push({
      outputPath: rawEntry.outputPath,
      stagedPath: rawEntry.stagedPath,
      backupPath: rawEntry.backupPath,
      hadOriginal: rawEntry.hadOriginal,
      committed: rawEntry.committed,
    });
  }

  if (
    (rawJournal.state === 'prepared' &&
      entries.some(entry => entry.committed)) ||
    (rawJournal.state === 'committed' &&
      entries.some(entry => !entry.committed))
  ) {
    throw new Error('Journal state is inconsistent with its entries.');
  }

  return {
    schemaVersion: '1.0.0',
    id: rawJournal.id,
    state: rawJournal.state,
    outputDir: rawJournal.outputDir,
    stageDir: rawJournal.stageDir,
    entries,
    recoveryDirectory,
    stageIdentityBound: isBoundStageName(rawJournal.stageDir, rawJournal.id),
  };
}

export interface OutputContent {
  outputFileName: string;
  content: string;
}

// Serialize in-process transactions targeting the same output directory. Each
// transaction still stages privately; the lock only protects the shared final
// names and the hadOriginal snapshots from interleaving with another commit.
const outputDirectoryTails = new Map<string, Promise<void>>();
let outputDirectoryPendingWaiters = 0;

/** @internal Exposed only from this module for lifecycle regression tests. */
export function getOutputTransactionLockCountForTesting(): number {
  return outputDirectoryTails.size;
}

/** @internal Exposed only from this module for lock-order regression tests. */
export function getOutputTransactionPendingWaiterCountForTesting(): number {
  return outputDirectoryPendingWaiters;
}

async function withOutputDirectoryLock<T>(
  outputDir: string,
  operation: () => Promise<T>
): Promise<T> {
  const resolved = path.resolve(outputDir);
  const parentDir = path.dirname(resolved);
  await fs.mkdir(parentDir, { recursive: true });
  let key: string;
  try {
    key = await fs.realpath(resolved);
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error;
    key = path.join(await fs.realpath(parentDir), path.basename(resolved));
  }
  const previous = outputDirectoryTails.get(key);
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  outputDirectoryTails.set(key, current);
  if (previous !== undefined) {
    outputDirectoryPendingWaiters++;
    try {
      await previous;
    } finally {
      outputDirectoryPendingWaiters--;
    }
  }
  try {
    return await operation();
  } finally {
    release();
    if (outputDirectoryTails.get(key) === current) {
      outputDirectoryTails.delete(key);
    }
  }
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

function rollbackMarkerPath(
  journal: ValidatedTransactionJournal,
  entryIndex: number
): string {
  return path.join(journal.stageDir, 'rollback', String(entryIndex));
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
  // Use the same marker-backed rollback path as recovery. If this process is
  // interrupted, the journal and per-entry markers remain resumable.
  await rollbackValidatedJournal({
    ...journal,
    recoveryDirectory: path.dirname(journal.stageDir),
    stageIdentityBound: true,
  });
}

async function rollbackValidatedJournal(
  journal: ValidatedTransactionJournal
): Promise<void> {
  const rollbackEntries = journal.entries
    .map((entry, entryIndex) => ({ entry, entryIndex }))
    .reverse();
  for (const { entryIndex, entry } of rollbackEntries) {
    // Re-check immediately before mutation to reduce the TOCTOU window and to
    // ensure recovery never follows a link introduced after schema validation.
    await assertNoSymlinkEscape(
      journal.recoveryDirectory,
      entry.outputPath,
      'outputPath'
    );
    await assertNoSymlinkEscape(
      journal.recoveryDirectory,
      entry.stagedPath,
      'stagedPath'
    );
    await assertNoSymlinkEscape(
      journal.recoveryDirectory,
      entry.backupPath,
      'backupPath'
    );
    const markerPath = rollbackMarkerPath(journal, entryIndex);
    await assertNoSymlinkEscape(
      journal.recoveryDirectory,
      markerPath,
      'rollback marker'
    );
    await assertRegularFileOrAbsent(entry.outputPath, 'outputPath');
    await assertRegularFileOrAbsent(entry.stagedPath, 'stagedPath');
    await assertRegularFileOrAbsent(entry.backupPath, 'backupPath');
    await assertRegularFileOrAbsent(markerPath, 'rollback marker');

    const backupExists = await exists(entry.backupPath);
    const outputExists = await exists(entry.outputPath);
    const stagedExists = await exists(entry.stagedPath);
    const rollbackStarted = await exists(markerPath);

    if (backupExists) {
      await fs.mkdir(path.dirname(markerPath), { recursive: true });
      if (!rollbackStarted) {
        await fs.writeFile(markerPath, 'restore-started', {
          encoding: 'utf8',
          flag: 'wx',
          mode: 0o600,
        });
      }
      if (outputExists) await fs.rm(entry.outputPath, { force: true });
      await fs.rename(entry.backupPath, entry.outputPath);
    } else if (entry.hadOriginal && !stagedExists && outputExists) {
      if (!rollbackStarted) {
        throw new Error(
          'Journal has ambiguous output ownership; refusing recovery.'
        );
      }
      // The backup was already renamed before interruption. Keep the restored
      // output and allow the next recovery pass to finish cleanup.
    } else if (!entry.hadOriginal && outputExists) {
      const legacyStageLayout =
        !journal.stageIdentityBound &&
        (await lstatOrUndefined(journal.stageDir))?.isDirectory() === true &&
        (
          await lstatOrUndefined(path.join(journal.stageDir, 'files'))
        )?.isDirectory() === true &&
        (
          await lstatOrUndefined(path.join(journal.stageDir, 'backup'))
        )?.isDirectory() === true;
      if (!legacyStageLayout) {
        throw new Error(
          'Journal has ambiguous output ownership; refusing recovery.'
        );
      }
      // Legacy journals predate stage-to-transaction binding. Preserve their
      // historical rollback behavior for compatibility; newly created
      // transactions always take the safe ambiguous-state path above.
      await fs.rm(entry.outputPath, { force: true });
    }
  }
}

async function removeValidatedStageDirectory(
  journal: ValidatedTransactionJournal
): Promise<void> {
  const stageStat = await lstatOrUndefined(journal.stageDir);
  if (stageStat === undefined) return;
  if (stageStat.isSymbolicLink() || !stageStat.isDirectory()) {
    throw new Error('stageDir must be a non-symbolic directory when removed.');
  }
  assertPrivateOwned(stageStat, 'stageDir');
  await assertNoSymlinkEscape(
    journal.recoveryDirectory,
    journal.stageDir,
    'stageDir'
  );
  await fs.rm(journal.stageDir, { recursive: true, force: true });
}

/** Commit a complete set of files through same-filesystem atomic renames. */
export async function commitOutputTransaction(
  outputDir: string,
  contents: readonly OutputContent[]
): Promise<void> {
  if (contents.length === 0) return;
  return withOutputDirectoryLock(outputDir, () =>
    commitOutputTransactionLocked(outputDir, contents)
  );
}

async function commitOutputTransactionLocked(
  outputDir: string,
  contents: readonly OutputContent[]
): Promise<void> {
  const resolvedOutputDir = path.resolve(outputDir);
  const parentDir = path.dirname(resolvedOutputDir);
  await fs.mkdir(parentDir, { recursive: true });
  const id = randomUUID();
  const stageDir = await fs.mkdtemp(
    path.join(parentDir, `.svger-stage-${id}-`)
  );
  const filesDir = path.join(stageDir, 'files');
  const backupDir = path.join(stageDir, 'backup');
  await fs.mkdir(filesDir);
  await fs.mkdir(backupDir);

  const entries: TransactionEntry[] = [];
  const journalPath = path.join(
    parentDir,
    `${JOURNAL_PREFIX}${id}${JOURNAL_SUFFIX}`
  );
  let committedJournalPersisted = false;
  let journal: TransactionJournal | undefined;

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

    journal = {
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

    journal.state = 'committed';
    await writeJournalAtomic(journalPath, journal);
    committedJournalPersisted = true;
    await fs.rm(stageDir, { recursive: true, force: true });
    await fs.rm(journalPath, { force: true });
  } catch (error) {
    let rollbackError: unknown;
    try {
      if (!committedJournalPersisted) {
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
      }
    } catch (errorDuringRollback) {
      // Preserve the journal and staging directory for explicit recovery.
      rollbackError = errorDuringRollback;
    }
    if (committedJournalPersisted) {
      throw new DiagnosticError(
        'E_OUTPUT_TRANSACTION_CLEANUP',
        'The output transaction committed, but cleanup was interrupted; rerun recovery.',
        { exitCode: ExitCode.FilesystemFailure, cause: error }
      );
    }
    if (rollbackError !== undefined) {
      throw new DiagnosticError(
        'E_OUTPUT_TRANSACTION',
        'The output transaction failed and rollback is incomplete; rerun recovery.',
        {
          exitCode: ExitCode.FilesystemFailure,
          cause: error,
          metadata: {
            rollback: 'incomplete',
            rollbackError:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError),
          },
        }
      );
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      (error as { code: string }).code.startsWith('E_')
    ) {
      throw error;
    }
    throw new DiagnosticError(
      'E_OUTPUT_TRANSACTION',
      'The output transaction failed and was rolled back.',
      { exitCode: ExitCode.FilesystemFailure, cause: error }
    );
  }
}

/** Generate a complete output set privately, then commit it as one transaction. */
export async function runStagedOutputBuild(
  outputDir: string,
  generate: (stageDir: string) => Promise<void>
): Promise<void> {
  const absoluteOutputDir = path.resolve(outputDir);
  const parentDir = path.dirname(absoluteOutputDir);
  await fs.mkdir(parentDir, { recursive: true });
  const stageDir = await fs.mkdtemp(
    path.join(parentDir, '.svger-build-stage-')
  );
  try {
    await generate(stageDir);
    const entries = await fs.readdir(stageDir, { withFileTypes: true });
    const outputs: OutputContent[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) {
        throw new DiagnosticError(
          'E_OUTPUT_STAGE_INVALID',
          'Build staging may contain files only.',
          { exitCode: ExitCode.FilesystemFailure }
        );
      }
      outputs.push({
        outputFileName: entry.name,
        content: await fs.readFile(path.join(stageDir, entry.name), 'utf8'),
      });
    }
    if (outputs.length > 0) {
      await commitOutputTransaction(absoluteOutputDir, outputs);
    }
  } catch (error) {
    throw sanitizePublicError(error);
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
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
  let directory = path.resolve(searchDirectory);
  let names: string[];
  try {
    names = await fs.readdir(directory);
    // Use the physical directory as the authorization boundary. A caller may
    // name it through a symlink, but journal paths must never escape its target.
    directory = await fs.realpath(directory);
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
      const journalStat = await lstatOrUndefined(journalPath);
      if (
        journalStat === undefined ||
        journalStat.isSymbolicLink() ||
        !journalStat.isFile()
      ) {
        throw new Error('Journal must be a regular file.');
      }
      assertPrivateOwned(journalStat, 'journal');
      if (journalStat.size > MAX_JOURNAL_SIZE_BYTES) {
        throw new Error('Journal exceeds the maximum supported size.');
      }
      const journal = await validateJournal(
        JSON.parse(await fs.readFile(journalPath, 'utf8')) as unknown,
        name,
        directory
      );

      if (journal.state !== 'committed') {
        await rollbackValidatedJournal(journal);
      }
      await removeValidatedStageDirectory(journal);
      await assertRegularFileOrAbsent(journalPath, 'journal');
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
