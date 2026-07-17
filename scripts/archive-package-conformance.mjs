import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
);
const approvedPackageBaseline = {
  entryCount: 757,
  packedBytes: 616_991,
  intentionalAssetCount: 606,
  growthTolerance: 0.05,
};
const maximumEntryCount = Math.floor(
  approvedPackageBaseline.entryCount *
    (1 + approvedPackageBaseline.growthTolerance)
);
const maximumPackedBytes = Math.floor(
  approvedPackageBaseline.packedBytes *
    (1 + approvedPackageBaseline.growthTolerance)
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
    `Expected the reviewed ${approvedPackageBaseline.intentionalAssetCount}-file public sample corpus, received ${groups.assets ?? 0} files.`
  );
}
if (packed.entryCount > maximumEntryCount || packed.size > maximumPackedBytes) {
  throw new Error(
    `Package budget exceeded: ${packed.entryCount}/${maximumEntryCount} files, ${packed.size}/${maximumPackedBytes} bytes.`
  );
}

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
      '606 documented sample SVGs support the public test-svger executable and published benchmarking workflow.',
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
await writeFile(
  path.join(
    repositoryRoot,
    'reports',
    `package-conformance-v${packageJson.version}.json`
  ),
  `${JSON.stringify(report, null, 2)}\n`
);
await rm(workRoot, { recursive: true, force: true });
console.log(
  `Archived package conformance for ${packed.filename}: ${packed.entryCount} files, ${packed.size} bytes.`
);
