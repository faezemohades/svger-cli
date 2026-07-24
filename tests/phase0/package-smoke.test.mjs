import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
);
const approvedPackageBaseline = {
  entryCount: 757,
  packedBytes: 616_992,
  intentionalAssetCount: 606,
  growthTolerance: 0.05,
  requiredHeadroom: 0.05,
};
const maximumEntryCount = Math.floor(
  approvedPackageBaseline.entryCount *
    (1 + approvedPackageBaseline.growthTolerance)
);
const maximumPackedBytes = Math.floor(
  approvedPackageBaseline.packedBytes *
    (1 + approvedPackageBaseline.growthTolerance)
);
const phase1MaximumEntryCount = Math.floor(
  maximumEntryCount * (1 - approvedPackageBaseline.requiredHeadroom)
);
const phase1MaximumPackedBytes = Math.floor(
  maximumPackedBytes * (1 - approvedPackageBaseline.requiredHeadroom)
);
const workRoot = await mkdtemp(path.join(tmpdir(), 'svger-package-smoke-'));
const packRoot = path.join(workRoot, 'pack');
const consumerRoot = path.join(workRoot, 'consumer');
await mkdir(packRoot);
await mkdir(consumerRoot);

const packResult = JSON.parse(
  execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', packRoot, '--ignore-scripts'],
    { cwd: repositoryRoot, encoding: 'utf8' }
  )
)[0];
const packedPaths = new Set(packResult.files.map(file => file.path));
for (const requiredPath of [
  'package.json',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/security/input-safety.js',
  'bin/svg-tool.js',
]) {
  assert.equal(
    packedPaths.has(requiredPath),
    true,
    `${requiredPath} missing from tarball`
  );
}
for (const excludedPath of [
  'dist/application/bounded-scheduler.d.ts',
  'dist/cli.d.ts',
  'dist/config.d.ts',
  'dist/optimizers/path-parser.d.ts',
  'dist/plugins/builtins.d.ts',
  'dist/utils/package-info.d.ts',
  'docs/phase0-release-gate.md',
]) {
  assert.equal(
    packedPaths.has(excludedPath),
    false,
    `${excludedPath} is development-only and must not be packed`
  );
}
assert.equal(
  packResult.files.some(file => file.path.startsWith('src/')),
  false,
  'source files leaked into tarball'
);
const forbiddenPatterns = [
  /^\.github\//,
  /^baselines\//,
  /^compatibility\//,
  /^coverage\//,
  /^dist\/__tests__\//,
  /^docs\/api\//,
  /^docs\/archive\//,
  /^reports\//,
  /^src\//,
  /^tests\//,
  /(?:^|\/)test-output(?:\/|$)/,
  /\.map$/,
];
const forbiddenFiles = packResult.files
  .map(file => file.path)
  .filter(filePath =>
    forbiddenPatterns.some(pattern => pattern.test(filePath))
  );
assert.deepEqual(
  forbiddenFiles,
  [],
  `forbidden tarball files: ${forbiddenFiles}`
);
assert.equal(
  packResult.files.filter(file => file.path.startsWith('assets/svges/')).length,
  approvedPackageBaseline.intentionalAssetCount,
  'the intentional public sample corpus changed without package-budget review'
);
assert.ok(
  packResult.entryCount <= maximumEntryCount,
  `tarball entry budget exceeded: ${packResult.entryCount}/${maximumEntryCount}`
);
assert.ok(
  packResult.size <= maximumPackedBytes,
  `tarball compressed-size budget exceeded: ${packResult.size}/${maximumPackedBytes}`
);
assert.ok(
  packResult.entryCount <= phase1MaximumEntryCount,
  `Phase 1 package lacks 5% file headroom: ${packResult.entryCount}/${phase1MaximumEntryCount}`
);
assert.ok(
  packResult.size <= phase1MaximumPackedBytes,
  `Phase 1 package lacks 5% compressed-size headroom: ${packResult.size}/${phase1MaximumPackedBytes}`
);

for (const aliases of [
  ['./webpack', './webpack-loader'],
  ['./babel', './babel-plugin'],
  ['./jest', './jest-transformer', './jest-preset'],
]) {
  const [canonical, ...compatibilityAliases] = aliases;
  for (const alias of compatibilityAliases) {
    assert.deepEqual(
      packageJson.exports[alias],
      packageJson.exports[canonical],
      `${alias} must reuse ${canonical} without duplicate physical files`
    );
  }
}

