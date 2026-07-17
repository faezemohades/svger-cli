import type { Diagnostic } from './diagnostics.js';
import { ExitCode } from './diagnostics.js';

export const BUILD_REPORT_SCHEMA_VERSION = '1.0.0' as const;

export type BuildMode = 'write' | 'dry-run' | 'check' | 'diff';
export type BuildStatus = 'success' | 'failed' | 'cancelled';
export type ArtifactStatus =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'planned'
  | 'skipped';
export type ReportFormat = 'pretty' | 'json' | 'ndjson';

/** A generated or planned output described without embedding its content. */
export interface GeneratedArtifact {
  source: string;
  output: string;
  componentName: string;
  status: ArtifactStatus;
  byteLength: number;
  sha256: string;
}

export interface BuildSummary {
  discovered: number;
  planned: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
}

/** Versioned result returned by every canonical build entry point. */
export interface BuildReport {
  schemaVersion: typeof BUILD_REPORT_SCHEMA_VERSION;
  operation: 'build';
  mode: BuildMode;
  status: BuildStatus;
  exitCode: ExitCode;
  artifacts: readonly GeneratedArtifact[];
  diagnostics: readonly Diagnostic[];
  summary: Readonly<BuildSummary>;
}

export interface CreateBuildReportOptions {
  mode?: BuildMode;
  status?: BuildStatus;
  exitCode?: ExitCode;
  artifacts?: readonly GeneratedArtifact[];
  diagnostics?: readonly Diagnostic[];
  discovered?: number;
}

function countStatus(
  artifacts: readonly GeneratedArtifact[],
  status: ArtifactStatus
): number {
  return artifacts.reduce(
    (count, artifact) => count + (artifact.status === status ? 1 : 0),
    0
  );
}

export function createBuildReport(
  options: CreateBuildReportOptions = {}
): BuildReport {
  const artifacts = Object.freeze([...(options.artifacts ?? [])]);
  const diagnostics = Object.freeze([...(options.diagnostics ?? [])]);
  const exitCode = options.exitCode ?? ExitCode.Success;
  const status =
    options.status ??
    (exitCode === ExitCode.Success
      ? 'success'
      : exitCode === ExitCode.BuildCancelled
        ? 'cancelled'
        : 'failed');

  return Object.freeze({
    schemaVersion: BUILD_REPORT_SCHEMA_VERSION,
    operation: 'build',
    mode: options.mode ?? 'write',
    status,
    exitCode,
    artifacts,
    diagnostics,
    summary: Object.freeze({
      discovered: options.discovered ?? artifacts.length,
      planned: artifacts.length,
      created: countStatus(artifacts, 'created'),
      updated: countStatus(artifacts, 'updated'),
      unchanged: countStatus(artifacts, 'unchanged'),
      skipped: countStatus(artifacts, 'skipped'),
      failed: diagnostics.filter(diagnostic => diagnostic.severity === 'error')
        .length,
    }),
  });
}

function stableJSONStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatBuildReport(
  report: BuildReport,
  format: ReportFormat
): string {
  if (format === 'json') {
    return stableJSONStringify(report);
  }

  if (format === 'ndjson') {
    const records: unknown[] = [
      {
        type: 'report',
        schemaVersion: report.schemaVersion,
        operation: report.operation,
        mode: report.mode,
        status: report.status,
        exitCode: report.exitCode,
      },
      ...report.artifacts.map(artifact => ({ type: 'artifact', ...artifact })),
      ...report.diagnostics.map(diagnostic => ({
        type: 'diagnostic',
        ...diagnostic,
      })),
      { type: 'summary', ...report.summary },
    ];
    return records.map(record => JSON.stringify(record)).join('\n');
  }

  const headline =
    report.status === 'success'
      ? `Build ${report.mode} completed successfully.`
      : `Build ${report.mode} ${report.status}.`;
  const summary = `${report.summary.planned} planned, ${report.summary.created} created, ${report.summary.updated} updated, ${report.summary.unchanged} unchanged, ${report.summary.skipped} skipped, ${report.summary.failed} failed.`;
  const diagnostics = report.diagnostics.map(
    diagnostic =>
      `${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}`
  );

  return [headline, summary, ...diagnostics].join('\n');
}
