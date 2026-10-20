const isRecord = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string';
const isFiniteNumber = value =>
  typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
const isSha256 = value =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const hasStatus = (value, allowed) =>
  isRecord(value) && allowed.includes(value.status);
const isTextOrNull = value => value === null || isText(value);
const SEMANTIC_DIMENSIONS = [
  'text',
  'namespaces',
  'attributes',
  'references',
  'accessibility',
  'geometry',
];
export const MAX_EVALUATION_REPORT_BYTES = 5 * 1024 * 1024;

export function isEvaluationReportSizeAllowed(byteLength) {
  return (
    Number.isSafeInteger(byteLength) &&
    byteLength >= 0 &&
    byteLength <= MAX_EVALUATION_REPORT_BYTES
  );
}

export function parseEvaluationReport(serialized, byteLength) {
  if (
    !isEvaluationReportSizeAllowed(byteLength) ||
    typeof serialized !== 'string' ||
    new TextEncoder().encode(serialized).byteLength !== byteLength
  )
    return null;
  try {
    const report = JSON.parse(serialized);
    return validateEvaluationReport(report) ? report : null;
  } catch {
    return null;
  }
}

function validMeasurement(value) {
  if (!isRecord(value)) return false;
  if (value.status === 'unsupported-or-failed')
    return /^E_[A-Z0-9_]{1,80}$/u.test(value.diagnosticCode);
  return (
    value.status === 'measured' &&
    Number.isSafeInteger(value.sampleCount) &&
    value.sampleCount > 0 &&
    ['medianMs', 'p95Ms', 'minMs', 'maxMs', 'throughputPerSecond'].every(
      key => isFiniteNumber(value[key]) && value[key] >= 0
    ) &&
    isNonNegativeInteger(value.outputBytes) &&
    isSha256(value.outputSha256) &&
    isRecord(value.memoryObservation) &&
    ['rssBeforeBytes', 'rssAfterBytes'].every(key =>
      isNonNegativeInteger(value.memoryObservation[key])
    ) &&
    isFiniteNumber(value.memoryObservation.heapDeltaBytes)
  );
}

function validQualityOutput(output) {
  if (!isRecord(output) || !['passed', 'failed'].includes(output.status))
    return false;
  if (output.diagnosticCode !== undefined)
    return (
      output.status === 'failed' &&
      /^E_[A-Z0-9_]{1,80}$/u.test(output.diagnosticCode)
    );
  return (
    isRecord(output.frameworkCompile) &&
    ['passed', 'failed'].includes(output.frameworkCompile.status) &&
    isText(output.frameworkCompile.compiler) &&
    isText(output.frameworkCompile.version) &&
    typeof output.deterministic === 'boolean' &&
    isRecord(output.semanticComparison) &&
    ['complete', 'partial', 'failed'].includes(
      output.semanticComparison.status
    ) &&
    isText(output.semanticComparison.sourceCoverage) &&
    isText(output.semanticComparison.artifactCoverage) &&
    isRecord(output.semanticComparison.dimensions) &&
    SEMANTIC_DIMENSIONS.every(dimension =>
      ['match', 'mismatch', 'unresolved-or-partial'].includes(
        output.semanticComparison.dimensions[dimension]
      )
    ) &&
    isText(output.semanticComparison.note)
  );
}