const tarballPath = path.join(packRoot, packResult.filename);
await writeFile(
  path.join(consumerRoot, 'package.json'),
  `${JSON.stringify({ name: 'svger-package-smoke', private: true, type: 'module' }, null, 2)}\n`
);
execFileSync(
  'npm',
  [
    'install',
    '--ignore-scripts',
    '--omit=optional',
    '--no-audit',
    '--no-fund',
    tarballPath,
  ],
  { cwd: consumerRoot, stdio: 'pipe' }
);

const binary = path.join(consumerRoot, 'node_modules', '.bin', 'svger');
const versionResult = spawnSync(binary, ['--version'], {
  cwd: consumerRoot,
  encoding: 'utf8',
});
assert.equal(versionResult.status, 0);
assert.equal(versionResult.stdout.trim(), packageJson.version);

const importResult = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '--eval',
    [
      "import { VERSION, configService, svgProcessor } from 'svger-cli';",
      "import { svgerVitePlugin } from 'svger-cli/vite';",
      "import { SvgerWebpackPlugin } from 'svger-cli/webpack';",
      "if (VERSION !== process.env.EXPECTED_VERSION) throw new Error('version mismatch');",
      "if (configService.getDefaultConfig().version !== process.env.EXPECTED_VERSION) throw new Error('config version mismatch');",
      "if (!svgProcessor || !svgerVitePlugin || !SvgerWebpackPlugin) throw new Error('missing export');",
    ].join('\n'),
  ],
  {
    cwd: consumerRoot,
    encoding: 'utf8',
    env: { ...process.env, EXPECTED_VERSION: packageJson.version },
  }
);
assert.equal(importResult.status, 0, importResult.stderr);

const installedPackageRoot = path.join(
  consumerRoot,
  'node_modules',
  'svger-cli'
);
assert.match(
  await readFile(path.join(installedPackageRoot, 'bin', 'svg-tool.js'), 'utf8'),
  /^#!\/usr\/bin\/env node/
);
await readFile(path.join(installedPackageRoot, 'dist', 'index.d.ts'), 'utf8');
await writeFile(
  path.join(consumerRoot, 'declaration-smoke.ts'),
  [
    "import { createSVGCompiler, type BuildReport } from 'svger-cli';",
    "import { svgerVitePlugin } from 'svger-cli/vite';",
    "import { SvgerWebpackPlugin } from 'svger-cli/webpack-loader';",
    "import svgerRollupPlugin from 'svger-cli/rollup';",
    "import svgerBabelPlugin from 'svger-cli/babel-plugin';",
    "import withSvger from 'svger-cli/nextjs';",
    "import jestPreset from 'svger-cli/jest-preset';",
    'void createSVGCompiler; void svgerVitePlugin; void SvgerWebpackPlugin;',
    'void svgerRollupPlugin; void svgerBabelPlugin; void withSvger; void jestPreset;',
    'const report = undefined as unknown as BuildReport; void report;',
  ].join('\n')
);
const declarationResult = spawnSync(
  process.execPath,
  [
    path.join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--noEmit',
    '--strict',
    '--target',
    'ES2022',
    '--module',
    'ES2022',
    '--moduleResolution',
    'Bundler',
    '--types',
    'node',
    '--typeRoots',
    path.join(repositoryRoot, 'node_modules', '@types'),
    'declaration-smoke.ts',
  ],
  { cwd: consumerRoot, encoding: 'utf8' }
);
assert.equal(declarationResult.status, 0, declarationResult.stderr);

const sourceRoot = path.join(consumerRoot, 'icons');
const outputRoot = path.join(consumerRoot, 'components');
await mkdir(sourceRoot);
await writeFile(
  path.join(sourceRoot, 'smoke.svg'),
  '<svg viewBox="0 0 24 24"><path d="M0 0h1v1z"/></svg>'
);
const buildResult = spawnSync(binary, ['build', sourceRoot, outputRoot], {
  cwd: consumerRoot,
  encoding: 'utf8',
});
assert.equal(
  buildResult.status,
  0,
  `${buildResult.stdout}\n${buildResult.stderr}`
);
await readFile(path.join(outputRoot, 'Smoke.tsx'), 'utf8');

console.log(
  `Package smoke passed: ${packResult.filename}, ${packResult.entryCount} files, ${packResult.size} bytes.`
);
await rm(workRoot, { recursive: true, force: true });
