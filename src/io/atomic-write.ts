import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { resolveOutputArtifactPath } from '../security/input-safety.js';

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('Atomic output write was cancelled.');
  Object.assign(error, { code: 'ABORT_ERR', cause: signal.reason });
  throw error;
}

/** Write one artifact through an atomic rename on the output filesystem. */
export async function writeOutputFileAtomic(
  outputRoot: string,
  fileName: string,
  content: string,
  signal?: AbortSignal
): Promise<string> {
  const resolvedRoot = path.resolve(outputRoot);
  const outputPath = resolveOutputArtifactPath(resolvedRoot, fileName);
  throwIfAborted(signal);
  await fs.mkdir(resolvedRoot, { recursive: true });
  const temporaryName = `.${path.basename(fileName)}.${randomUUID()}.tmp`;
  const temporaryPath = resolveOutputArtifactPath(resolvedRoot, temporaryName);
  try {
    await fs.writeFile(temporaryPath, content, 'utf8');
    throwIfAborted(signal);
    await fs.rename(temporaryPath, outputPath);
    return outputPath;
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