export function validateEvaluationReport(report) {
  if (
    !isRecord(report) ||
    report.schemaVersion !== 'svger-local-evaluation-v2' ||
    !['passed', 'failed'].includes(report.overallStatus) ||
    !isText(report.createdAt) ||
    !isRecord(report.package) ||
    !isText(report.package.name) ||
    !isText(report.package.version) ||
    !isRecord(report.environment) ||
    !isText(report.environment.node) ||
    !(report.environment.npm === null || isText(report.environment.npm)) ||
    !isText(report.environment.platform) ||
    !isText(report.environment.release) ||
    !isText(report.environment.architecture) ||
    !isRecord(report.source) ||
    !isTextOrNull(report.source.head) ||
    typeof report.source.workingTreeClean !== 'boolean' ||
    !isRecord(report.settings) ||
    !Array.isArray(report.settings.fixtureGroups) ||
    !report.settings.fixtureGroups.every(
      value => Number.isSafeInteger(value) && value > 0
    ) ||
    !Number.isSafeInteger(report.settings.warmupsPerMode) ||
    report.settings.warmupsPerMode < 1 ||
    !Number.isSafeInteger(report.settings.samplesPerMode) ||
    report.settings.samplesPerMode < 1 ||
    report.settings.samplesPerMode > 500 ||
    report.settings.optimization !== 'none' ||
    JSON.stringify(report.settings.compilerModes) !==
      JSON.stringify(['legacy', 'ir-v1']) ||
    !isText(report.settings.timingThreshold) ||
    !isText(report.settings.memoryMethod) ||
    !isRecord(report.builds) ||
    Object.keys(report.builds).length === 0 ||
    !Array.isArray(report.performance) ||
    report.performance.length === 0 ||
    !hasStatus(report.performanceStatus, ['passed', 'failed']) ||
    !isRecord(report.quality) ||
    !['passed', 'failed', 'not-run'].includes(report.quality.status) ||
    !['complete', 'partial', 'failed'].includes(
      report.quality.semanticStatus
    ) ||
    !hasStatus(report.security, ['passed', 'failed']) ||
    !isText(report.security.policy) ||
    !Array.isArray(report.security.checks) ||
    !Array.isArray(report.comparisons) ||
    !Array.isArray(report.limitations) ||
    !report.limitations.every(isText)
  )
    return false;

  const buildsValid = Object.values(report.builds).every(
    build =>
      isRecord(build) &&
      isText(build.packageVersion) &&
      isSha256(build.distSha256) &&
      isNonNegativeInteger(build.distBytes)
  );

  const performanceValid = report.performance.every(sample => {
    if (
      !isRecord(sample) ||
      !Number.isSafeInteger(sample.groups) ||
      sample.groups < 1 ||
      !isRecord(sample.fixture) ||
      !isText(sample.fixture.id) ||
      !isSha256(sample.fixture.sha256) ||
      !isNonNegativeInteger(sample.fixture.utf8Bytes) ||
      !Number.isSafeInteger(sample.fixture.elementCount) ||
      sample.fixture.elementCount < 1 ||
      !Array.isArray(sample.buildIds) ||
      sample.buildIds.length === 0 ||
      new Set(sample.buildIds).size !== sample.buildIds.length ||
      !isRecord(sample.builds)
    )
      return false;
    return sample.buildIds.every(buildId => {
      const modes = sample.builds[buildId];
      return (
        isRecord(modes) &&
        validMeasurement(modes.legacy) &&
        validMeasurement(modes['ir-v1'])
      );
    });
  });

  const securityValid = report.security.checks.every(
    check =>
      isRecord(check) &&
      isText(check.script) &&
      Number.isSafeInteger(check.exitCode) &&
      isFiniteNumber(check.durationMs) &&
      isSha256(check.outputSha256) &&
      (check.signal === null || isText(check.signal)) &&
      (check.spawnError === null || isText(check.spawnError))
  );
  const comparisonsValid = report.comparisons.every(comparison => {
    if (
      !isRecord(comparison) ||
      !['legacy-vs-ir-v1', 'before-vs-after'].includes(comparison.kind) ||
      !Number.isSafeInteger(comparison.groups) ||
      comparison.groups < 1 ||
      !['measured', 'unavailable'].includes(comparison.status)
    )
      return false;
    if (comparison.status === 'unavailable') return true;
    return comparison.kind === 'legacy-vs-ir-v1'
      ? isText(comparison.buildId) &&
          isFiniteNumber(comparison.irMedianRelativeToLegacy) &&
          isFiniteNumber(comparison.irMedianReductionVsLegacyPercent) &&
          isText(comparison.note)
      : ['legacy', 'ir-v1'].includes(comparison.mode) &&
          ['beforeMedianMs', 'afterMedianMs', 'relativeChangePercent'].every(
            key => isFiniteNumber(comparison[key])
          );
  });
  const qualityValid =
    report.quality.status === 'not-run' ||
    (isRecord(report.quality.frameworkOutputs) &&
      Object.values(report.quality.frameworkOutputs).every(
        validQualityOutput
      ) &&
      isRecord(report.quality.compatibilitySuite) &&
      isText(report.quality.compatibilitySuite.command) &&
      Number.isSafeInteger(report.quality.compatibilitySuite.exitCode) &&
      isFiniteNumber(report.quality.compatibilitySuite.durationMs) &&
      isSha256(report.quality.compatibilitySuite.outputSha256) &&
      isTextOrNull(report.quality.compatibilitySuite.signal) &&
      isTextOrNull(report.quality.compatibilitySuite.spawnError));
  return (
    buildsValid &&
    performanceValid &&
    securityValid &&
    comparisonsValid &&
    qualityValid
  );
}
