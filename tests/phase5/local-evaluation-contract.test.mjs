import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  makeFixture,
  parseArguments,
  summarize,
} from '../../scripts/evaluate-local.mjs';
import {
  isEvaluationReportSizeAllowed,
  parseEvaluationReport,
  validateEvaluationReport,
} from '../../docs-site/evaluation-report-schema.js';

assert.deepEqual(parseArguments([]).groups, [50, 750]);
assert.deepEqual(
  parseArguments(['--groups', '750,50', '--warmups', '2', '--samples', '3']),
  {
    groups: [50, 750],
    warmups: 2,
    samples: 3,
    beforeBuild: null,
    afterBuild: null,
    output: null,
    overwrite: false,
    help: false,
  }
);
assert.throws(() => parseArguments(['--groups', '0']), /between 1 and/u);
assert.throws(() => parseArguments(['--groups', '50,50']), /unique/u);
assert.throws(
  () => parseArguments(['--before-build', './old']),
  /supplied together/u
);
assert.throws(() => parseArguments(['--samples', '501']), /between 1 and 500/u);

const fixture = makeFixture(750);
assert.equal(fixture.elementCount, 2_251);
assert.equal(fixture.utf8Bytes, Buffer.byteLength(fixture.source));
assert.equal(fixture.sha256.length, 64);
assert.deepEqual(summarize([1, 2, 3, 4]), {
  sampleCount: 4,
  medianMs: 2.5,
  p95Ms: 4,
  minMs: 1,
  maxMs: 4,
  throughputPerSecond: 400,
});

const report = {
  schemaVersion: 'svger-local-evaluation-v2',
  overallStatus: 'passed',
  createdAt: '2026-10-20T00:00:00.000Z',
  package: { name: 'svger-cli', version: '4.1.0' },
  environment: {
    node: 'v22.22.2',
    npm: '10.9.7',
    platform: 'linux',
    release: 'test',
    architecture: 'x64',
  },
  source: { head: null, workingTreeClean: false },
  settings: {
    fixtureGroups: [1],
    warmupsPerMode: 1,
    samplesPerMode: 1,
    optimization: 'none',
    compilerModes: ['legacy', 'ir-v1'],
    timingThreshold: 'informational-only',
    memoryMethod: 'snapshots',
  },
  builds: {
    current: {
      packageVersion: '4.1.0',
      distSha256: 'd'.repeat(64),
      distBytes: 10,
    },
  },
  performanceStatus: { status: 'passed' },
  quality: {
    status: 'passed',
    semanticStatus: 'complete',
    frameworkOutputs: {},
    compatibilitySuite: {
      command: 'npm run test:phase4',
      exitCode: 0,
      signal: null,
      durationMs: 1,
      outputSha256: 'e'.repeat(64),
      spawnError: null,
    },
  },
  security: {
    status: 'passed',
    policy: 'regressions only; not comprehensive security certification',
    checks: [
      {
        script: 'tests/phase0/security.test.mjs',
        exitCode: 0,
        signal: null,
        durationMs: 1,
        outputSha256: 'a'.repeat(64),
        spawnError: null,
      },
    ],
  },
  performance: [
    {
      groups: 1,
      fixture: {
        id: 'synthetic-svg-fixture',
        sha256: 'b'.repeat(64),
        utf8Bytes: 100,
        elementCount: 4,
      },
      buildIds: ['current'],
      builds: {
        current: {
          legacy: {
            status: 'measured',
            sampleCount: 1,
            medianMs: 1,
            p95Ms: 1,
            minMs: 1,
            maxMs: 1,
            throughputPerSecond: 1000,
            outputBytes: 100,
            outputSha256: 'c'.repeat(64),
            memoryObservation: {
              rssBeforeBytes: 1,
              rssAfterBytes: 1,
              heapDeltaBytes: 0,
            },
          },
          'ir-v1': {
            status: 'unsupported-or-failed',
            diagnosticCode: 'E_TEST_FIXTURE',
          },
        },
      },
    },
  ],
  comparisons: [],
  limitations: ['synthetic fixture'],
};
assert.equal(validateEvaluationReport(report), true);
assert.equal(isEvaluationReportSizeAllowed(5 * 1024 * 1024), true);
assert.equal(isEvaluationReportSizeAllowed(5 * 1024 * 1024 + 1), false);
assert.equal(isEvaluationReportSizeAllowed(-1), false);
assert.equal(
  parseEvaluationReport(
    JSON.stringify(report),
    new TextEncoder().encode(JSON.stringify(report)).byteLength
  ).overallStatus,
  'passed'
);
assert.equal(parseEvaluationReport('{', 1), null);
assert.equal(
  parseEvaluationReport(JSON.stringify(report), 5 * 1024 * 1024 + 1),
  null
);
assert.equal(
  validateEvaluationReport({
    ...report,
    schemaVersion: 'svger-local-evaluation-v1',
  }),
  false
);
assert.equal(
  validateEvaluationReport({ ...report, quality: { status: 'passed' } }),
  false,
  'semantic status is required and validated separately'
);
assert.equal(
  validateEvaluationReport({
    ...report,
    security: { ...report.security, checks: [{ script: 'arbitrary command' }] },
  }),
  false
);
assert.equal(
  validateEvaluationReport({ ...report, performance: [{ groups: 'bad' }] }),
  false
);
const inertMarkup = '<img src=x onerror=alert(1)>';
assert.equal(
  validateEvaluationReport({ ...report, limitations: [inertMarkup] }),
  true
);
assert.equal(
  parseEvaluationReport(
    JSON.stringify({ ...report, limitations: [inertMarkup] }),
    new TextEncoder().encode(
      JSON.stringify({ ...report, limitations: [inertMarkup] })
    ).byteLength
  ).limitations[0],
  inertMarkup,
  'markup-shaped report text remains data and is rendered by the text-only sink'
);
assert.throws(() => JSON.parse('{'), SyntaxError);

