/** Stable process exit codes introduced by the v4.1 architecture. */
export enum ExitCode {
  Success = 0,
  InternalError = 1,
  UsageError = 2,
  InvalidConfiguration = 3,
  InvalidSVGInput = 4,
  SecurityViolation = 5,
  PluginFailure = 6,
  NameCollision = 7,
  FilesystemFailure = 8,
  GeneratedCodeValidationFailure = 9,
  StaleOutput = 10,
  VisualRegression = 11,
  BuildCancelled = 12,
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

/**
 * A stable, serializable diagnostic. Stack traces and Error objects are
 * deliberately excluded from this public contract.
 */
export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  hint?: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface DiagnosticErrorOptions {
  exitCode: ExitCode;
  file?: string;
  hint?: string;
  cause?: unknown;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Error type used internally to preserve the public diagnostic contract. */
export class DiagnosticError extends Error {
  public readonly code: string;
  public readonly exitCode: ExitCode;
  public readonly file?: string;
  public readonly hint?: string;
  public readonly metadata?: Readonly<
    Record<string, string | number | boolean | null>
  >;

  public constructor(
    code: string,
    message: string,
    options: DiagnosticErrorOptions
  ) {
    super(message, { cause: options.cause });
    this.name = 'DiagnosticError';
    this.code = code;
    this.exitCode = options.exitCode;
    this.file = options.file;
    this.hint = options.hint;
    this.metadata = options.metadata;
  }

  public toDiagnostic(): Diagnostic {
    return {
      code: this.code,
      severity: 'error',
      message: this.message,
      ...(this.file === undefined ? {} : { file: this.file }),
      ...(this.hint === undefined ? {} : { hint: this.hint }),
      ...(this.metadata === undefined ? {} : { metadata: this.metadata }),
    };
  }
}

export function diagnosticFromUnknown(error: unknown): Diagnostic {
  if (error instanceof DiagnosticError) {
    return error.toDiagnostic();
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : 'E_INTERNAL';
  return {
    code,
    severity: 'error',
    message: error instanceof Error ? error.message : String(error),
  };
}

export function exitCodeFromUnknown(error: unknown): ExitCode {
  if (error instanceof DiagnosticError) return error.exitCode;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (code === 'E_NAME_COLLISION') return ExitCode.NameCollision;
  if (code === 'E_SVG_INPUT_TOO_LARGE') return ExitCode.InvalidSVGInput;
  if (code.startsWith('E_UNSAFE_')) return ExitCode.SecurityViolation;
  if (code.startsWith('E_PLUGIN_')) return ExitCode.PluginFailure;
  if (code.startsWith('E_OUTPUT_') || code.startsWith('E_FS_')) {
    return ExitCode.FilesystemFailure;
  }
  if (code === 'ABORT_ERR' || code === 'E_BUILD_CANCELLED') {
    return ExitCode.BuildCancelled;
  }
  return ExitCode.InternalError;
}
