import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const eslintBinary = path.join(
  repositoryRoot,
  'node_modules',
  '.bin',
  'eslint'
);
const result = spawnSync(
  eslintBinary,
  ['src', '--ext', '.ts,.tsx', '--format', 'json'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }
);

if (result.error) throw result.error;
if (!result.stdout) {
  console.error(result.stderr || 'ESLint did not produce a JSON report.');
  process.exit(1);
}

const reports = JSON.parse(result.stdout);
const messages = reports.flatMap(report =>
  report.messages.map(message => ({ filePath: report.filePath, ...message }))
);
const errors = messages.filter(message => message.severity === 2);
const warnings = messages.filter(message => message.severity === 1);
const approvedWarningRules = new Set(['@typescript-eslint/no-explicit-any']);
const unexpectedWarnings = warnings.filter(
  warning => !approvedWarningRules.has(warning.ruleId)
);

if (
  errors.length > 0 ||
  warnings.length > 14 ||
  unexpectedWarnings.length > 0
) {
  console.error(
    JSON.stringify(
      {
        approvedWarningCeiling: 14,
        approvedWarningRules: [...approvedWarningRules],
        errorCount: errors.length,
        warningCount: warnings.length,
        unexpectedWarnings,
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(
  `Lint budget passed: ${errors.length} errors, ${warnings.length}/14 approved warnings, ` +
    `${new Set(warnings.map(warning => warning.ruleId)).size} approved warning category.`
);