const viewer = await readFile(
  new URL('../../docs-site/evaluation.html', import.meta.url),
  'utf8'
);
assert.match(viewer, /isEvaluationReportSizeAllowed\(file\.size\)/u);
assert.match(
  viewer,
  /parseEvaluationReport\(await file\.text\(\), file\.size\)/u
);
assert.match(viewer, /element\.textContent = String/u);
assert.doesNotMatch(viewer, /\.innerHTML\s*=|\beval\s*\(|new Function/u);
assert.doesNotMatch(viewer, /<script\s+src=/iu);

const evaluatorSource = await readFile(
  new URL('../../scripts/evaluate-local.mjs', import.meta.url),
  'utf8'
);
assert.match(evaluatorSource, /const SECURITY_CHECKS = \[/u);
assert.match(evaluatorSource, /SECURITY_CHECKS\.map\(script =>/u);
assert.match(
  evaluatorSource,
  /pass\/fail for the listed non-destructive regression suites only/u
);
assert.doesNotMatch(evaluatorSource, /\beval\s*\(|new Function|exec\s*\(/u);
assert.equal(makeFixture(750).sha256, fixture.sha256);

const packageJson = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf8')
);
const lockJson = JSON.parse(
  await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8')
);
assert.equal(packageJson.version, '4.1.0');
assert.equal(lockJson.version, packageJson.version);
assert.equal(lockJson.packages[''].version, packageJson.version);
const readme = await readFile(
  new URL('../../README.md', import.meta.url),
  'utf8'
);
assert.match(readme, /legacy compiler remains the default/u);
assert.match(
  readme,
  /IR emitters for other frameworks are experiments only; they are not\s+production compiler routes/u
);
assert.match(readme, /7\.5×\s*slower/u);
const changelog = await readFile(
  new URL('../../CHANGELOG.md', import.meta.url),
  'utf8'
);
assert.match(changelog, /planned 4\.1\.0 \(not published\)/u);
const releasePolicy = JSON.parse(
  await readFile(
    new URL('../../governance/release-policy.json', import.meta.url),
    'utf8'
  )
);
assert.equal(releasePolicy.publishingAuthorized, false);

console.log('Local evaluation contract passed without executing benchmarks.');
