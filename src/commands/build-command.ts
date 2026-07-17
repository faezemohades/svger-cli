import type { Command } from '../application/command.js';
import type { BuildRequest } from '../application/svg-compiler-application-service.js';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';
import type { BuildReport, ReportFormat } from '../contracts/reporting.js';
import type { SVGCompiler } from '../compiler/create-svg-compiler.js';

const FRAMEWORKS = new Set([
  'react',
  'react-native',
  'vue',
  'svelte',
  'angular',
  'solid',
  'preact',
  'lit',
  'vanilla',
]);
const OPTIMIZATION_LEVELS = new Set([
  'none',
  'basic',
  'balanced',
  'aggressive',
  'maximum',
]);
const REPORT_FORMATS = new Set<ReportFormat>(['pretty', 'json', 'ndjson']);
const COLLISION_POLICIES = new Set(['error', 'first', 'last']);
const SYMLINK_POLICIES = new Set(['ignore', 'follow', 'error']);

export interface BuildCommandOptions extends BuildRequest {
  format?: ReportFormat;
}

/** Typed build command; validation is guaranteed to precede execution. */
export class BuildCommand implements Command<BuildCommandOptions, BuildReport> {
  public constructor(private readonly compiler: SVGCompiler) {}

  public validate(options: BuildCommandOptions): void {
    if (!options.src || !options.out) {
      throw new DiagnosticError(
        'E_USAGE_BUILD_PATHS',
        'Both source and output paths are required.',
        { exitCode: ExitCode.UsageError }
      );
    }
    if (options.framework && !FRAMEWORKS.has(options.framework)) {
      throw new DiagnosticError(
        'E_INVALID_FRAMEWORK',
        `Unknown framework: ${options.framework}`,
        { exitCode: ExitCode.InvalidConfiguration }
      );
    }
    if (options.optimize && !OPTIMIZATION_LEVELS.has(options.optimize)) {
      throw new DiagnosticError(
        'E_INVALID_OPTIMIZATION_LEVEL',
        `Unknown optimization level: ${options.optimize}`,
        { exitCode: ExitCode.InvalidConfiguration }
      );
    }
    if (options.format && !REPORT_FORMATS.has(options.format)) {
      throw new DiagnosticError(
        'E_INVALID_REPORT_FORMAT',
        `Unknown report format: ${options.format}`,
        { exitCode: ExitCode.UsageError }
      );
    }
    if (options.collision && !COLLISION_POLICIES.has(options.collision)) {
      throw new DiagnosticError(
        'E_INVALID_COLLISION_POLICY',
        `Unknown collision policy: ${options.collision}`,
        { exitCode: ExitCode.UsageError }
      );
    }
    if (options.symlinks && !SYMLINK_POLICIES.has(options.symlinks)) {
      throw new DiagnosticError(
        'E_INVALID_SYMLINK_POLICY',
        `Unknown symlink policy: ${options.symlinks}`,
        { exitCode: ExitCode.UsageError }
      );
    }
  }

  public execute(options: BuildCommandOptions): Promise<BuildReport> {
    return this.compiler.build(options);
  }
}
