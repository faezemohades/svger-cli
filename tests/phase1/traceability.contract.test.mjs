import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const traceability = JSON.parse(
  await readFile(
    path.join(repositoryRoot, 'reports/phase1-issue-traceability.json'),
    'utf8'
  )
);
const expectedIssues = Array.from(
  { length: 16 },
  (_, index) => `P1-${String(index + 101)}`
);

assert.equal(traceability.schemaVersion, 1);
assert.deepEqual(
  traceability.items.map(item => item.issue),
  expectedIssues
);

for (const item of traceability.items) {
  assert.ok(item.implementationFiles.length > 0, `${item.issue}: implementation`);
  assert.ok(item.contractTests.length > 0, `${item.issue}: tests`);
  assert.ok(item.evidence.length > 40, `${item.issue}: evidence`);
  assert.ok(
    ['passed', 'implemented-remote-ci-pending'].includes(item.result),
    `${item.issue}: result`
  );
  for (const relativePath of [
    ...item.implementationFiles,
    ...item.contractTests,
  ]) {
    await access(path.join(repositoryRoot, relativePath));
  }
}

assert.equal(
  traceability.items.find(item => item.issue === 'P1-115').result,
  'implemented-remote-ci-pending'
);
console.log('Phase 1 P1-101 through P1-116 traceability contract passed.');
