import { promises as fs } from 'fs';
import path from 'path';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';

export type SymlinkPolicy = 'ignore' | 'follow' | 'error';

export interface SourceDiscoveryOptions {
  sourceDir: string;
  outputDir: string;
  recursive?: boolean;
  include?: readonly string[];
  exclude?: readonly string[];
  includeHidden?: boolean;
  symlinks?: SymlinkPolicy;
  maxFileCount?: number;
  signal?: AbortSignal;
}

export interface DiscoveredSource {
  absolutePath: string;
  relativePath: string;
}

function normalizeRelative(value: string): string {
  return value.split(path.sep).join('/').normalize('NFC');
}

function globToRegExp(pattern: string): RegExp {
  let expression = '^';
  const normalized = normalizeRelative(pattern);
  for (let index = 0; index < normalized.length; index++) {
    const character = normalized[index];
    if (character === '*' && normalized[index + 1] === '*') {
      expression += '.*';
      index++;
    } else if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += character.replace(/[\\^$+.()|{}[\]]/g, '\\$&');
    }
  }
  return new RegExp(`${expression}$`, 'iu');
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(value));
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DiagnosticError('E_BUILD_CANCELLED', 'Build was cancelled.', {
      exitCode: ExitCode.BuildCancelled,
      cause: signal.reason,
    });
  }
}

function isInside(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

/** Discover SVG inputs in normalized, stable lexical order. */
export async function discoverSVGInputs(
  options: SourceDiscoveryOptions
): Promise<readonly DiscoveredSource[]> {
  const sourceDir = path.resolve(options.sourceDir);
  const outputDir = path.resolve(options.outputDir);
  const include = (options.include ?? ['**/*.svg', '*.svg']).map(globToRegExp);
  const exclude = (options.exclude ?? []).map(globToRegExp);
  const maxFileCount = options.maxFileCount ?? 10_000;
  const symlinkPolicy = options.symlinks ?? 'ignore';
  const discovered: DiscoveredSource[] = [];
  const visitedDirectories = new Set<string>();

  async function visit(directory: string): Promise<void> {
    assertNotAborted(options.signal);
    const realDirectory = await fs.realpath(directory);
    if (visitedDirectories.has(realDirectory)) return;
    visitedDirectories.add(realDirectory);

    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name
        .normalize('NFC')
        .localeCompare(right.name.normalize('NFC'), 'en')
    );

    for (const entry of entries) {
      assertNotAborted(options.signal);
      if (!options.includeHidden && entry.name.startsWith('.')) continue;

      const absolutePath = path.join(directory, entry.name);
      const relativePath = normalizeRelative(
        path.relative(sourceDir, absolutePath)
      );
      if (isInside(absolutePath, outputDir)) continue;

      if (entry.isSymbolicLink()) {
        if (symlinkPolicy === 'error') {
          throw new DiagnosticError(
            'E_SYMLINK_NOT_ALLOWED',
            `Symbolic links are not allowed: ${relativePath}`,
            { exitCode: ExitCode.InvalidConfiguration, file: relativePath }
          );
        }
        if (symlinkPolicy === 'ignore') continue;
        const target = await fs.stat(absolutePath);
        if (target.isDirectory() && options.recursive !== false) {
          await visit(absolutePath);
        } else if (target.isFile()) {
          addFile(absolutePath, relativePath);
        }
        continue;
      }

      if (entry.isDirectory()) {
        if (options.recursive !== false) await visit(absolutePath);
        continue;
      }
      if (entry.isFile()) addFile(absolutePath, relativePath);
    }
  }

  function addFile(absolutePath: string, relativePath: string): void {
    if (!/\.svg$/iu.test(relativePath)) return;
    if (
      !matchesAny(relativePath, include) ||
      matchesAny(relativePath, exclude)
    ) {
      return;
    }
    discovered.push({ absolutePath, relativePath });
    if (discovered.length > maxFileCount) {
      throw new DiagnosticError(
        'E_MAX_FILE_COUNT',
        `SVG discovery exceeded the maximum of ${maxFileCount} files.`,
        { exitCode: ExitCode.InvalidConfiguration }
      );
    }
  }

  try {
    await visit(sourceDir);
  } catch (error) {
    if (error instanceof DiagnosticError) throw error;
    throw new DiagnosticError(
      'E_SOURCE_DISCOVERY',
      `Unable to discover SVG inputs in ${sourceDir}.`,
      { exitCode: ExitCode.FilesystemFailure, cause: error }
    );
  }

  return Object.freeze(
    discovered.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath, 'en')
    )
  );
}
