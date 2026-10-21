import { readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBaselineDirectory } from './lib/baseline-verification.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const baselinesRoot = path.join(repositoryRoot, 'baselines');

try {
  const rootInfo = await lstat(baselinesRoot);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error('baselines must be a real directory');
  }

  const entries = await readdir(baselinesRoot, { withFileTypes: true });
  const baselineDirectories = [];
  for (const entry of entries) {
    const entryPath = path.join(baselinesRoot, entry.name);
    const info = await lstat(entryPath);
    if (info.isSymbolicLink()) {
      throw new Error(`Symlink is not allowed in baselines: ${entry.name}`);
    }
    if (info.isDirectory()) baselineDirectories.push(entryPath);
    else if (!info.isFile()) {
      throw new Error(`Unsupported entry in baselines: ${entry.name}`);
    }
  }

  let verifiedFiles = 0;
  const failures = [];
  for (const baselineRoot of baselineDirectories) {
    try {
      const result = await verifyBaselineDirectory(baselineRoot);
      verifiedFiles += result.verifiedFiles;
    } catch (error) {
      failures.push(
        `${path.basename(baselineRoot)}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
  console.log(
    `Verified ${verifiedFiles} immutable files across ${baselineDirectories.length} baseline archive(s).`
  );
} catch (error) {
  console.error(
    `Baseline verification failed:\n${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
