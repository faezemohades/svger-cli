import type { Diagnostic } from './diagnostics.js';
import { ExitCode, redactDiagnostic } from './diagnostics.js';

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
  const diagnostics = Object.freeze(
    (options.diagnostics ?? []).map(redactDiagnostic)
  );
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

function publicReport(report: BuildReport): BuildReport {
  return {
    ...report,
    diagnostics: report.diagnostics.map(redactDiagnostic),
  };
}

export function formatBuildReport(
  report: BuildReport,
  format: ReportFormat
): string {
  const safeReport = publicReport(report);
  if (format === 'json') {
    return stableJSONStringify(safeReport);
  }

  if (format === 'ndjson') {
    const records: unknown[] = [
      {
        type: 'report',
        schemaVersion: safeReport.schemaVersion,
        operation: safeReport.operation,
        mode: safeReport.mode,
        status: safeReport.status,
        exitCode: safeReport.exitCode,
      },
      ...safeReport.artifacts.map(artifact => ({
        type: 'artifact',
        ...artifact,
      })),
      ...safeReport.diagnostics.map(diagnostic => ({
        type: 'diagnostic',
        ...diagnostic,
      })),
      { type: 'summary', ...safeReport.summary },
    ];
    return records.map(record => JSON.stringify(record)).join('\n');
  }

  const headline =
    safeReport.status === 'success'
      ? `Build ${safeReport.mode} completed successfully.`
      : `Build ${safeReport.mode} ${safeReport.status}.`;
  const summary = `${safeReport.summary.planned} planned, ${safeReport.summary.created} created, ${safeReport.summary.updated} updated, ${safeReport.summary.unchanged} unchanged, ${safeReport.summary.skipped} skipped, ${safeReport.summary.failed} failed.`;
  const diagnostics = safeReport.diagnostics.map(
    diagnostic =>
      `${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}`
  );

  return [headline, summary, ...diagnostics].join('\n');
}
