import assert from 'node:assert/strict';
import {
  BUILD_REPORT_SCHEMA_VERSION,
  DiagnosticError,
  ExitCode,
  createBuildReport,
  executeCommand,
  formatBuildReport,
} from '../../dist/index.js';

assert.deepEqual(
  Object.values(ExitCode).filter(value => typeof value === 'number'),
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
);

const artifact = {
  source: 'icons/check.svg',
  output: 'components/Check.tsx',
  componentName: 'Check',
  status: 'created',
  byteLength: 42,
  sha256: 'a'.repeat(64),
};
const report = createBuildReport({ artifacts: [artifact], discovered: 1 });

assert.equal(report.schemaVersion, BUILD_REPORT_SCHEMA_VERSION);
assert.equal(report.exitCode, ExitCode.Success);
assert.equal(report.summary.created, 1);
assert.ok(Object.isFrozen(report));
assert.ok(Object.isFrozen(report.artifacts));

const json = JSON.parse(formatBuildReport(report, 'json'));
assert.equal(json.schemaVersion, '1.0.0');
assert.equal(json.artifacts[0].output, 'components/Check.tsx');

const ndjson = formatBuildReport(report, 'ndjson')
  .split('\n')
  .map(line => JSON.parse(line));
assert.deepEqual(
  ndjson.map(record => record.type),
  ['report', 'artifact', 'summary']
);

const collision = new DiagnosticError(
  'E_NAME_COLLISION',
  'Two sources resolve to Check.tsx.',
  { exitCode: ExitCode.NameCollision }
);
assert.equal(collision.toDiagnostic().code, 'E_NAME_COLLISION');
assert.equal(collision.exitCode, 7);

let validated = false;
const result = await executeCommand(
  {
    validate(options) {
      validated = options.valid;
    },
    async execute() {
      assert.equal(validated, true);
      return report;
    },
  },
  { valid: true }
);
assert.equal(result, report);

console.log('Phase 1 report and command contracts passed.');
