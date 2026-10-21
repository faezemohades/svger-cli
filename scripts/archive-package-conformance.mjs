import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPackageBudgets } from './package-artifact-policy.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
);
const reportOutputArgument = process.argv.indexOf('--report-output');
if (reportOutputArgument >= 0 && !process.argv[reportOutputArgument + 1]) {
  throw new Error('--report-output requires a file path.');
}
const reportPath = reportOutputArgument >= 0
  ? path.resolve(repositoryRoot, process.argv[reportOutputArgument + 1])
  : path.join(repositoryRoot, 'reports', `package-conformance-v${packageJson.version}.json`);
const approvedPackageBaseline = {
  entryCount: 757,
  packedBytes: 616_992,
  intentionalAssetCount: 0,
  growthTolerance: 0.05,
};
const maximumEntryCount = Math.floor(
  approvedPackageBaseline.entryCount *
    (1 + approvedPackageBaseline.growthTolerance)
);
const maximumPackedBytes = Math.min(
  640_623,
  Math.floor(
    approvedPackageBaseline.packedBytes *
      (1 + approvedPackageBaseline.growthTolerance)
  )
);
const workRoot = await mkdtemp(
  path.join(tmpdir(), 'svger-package-conformance-')
);
const dryRun = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
)[0];
const packed = JSON.parse(
  execFileSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', workRoot],
    { cwd: repositoryRoot, encoding: 'utf8' }
  )
)[0];
const tarballPath = path.join(workRoot, packed.filename);
const tarEntries = execFileSync('tar', ['-tf', tarballPath], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter(Boolean);
const groups = {};
for (const file of dryRun.files) {
  const topLevel = file.path.split('/')[0];
  groups[topLevel] = (groups[topLevel] ?? 0) + 1;
}

const forbiddenPatterns = {
  baselines: /^baselines\//,
  compatibilityReports: /^compatibility\//,
  coverage: /^coverage\//,
  developmentGitHubFiles: /^\.github\//,
  generatedApiDocs: /^docs\/api\//,
  internalDocArchive: /^docs\/archive\//,
  internalReports: /^reports\//,
  sourceMaps: /\.map$/,
  sourceTree: /^src\//,
  testFixtures: /(?:^|\/)(?:__fixtures__|fixtures)(?:\/|$)/,
  tests: /(?:^|\/)(?:__tests__|tests)(?:\/|$)/,
  temporaryOutput: /(?:^|\/)(?:dist-tests|test-output|tmp)(?:\/|$)/,
};
const packedPaths = dryRun.files.map(file => file.path);
const forbiddenContentReview = Object.fromEntries(
  Object.entries(forbiddenPatterns).map(([name, pattern]) => [
    name,
    packedPaths.some(filePath => pattern.test(filePath)),
  ])
);
const forbiddenGroups = Object.entries(forbiddenContentReview)
  .filter(([, present]) => present)
  .map(([name]) => name);
if (forbiddenGroups.length > 0) {
  throw new Error(
    `Forbidden package content detected: ${forbiddenGroups.join(', ')}`
  );
}
if ((groups.assets ?? 0) !== approvedPackageBaseline.intentionalAssetCount) {
  throw new Error(
    `Expected ${approvedPackageBaseline.intentionalAssetCount} packaged development SVG assets, received ${groups.assets ?? 0} files.`
  );
}
assertPackageBudgets({
  size: packed.size,
  entryCount: packed.entryCount,
  maxBytes: maximumPackedBytes,
  maxEntries: maximumEntryCount,
});

const report = {
  schemaVersion: 1,
  package: `${packageJson.name}@${packageJson.version}`,
  summary: {
    filename: packed.filename,
    packedBytes: packed.size,
    unpackedBytes: packed.unpackedSize,
    entryCount: packed.entryCount,
    groups,
  },
  intentionalLargeGroups: {
    assets:
      'The development SVG corpus is retained in the source repository for local benchmarks and excluded from npm packages.',
    docs: 'A curated set of user-facing Markdown supports offline package documentation; generated API media and internal archives are excluded.',
  },
  budgets: {
    approvedBaseline: approvedPackageBaseline,
    maximumEntryCount,
    maximumPackedBytes,
  },
  forbiddenContentReview,
  npmPackDryRun: dryRun,
  tarEntries,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await rm(workRoot, { recursive: true, force: true });
console.log(
  `Archived package conformance for ${packed.filename}: ${packed.entryCount} files, ${packed.size} bytes.`
);
