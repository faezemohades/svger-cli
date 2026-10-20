import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertPackageBudgets,
  findCredentialContentInFiles,
} from '../../scripts/package-artifact-policy.mjs';

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
  intentionalAssetCount: 606,
  growthTolerance: 0.05,
  requiredHeadroom: 0.05,
};
const packageSizeBudget = {
  referenceBytes: 628_062,
  maximumBytes: 640_623,
};
const maximumEntryCount = Math.floor(
  approvedPackageBaseline.entryCount *
    (1 + approvedPackageBaseline.growthTolerance)
);
const phase1MaximumEntryCount = Math.floor(
  maximumEntryCount * (1 - approvedPackageBaseline.requiredHeadroom)
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
  'dist/compiler/ir-v1.js',
  'dist/compiler/lower-svg-document-to-ir.js',
  'dist/compiler/svelte-ir-emitter.js',
  'bin/svg-tool.js',
  'examples/vite.config.example.js',
  'examples/webpack.config.example.js',
]) {
  assert.equal(
    packedPaths.has(requiredPath),
    true,
    `${requiredPath} missing from tarball`
  );
}
for (const excludedPath of [
  'dist/application/bounded-scheduler.d.ts',
  'dist/application/artifact-contract.d.ts',
  'dist/application/build-plan.d.ts',
  'dist/application/source-discovery.d.ts',
  'dist/cli.d.ts',
  'dist/config.d.ts',
  'dist/optimizers/path-parser.d.ts',
  'dist/plugins/builtins.d.ts',
  'dist/security/svg-xml-safety.d.ts',
  'dist/utils/package-info.d.ts',
  'docs/phase0-release-gate.md',
  'examples/babel.config.example.js',
  'examples/jest.config.example.js',
  'examples/next.config.example.js',
  'examples/rollup.config.example.js',
]) {
  assert.equal(
    packedPaths.has(excludedPath),
    false,
    `${excludedPath} is intentionally repository-only under the package entry budget`
  );
}
for (const repositoryExample of [
  'examples/babel.config.example.js',
  'examples/jest.config.example.js',
  'examples/next.config.example.js',
  'examples/rollup.config.example.js',
]) {
  await readFile(path.join(repositoryRoot, repositoryExample), 'utf8');
}
assert.equal(
  packResult.files.some(file => file.path.startsWith('src/')),
  false,
  'source files leaked into tarball'
);
const forbiddenPatterns = [
  /^\.github\//,
  /(?:^|\/)\.npmrc$/i,
  /(?:^|\/)\.env(?:\.[^/]+)?$/i,
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
assertPackageBudgets({
  size: packResult.size,
  entryCount: packResult.entryCount,
  maxBytes: packageSizeBudget.maximumBytes,
  maxEntries: maximumEntryCount,
});
const credentialFindings = await findCredentialContentInFiles(
  repositoryRoot,
  packResult.files.map(file => file.path)
);
assert.deepEqual(
  credentialFindings,
  [],
  'credential-shaped content must not appear in the published package'
);
assert.ok(
  packResult.entryCount <= phase1MaximumEntryCount,
  `Phase 1 package lacks 5% file headroom: ${packResult.entryCount}/${phase1MaximumEntryCount}`
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
    '--offline',
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
      "import { SvgerWebpackPlugin as WebpackPlugin, svgerLoader } from 'svger-cli/webpack';",
      "import { svgerRollupPlugin } from 'svger-cli/rollup';",
      "import { svgerBabelPlugin } from 'svger-cli/babel';",
      "import { withSvger } from 'svger-cli/nextjs';",
      "import jestTransformer, { jestPreset } from 'svger-cli/jest';",
      "import { SvgerWebpackPlugin } from 'svger-cli/webpack-loader';",
      "import babelPluginAlias from 'svger-cli/babel-plugin';",
      "import jestTransformerAlias from 'svger-cli/jest-transformer';",
      "import jestPresetAlias from 'svger-cli/jest-preset';",
      "if (VERSION !== process.env.EXPECTED_VERSION) throw new Error('version mismatch');",
      "if (configService.getDefaultConfig().version !== process.env.EXPECTED_VERSION) throw new Error('config version mismatch');",
      "if (!svgProcessor || !svgerVitePlugin || !WebpackPlugin || !SvgerWebpackPlugin || !svgerLoader || !svgerRollupPlugin || !svgerBabelPlugin || !withSvger || !jestTransformer.process || !jestPreset.transform || !babelPluginAlias || !jestTransformerAlias.process || !jestPresetAlias.process) throw new Error('missing integration export');",
      "if (typeof svgerVitePlugin({ source: 'icons' }).name !== 'string') throw new Error('Vite plugin factory failed');",
      "if (typeof svgerRollupPlugin({ source: 'icons' }).name !== 'string') throw new Error('Rollup plugin factory failed');",
      "if (typeof withSvger({}).webpack !== 'function') throw new Error('Next.js wrapper failed');",
      "if (typeof new WebpackPlugin({ source: 'icons' }).apply !== 'function') throw new Error('Webpack plugin constructor failed');",
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
const packagedIntegrationGuide = await readFile(
  path.join(installedPackageRoot, 'docs', 'INTEGRATIONS.md'),
  'utf8'
);
for (const integration of ['babel', 'jest', 'next', 'rollup']) {
  const examplePath = `examples/${integration}.config.example.js`;
  assert.equal(
    packagedIntegrationGuide.includes(`](./${examplePath})`),
    false,
    `installed integration guide must not contain a broken relative link for ${examplePath}`
  );
  assert.ok(
    packagedIntegrationGuide.includes(
      `https://github.com/faezemohades/svger-cli/blob/main/${examplePath}`
    ),
    `installed integration guide must link to the repository source for ${examplePath}`
  );
}
assert.match(
  packagedIntegrationGuide,
  /the full Babel, Jest, Next\.js, and Rollup files remain in the\s+repository rather than the tarball/u
);
const installedPackageJson = JSON.parse(
  await readFile(path.join(installedPackageRoot, 'package.json'), 'utf8')
);
assert.equal(installedPackageJson.dependencies?.['uglify-js'], undefined);
assert.equal(
  installedPackageJson.optionalDependencies?.['uglify-js'],
  undefined
);
assert.equal(installedPackageJson.peerDependencies?.['uglify-js'], undefined);
assert.match(
  await readFile(path.join(installedPackageRoot, 'bin', 'svg-tool.js'), 'utf8'),
  /^#!\/usr\/bin\/env node/
);
await readFile(path.join(installedPackageRoot, 'dist', 'index.d.ts'), 'utf8');
await writeFile(
  path.join(consumerRoot, 'declaration-smoke.ts'),
  [
    "import { createSVGCompiler, type BuildReport, type BuildRequest } from 'svger-cli';",
    "import { svgerVitePlugin } from 'svger-cli/vite';",
    "import { SvgerWebpackPlugin } from 'svger-cli/webpack-loader';",
    "import svgerRollupPlugin from 'svger-cli/rollup';",
    "import svgerBabelPlugin from 'svger-cli/babel-plugin';",
    "import withSvger from 'svger-cli/nextjs';",
    "import jestPreset from 'svger-cli/jest-preset';",
    'void createSVGCompiler; void svgerVitePlugin; void SvgerWebpackPlugin;',
    'void svgerRollupPlugin; void svgerBabelPlugin; void withSvger; void jestPreset;',
    "const optInRequest = { src: 'icons', out: 'components', framework: 'svelte', svelteCompiler: 'ir-v1' } satisfies BuildRequest; void optInRequest;",
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

const svelteSourceRoot = path.join(consumerRoot, 'svelte-icons');
await mkdir(svelteSourceRoot);
await writeFile(
  path.join(svelteSourceRoot, 'smoke.svg'),
  '<svg viewBox="0 0 8 8"><title>Installed package</title><path d="M0 0h8v8z"/></svg>'
);
const svelteSmoke = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '--eval',
    [
      "import { createSVGCompiler } from 'svger-cli';",
      'const compiler = await createSVGCompiler({ cwd: process.cwd() });',
      'for (const typescript of [false, true]) {',
      " const out = `svelte-${typescript ? 'ts' : 'js'}`;",
      " const report = await compiler.build({ src: 'svelte-icons', out, framework: 'svelte', typescript, svelteCompiler: 'ir-v1', optimize: 'none' });",
      " if (report.status !== 'success') throw new Error(JSON.stringify(report.diagnostics));",
      '}',
    ].join('\n'),
  ],
  { cwd: consumerRoot, encoding: 'utf8' }
);
assert.equal(svelteSmoke.status, 0, svelteSmoke.stderr);
const svelteJS = await readFile(
  path.join(consumerRoot, 'svelte-js', 'Smoke.svelte'),
  'utf8'
);
const svelteTS = await readFile(
  path.join(consumerRoot, 'svelte-ts', 'Smoke.svelte'),
  'utf8'
);
assert.doesNotMatch(svelteJS, /<script lang="ts">/u);
assert.match(svelteTS, /<script lang="ts">/u);

console.log(
  `Package smoke passed: ${packResult.filename}, ${packResult.entryCount} files, ${packResult.size} bytes.`
);
await rm(workRoot, { recursive: true, force: true });
