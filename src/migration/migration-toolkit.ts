import { constants, promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';

export type MigrationTarget = 'config' | 'imports' | 'plugins';

export interface MigrationOptions {
  target: MigrationTarget;
  inputPath: string;
  dryRun?: boolean;
  backup?: boolean;
}

export interface MigrationChange {
  file: string;
  description: string;
  before: string;
  after: string;
}

export interface MigrationReport {
  schemaVersion: '1.0.0';
  target: MigrationTarget;
  mode: 'dry-run' | 'write';
  changed: boolean;
  wrote: boolean;
  changes: readonly MigrationChange[];
  backups: readonly string[];
  diagnostics: readonly {
    code: string;
    severity: 'info' | 'warning';
    message: string;
  }[];
}

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => stableObject(item));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, child]) => [key, stableObject(child)])
    );
  }
  return value;
}

function serializeJSON(value: unknown): string {
  return `${JSON.stringify(stableObject(value), null, 2)}\n`;
}

function migrateConfigObject(
  input: Record<string, unknown>
): Record<string, unknown> {
  const output = structuredClone(input);
  if ('plugin' in output && !('plugins' in output)) {
    output.plugins = Array.isArray(output.plugin)
      ? output.plugin
      : [output.plugin];
  }
  delete output.plugin;
  output.version = '4.1.0';
  return output;
}

function migratePluginObject(
  input: Record<string, unknown>
): Record<string, unknown> {
  const output = migrateConfigObject(input);
  if (!Array.isArray(output.plugins)) output.plugins = [];
  const plugins = output.plugins as unknown[];
  output.plugins = plugins.map(plugin =>
    typeof plugin === 'string' ? { name: plugin, options: {} } : plugin
  );
  return output;
}

function migrateImportContent(content: string): string {
  return content
    .replace(/(['"])svger-cli\/dist\/builder(?:\.js)?\1/gu, '$1svger-cli$1')
    .replace(
      /(['"])svger-cli\/dist\/services\/svg-service(?:\.js)?\1/gu,
      '$1svger-cli$1'
    )
    .replace(
      /(['"])svger-cli\/dist\/integrations\/(webpack|vite|rollup|babel|nextjs|jest-preset)(?:\.js)?\1/gu,
      (_match, quote: string, integration: string) =>
        `${quote}svger-cli/${integration === 'jest-preset' ? 'jest' : integration}${quote}`
    );
}

async function discoverMigrationFiles(inputPath: string): Promise<string[]> {
  const stat = await fs.lstat(inputPath);
  if (stat.isSymbolicLink()) {
    throw new DiagnosticError(
      'E_MIGRATION_SYMLINK',
      'Migration refuses symbolic-link inputs.',
      { exitCode: ExitCode.FilesystemFailure, file: inputPath }
    );
  }
  if (stat.isFile()) return [inputPath];
  if (!stat.isDirectory()) return [];

  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/u.test(entry.name)) {
        files.push(entryPath);
      }
      if (files.length > 10_000) {
        throw new DiagnosticError(
          'E_MIGRATION_FILE_LIMIT',
          'Migration input exceeded 10,000 source files.',
          { exitCode: ExitCode.InvalidConfiguration }
        );
      }
    }
  }
  await visit(inputPath);
  return files;
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`
  );
  await fs.writeFile(temporaryPath, content, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

async function backupFile(filePath: string): Promise<string> {
  const backupPath = `${filePath}.svger-v4.bak`;
  await fs
    .copyFile(filePath, backupPath, constants.COPYFILE_EXCL)
    .catch(async error => {
      if ((error as { code?: string }).code !== 'EEXIST') throw error;
      const existing = await fs.readFile(backupPath);
      const current = await fs.readFile(filePath);
      if (!existing.equals(current)) {
        throw new DiagnosticError(
          'E_MIGRATION_BACKUP_EXISTS',
          `Backup already exists with different content: ${backupPath}`,
          { exitCode: ExitCode.FilesystemFailure, file: backupPath }
        );
      }
    });
  return backupPath;
}

export async function runMigration(
  options: MigrationOptions
): Promise<MigrationReport> {
  const inputPath = path.resolve(options.inputPath);
  const files =
    options.target === 'imports'
      ? await discoverMigrationFiles(inputPath)
      : await discoverMigrationFiles(inputPath);
  if (files.length !== 1 && options.target !== 'imports') {
    throw new DiagnosticError(
      'E_MIGRATION_CONFIG_PATH',
      `${options.target} migration requires one configuration file.`,
      { exitCode: ExitCode.UsageError, file: inputPath }
    );
  }

  const changes: MigrationChange[] = [];
  for (const file of files) {
    const before = await fs.readFile(file, 'utf8');
    let after: string;
    if (options.target === 'imports') {
      after = migrateImportContent(before);
    } else {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(before) as Record<string, unknown>;
      } catch (error) {
        throw new DiagnosticError(
          'E_MIGRATION_INVALID_JSON',
          `Invalid JSON configuration: ${file}`,
          { exitCode: ExitCode.InvalidConfiguration, file, cause: error }
        );
      }
      after = serializeJSON(
        options.target === 'plugins'
          ? migratePluginObject(parsed)
          : migrateConfigObject(parsed)
      );
    }
    if (before !== after) {
      changes.push({
        file,
        description: `${options.target} migration`,
        before,
        after,
      });
    }
  }

  const backups: string[] = [];
  if (!options.dryRun) {
    for (const change of changes) {
      if (options.backup !== false) backups.push(await backupFile(change.file));
      await writeAtomic(change.file, change.after);
    }
  }

  return Object.freeze({
    schemaVersion: '1.0.0',
    target: options.target,
    mode: options.dryRun ? 'dry-run' : 'write',
    changed: changes.length > 0,
    wrote: !options.dryRun && changes.length > 0,
    changes: Object.freeze(changes),
    backups: Object.freeze(backups),
    diagnostics: Object.freeze(
      changes.length === 0
        ? [
            {
              code: 'I_MIGRATION_NO_CHANGES',
              severity: 'info' as const,
              message: 'Input is already in the canonical v4.1 form.',
            },
          ]
        : []
    ),
  });
}
