export type NativeTransactionErrorCategory =
  | 'authorization'
  | 'busy'
  | 'malformed'
  | 'ambiguous'
  | 'io'
  | 'unsupported';

export interface NativeTransactionError extends Error {
  code: string;
  category: NativeTransactionErrorCategory;
  retryable: boolean;
  win32?: number;
}

export interface SessionOptions {
  /** Test-only fault injection after the native handle has been acquired. */
  failAfterResource?: boolean;
}

export interface SessionSnapshot {
  closed: boolean;
  sequence: number;
  activeOperations: number;
  peakConcurrentOperations: number;
}

export interface NativeSession {
  /** Serialized asynchronous lifecycle probe; it performs no filesystem I/O. */
  probe(
    delayMs?: number,
    options?: { failQueue?: boolean; cancelAfterQueue?: boolean }
  ): Promise<{ sequence: number }>;
  snapshot(): SessionSnapshot;
  /** Idempotently closes the session-owned native resource. */
  close(): void;
}

export function openSession(options?: SessionOptions): NativeSession;
/** Experimental process-local resource counter used by lifecycle tests. */
export function liveResourceCount(): number;
/** Experimental test-only count of queued native async work. */
export function pendingWorkCount(): number;
