import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const packageJson = JSON.parse(
  await fs.readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
);
const workflowDirectory = path.join(repositoryRoot, '.github/workflows');
const activeWorkflows = (await fs.readdir(workflowDirectory))
  .filter(file => /\.ya?ml$/u.test(file))
  .sort();

// The gate taxonomy must separate fast feedback from complete certification.
for (const script of ['quality:fast', 'quality:full', 'quality:release']) {
  assert.equal(typeof packageJson.scripts[script], 'string', `${script} is required`);
}
assert.match(packageJson.scripts['quality:full'], /test:phase0/u);
assert.match(packageJson.scripts['quality:full'], /test:phase1/u);
assert.match(packageJson.scripts['quality:full'], /test:phase4/u);
assert.match(packageJson.scripts['quality:release'], /package:conformance/u);
assert.match(packageJson.scripts['quality:fast'], /check:public-contract/u);
assert.match(packageJson.scripts['test:jest'], /--runInBand/u);
assert.doesNotMatch(packageJson.scripts['test:jest'], /--passWithNoTests/u);
assert.match(packageJson.scripts.prepublishOnly, /release:authorization/u);
const releasePolicy = JSON.parse(
  await fs.readFile(
    path.join(repositoryRoot, 'governance/release-policy.json'),
    'utf8'
  )
);
assert.equal(releasePolicy.publishingAuthorized, false);
const releaseAuthorization = spawnSync(
  process.execPath,
  [path.join(repositoryRoot, 'scripts/check-release-authorization.mjs')],
  { cwd: repositoryRoot, encoding: 'utf8' }
);
assert.equal(releaseAuthorization.status, 1);
assert.match(releaseAuthorization.stderr, /SEC-INC-001/u);

// Active workflows must have read-only defaults and immutable third-party code.
for (const file of activeWorkflows) {
  const contents = await fs.readFile(path.join(workflowDirectory, file), 'utf8');
  assert.match(contents, /^permissions:\s*\n\s+contents:\s*read\s*$/mu, `${file} needs least-privilege defaults`);
  assert.match(contents, /npm ci/u, `${file} must install from the lockfile`);
  for (const match of contents.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gmu)) {
    assert.match(
      match[1],
      /^[^@]+@[a-f0-9]{40}$/u,
      `${file} uses a mutable or unpinned action: ${match[1]}`
    );
  }
}

// Publishing must not be reachable while SEC-INC-001 remains open.
assert.equal(activeWorkflows.includes('release.yml'), false);
const ciWorkflow = await fs.readFile(
  path.join(workflowDirectory, 'ci.yml'),
  'utf8'
);
assert.match(ciWorkflow, /command: quality:full/u);
assert.doesNotMatch(ciWorkflow, /^\s+release:\s*$/mu);
for (const file of activeWorkflows) {
  const contents = await fs.readFile(path.join(workflowDirectory, file), 'utf8');
  assert.doesNotMatch(contents, /\bnpm publish\b|docker\/build-push-action/u, file);
}
assert.doesNotMatch(packageJson.scripts['quality:release'], /npm publish|docker push/u);
const legacyGate = await fs.readFile(
  path.join(repositoryRoot, 'scripts/validate-cicd.sh'),
  'utf8'
);
assert.match(legacyGate, /is retired/u);
assert.match(legacyGate, /quality:fast/u);

// The actual package smoke must inspect artifact contents as well as filenames.
const packageSmoke = await fs.readFile(
  path.join(repositoryRoot, 'tests/phase0/package-smoke.test.mjs'),
  'utf8'
);
assert.match(packageSmoke, /credential-shaped content/iu);

const traceability = JSON.parse(
  await fs.readFile(
    path.join(repositoryRoot, 'governance/requirement-traceability.json'),
    'utf8'
  )
);
assert.deepEqual(
  traceability.requirements.map(item => item.id),
  [
    'security',
    'semantic-correctness',
    'framework-generation',
    'configuration',
    'recovery',
    'concurrency-resource-lifecycle',
    'packaging',
    'public-compatibility',
  ]
);
for (const requirement of traceability.requirements) {
  assert.ok(requirement.verification.length > 0, requirement.id);
  for (const testFile of requirement.verification) {
    await fs.access(path.join(repositoryRoot, testFile));
  }
}

// A governed pipeline must exercise all five required failure modes.
const failureGate = await fs.readFile(
  path.join(repositoryRoot, 'tests/phase1/governance-failure-gates.test.mjs'),
  'utf8'
);
for (const scenario of [
  'lint violation',
  'regression failure',
  'package-size violation',
  'credential-bearing artifact',
  'public-contract change',
]) {
  assert.ok(failureGate.includes(scenario), `missing failure injection: ${scenario}`);
}

console.log('Phase 1 governance policy contracts passed.');
