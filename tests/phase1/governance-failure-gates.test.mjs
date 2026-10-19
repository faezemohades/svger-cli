import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const fixtureRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-governance-failure-gates-')
);
const run = (command, args) =>
  spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });
const assertRejected = (result, scenario) => {
  assert.equal(
    result.error,
    undefined,
    `${scenario} runner should complete without a spawn error`
  );
  assert.notEqual(
    result.status,
    0,
    `${scenario} must make its gate exit nonzero`
  );
};

try {
  // lint violation
  const lintFixture = await fs.mkdtemp(
    path.join(repositoryRoot, 'src/__tests__/.governance-lint-')
  );
  try {
    const lintFile = path.join(lintFixture, 'injected-lint.ts');
    await fs.writeFile(lintFile, 'debugger;\nexport {};\n');
    assertRejected(
      run(path.join(repositoryRoot, 'node_modules/.bin/eslint'), [
        '--no-ignore',
        lintFile,
      ]),
      'lint violation'
    );
  } finally {
    await fs.rm(lintFixture, { recursive: true, force: true });
  }

  // regression failure
  const regressionFixture = await fs.mkdtemp(
    path.join(repositoryRoot, 'tests/phase1/.governance-regression-')
  );
  try {
    const regressionFile = path.join(regressionFixture, 'failure.test.js');
    await fs.writeFile(
      regressionFile,
      "test('injected regression failure', () => expect(1).toBe(2));\n"
    );
    assertRejected(
      run(process.execPath, [
        path.join(repositoryRoot, 'node_modules/jest/bin/jest.js'),
        '--runInBand',
        '--runTestsByPath',
        regressionFile,
      ]),
      'regression failure'
    );
  } finally {
    await fs.rm(regressionFixture, { recursive: true, force: true });
  }

  // package-size violation
  assertRejected(
    run(process.execPath, [
      'scripts/package-artifact-policy.mjs',
      '--size',
      '640624',
      '--entries',
      '1',
      '--max-size',
      '640623',
      '--max-entries',
      '100',
    ]),
    'package-size violation'
  );

  // credential-bearing artifact
  const credentialDirectory = path.join(fixtureRoot, 'package');
  await fs.mkdir(credentialDirectory);
  await fs.writeFile(
    path.join(credentialDirectory, 'credential.txt'),
    `ghp_${'A'.repeat(40)}\n`
  );
  assertRejected(
    run(process.execPath, [
      'scripts/package-artifact-policy.mjs',
      '--scan-dir',
      credentialDirectory,
    ]),
    'credential-bearing artifact'
  );

  // public-contract change
  const expectedContract = path.join(fixtureRoot, 'expected-contract.json');
  const changedContract = path.join(fixtureRoot, 'changed-contract.json');
  const stablePackage = {
    name: 'svger-cli',
    bin: { svger: 'bin/svg-tool.js' },
    exports: { '.': { import: './dist/index.js' } },
  };
  const changedPackage = {
    ...stablePackage,
    exports: { ...stablePackage.exports, './unstable': './private.js' },
  };
  await fs.writeFile(expectedContract, JSON.stringify(stablePackage));
  await fs.writeFile(changedContract, JSON.stringify(changedPackage));
  assertRejected(
    run(process.execPath, [
      'scripts/check-public-contract.mjs',
      '--expected',
      expectedContract,
      '--actual',
      changedContract,
    ]),
    'public-contract change'
  );
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

console.log(
  'Phase 1 governance failure gates reject injected lint, regression, package-size, credential, and public-contract failures.'
);
