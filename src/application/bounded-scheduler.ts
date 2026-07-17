import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';

export interface SchedulerOptions {
  concurrency: number;
  batchSize?: number;
  preserveOrder?: boolean;
  signal?: AbortSignal;
}

function assertSchedulerOptions(options: SchedulerOptions): void {
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1) {
    throw new DiagnosticError(
      'E_INVALID_CONCURRENCY',
      'Concurrency must be a positive integer.',
      { exitCode: ExitCode.InvalidConfiguration }
    );
  }
  if (
    options.batchSize !== undefined &&
    (!Number.isSafeInteger(options.batchSize) || options.batchSize < 1)
  ) {
    throw new DiagnosticError(
      'E_INVALID_BATCH_SIZE',
      'Batch size must be a positive integer.',
      { exitCode: ExitCode.InvalidConfiguration }
    );
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DiagnosticError('E_BUILD_CANCELLED', 'Build was cancelled.', {
      exitCode: ExitCode.BuildCancelled,
      cause: signal.reason,
    });
  }
}

/** Execute work with a fixed upper bound; no unbounded Promise.all is used. */
export async function runBounded<TInput, TResult>(
  inputs: readonly TInput[],
  worker: (
    input: TInput,
    index: number,
    signal?: AbortSignal
  ) => Promise<TResult>,
  options: SchedulerOptions
): Promise<readonly TResult[]> {
  assertSchedulerOptions(options);
  assertNotAborted(options.signal);
  const results: TResult[] = new Array(inputs.length);
  const completionResults: TResult[] = [];
  const batchSize = options.batchSize ?? Math.max(inputs.length, 1);

  for (
    let batchStart = 0;
    batchStart < inputs.length;
    batchStart += batchSize
  ) {
    const batchEnd = Math.min(inputs.length, batchStart + batchSize);
    let nextIndex = batchStart;
    const workerCount = Math.min(options.concurrency, batchEnd - batchStart);
    const workers = Array.from({ length: workerCount }, async () => {
      while (nextIndex < batchEnd) {
        assertNotAborted(options.signal);
        const index = nextIndex++;
        const result = await worker(inputs[index], index, options.signal);
        results[index] = result;
        completionResults.push(result);
      }
    });
    await Promise.all(workers);
  }

  return Object.freeze(
    options.preserveOrder === false ? completionResults : results
  );
}
