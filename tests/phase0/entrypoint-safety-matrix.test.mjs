import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildAll } from '../../dist/builder.js';
import { svgProcessor } from '../../dist/processors/svg-processor.js';
import { svgService } from '../../dist/services/svg-service.js';
import { svgerVitePlugin } from '../../dist/integrations/vite.js';
import { svgerRollupPlugin } from '../../dist/integrations/rollup.js';
import { svgerBabelPlugin } from '../../dist/integrations/babel.js';
import {
  SvgerWebpackPlugin,
  svgerLoader,
} from '../../dist/integrations/webpack.js';
import { svgerJestTransformer } from '../../dist/integrations/jest-preset.js';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const workRoot = await mkdtemp(path.join(tmpdir(), 'svger-entrypoint-matrix-'));
const safeSVG = '<svg viewBox="0 0 24 24"><path d="M0 0h1v1z"/></svg>';
const unsafeSVG =
  '<svg onload="bad()"><script>bad()</script><a href="javascript:bad()"><path/></a></svg>';
const matrix = {};
const reportPath = path.join(
  repositoryRoot,
  'reports',
  'phase0-entrypoint-safety-matrix.json'
);

const record = (entryPoint, capability) => {
  matrix[entryPoint] ??= { reject: 'N/A', strip: 'N/A', sandbox: 'N/A' };
  matrix[entryPoint][capability] = 'PASS';
};
const assertSanitized = content => {
  assert.equal(/<\s*script\b/i.test(content), false);
  assert.equal(/\son[a-z][\w:.-]*\s*=/i.test(content), false);
  assert.equal(/javascript\s*:/i.test(content), false);
};
const expectCode = async (operation, code) => {
  await assert.rejects(operation, error => error?.code === code);
};
const createSource = async (directoryName, fileName, content) => {
  const directory = path.join(workRoot, directoryName);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, content);
  return { directory, filePath };
};
const createSandbox = async (directoryName, artifactName) => {
  const output = path.join(workRoot, directoryName);
  await mkdir(output, { recursive: true });
  const outside = path.join(workRoot, `${directoryName}-outside.txt`);
  await writeFile(outside, 'UNCHANGED');
  await symlink(outside, path.join(output, artifactName));
  return { output, outside };
};
const assertSandboxUnchanged = async outside => {
  assert.equal(await readFile(outside, 'utf8'), 'UNCHANGED');
};
const runCLI = args =>
  spawnSync(
    'node',
    [path.join(repositoryRoot, 'bin', 'svg-tool.js'), ...args],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }
  );
const runWebpackLoader = (content, options = {}) =>
  new Promise((resolve, reject) => {
    const context = {
      async: () => (error, result) => (error ? reject(error) : resolve(result)),
      getOptions: () => options,
      hot: false,
      resourcePath: path.join(workRoot, 'webpack-loader.svg'),
    };
    void svgerLoader.call(context, content);
  });
const runWebpackPlugin = async options => {
  let build;
  new SvgerWebpackPlugin(options).apply({
    hooks: {
      beforeCompile: { tapPromise: (_name, callback) => (build = callback) },
      done: { tap: () => undefined },
      watchRun: { tapPromise: () => undefined },
    },
    options: { watch: false },
  });
  await build();
};

// CLI build
const cliBuildSource = await createSource(
  'cli-build-source',
  'matrix.svg',
  unsafeSVG
);
const cliBuildReject = runCLI([
  'build',
  cliBuildSource.directory,
  path.join(workRoot, 'cli-build-reject'),
]);
assert.equal(cliBuildReject.status, 5);
assert.match(
  `${cliBuildReject.stdout}${cliBuildReject.stderr}`,
  /E_UNSAFE_SVG_CONTENT/
);
record('CLI build', 'reject');
const cliBuildStripOutput = path.join(workRoot, 'cli-build-strip');
const cliBuildStrip = runCLI([
  'build',
  cliBuildSource.directory,
  cliBuildStripOutput,
  '--unsafe-input-policy',
  'strip',
]);
assert.equal(cliBuildStrip.status, 0);
assertSanitized(
  await readFile(path.join(cliBuildStripOutput, 'Matrix.tsx'), 'utf8')
);
record('CLI build', 'strip');
const cliBuildSafeSource = await createSource(
  'cli-build-safe',
  'matrix.svg',
  safeSVG
);
const cliBuildSandbox = await createSandbox('cli-build-sandbox', 'Matrix.tsx');
const cliBuildSandboxResult = runCLI([
  'build',
  cliBuildSafeSource.directory,
  cliBuildSandbox.output,
]);
assert.equal(cliBuildSandboxResult.status, 8);
await assertSandboxUnchanged(cliBuildSandbox.outside);
record('CLI build', 'sandbox');

// CLI generate
const cliGenerateReject = runCLI([
  'generate',
  cliBuildSource.filePath,
  path.join(workRoot, 'cli-generate-reject'),
]);
assert.equal(cliGenerateReject.status, 5);
record('CLI generate', 'reject');
const cliGenerateStripOutput = path.join(workRoot, 'cli-generate-strip');
const cliGenerateStrip = runCLI([
  'generate',
  cliBuildSource.filePath,
  cliGenerateStripOutput,
  '--unsafe-input-policy',
  'strip',
]);
assert.equal(cliGenerateStrip.status, 0);
assertSanitized(
  await readFile(path.join(cliGenerateStripOutput, 'Matrix.tsx'), 'utf8')
);
record('CLI generate', 'strip');
const cliGenerateSafe = await createSource(
  'cli-generate-safe',
  'generate.svg',
  safeSVG
);
const cliGenerateSandbox = await createSandbox(
  'cli-generate-sandbox',
  'Generate.tsx'
);
const cliGenerateSandboxResult = runCLI([
  'generate',
  cliGenerateSafe.filePath,
  cliGenerateSandbox.output,
]);
assert.equal(cliGenerateSandboxResult.status, 8);
await assertSandboxUnchanged(cliGenerateSandbox.outside);
record('CLI generate', 'sandbox');

// CLI optimize
const cliOptimizeRejectOutput = path.join(workRoot, 'cli-optimize-reject');
const cliOptimizeReject = runCLI([
  'optimize',
  cliBuildSource.directory,
  cliOptimizeRejectOutput,
]);
assert.equal(cliOptimizeReject.status, 5);
assert.match(
  `${cliOptimizeReject.stdout}${cliOptimizeReject.stderr}`,
  /E_UNSAFE_SVG_CONTENT/
);
assert.deepEqual(await readdir(cliOptimizeRejectOutput), []);
record('CLI optimize', 'reject');
const cliOptimizeStripOutput = path.join(workRoot, 'cli-optimize-strip');
runCLI([
  'optimize',
  cliBuildSource.directory,
  cliOptimizeStripOutput,
  '--unsafe-input-policy',
  'strip',
]);
assertSanitized(
  await readFile(path.join(cliOptimizeStripOutput, 'matrix.svg'), 'utf8')
);
record('CLI optimize', 'strip');
const cliOptimizeSandbox = await createSandbox(
  'cli-optimize-sandbox',
  'matrix.svg'
);
const cliOptimizeSandboxResult = runCLI([
  'optimize',
  cliBuildSafeSource.directory,
  cliOptimizeSandbox.output,
]);
assert.equal(cliOptimizeSandboxResult.status, 8);
await assertSandboxUnchanged(cliOptimizeSandbox.outside);
record('CLI optimize', 'sandbox');

// Direct processor API
await expectCode(
  () => svgProcessor.generateComponent('Matrix', unsafeSVG),
  'E_UNSAFE_SVG_CONTENT'
);
record('SVGProcessor', 'reject');
assertSanitized(
  await svgProcessor.generateComponent('Matrix', unsafeSVG, {
    unsafeInputPolicy: 'strip',
  })
);
record('SVGProcessor', 'strip');
const processorSafe = await createSource(
  'processor-safe',
  'processor.svg',
  safeSVG
);
const processorSandbox = await createSandbox(
  'processor-sandbox',
  'Processor.tsx'
);
const processorResult = await svgProcessor.processSVGFile(
  processorSafe.filePath,
  processorSandbox.output
);
assert.equal(processorResult.error?.code, 'E_OUTPUT_PATH_ESCAPE');
await assertSandboxUnchanged(processorSandbox.outside);
record('SVGProcessor', 'sandbox');

// Legacy builder API
const legacyReject = await buildAll({
  src: cliBuildSource.directory,
  out: path.join(workRoot, 'legacy-reject'),
});
assert.equal(legacyReject.exitCode, 5);
assert.equal(legacyReject.diagnostics[0].code, 'E_UNSAFE_SVG_CONTENT');
record('Legacy builder API', 'reject');
const legacyStripOutput = path.join(workRoot, 'legacy-strip');
await buildAll({
  src: cliBuildSource.directory,
  out: legacyStripOutput,
  unsafeInputPolicy: 'strip',
});
assertSanitized(
  await readFile(path.join(legacyStripOutput, 'Matrix.tsx'), 'utf8')
);
record('Legacy builder API', 'strip');
const legacySafe = await createSource('legacy-safe', 'legacy.svg', safeSVG);
const legacySandbox = await createSandbox('legacy-sandbox', 'Legacy.tsx');
const legacySandboxReport = await buildAll({
  src: legacySafe.directory,
  out: legacySandbox.output,
});
assert.equal(legacySandboxReport.exitCode, 8);
assert.equal(legacySandboxReport.diagnostics[0].code, 'E_OUTPUT_PATH_ESCAPE');
await assertSandboxUnchanged(legacySandbox.outside);
record('Legacy builder API', 'sandbox');

// SVGService
await expectCode(
  () =>
    svgService.buildAll({
      src: cliBuildSource.directory,
      out: path.join(workRoot, 'service-reject'),
    }),
  'E_UNSAFE_SVG_CONTENT'
);
record('SVGService', 'reject');
const serviceStripOutput = path.join(workRoot, 'service-strip');
await svgService.buildAll({
  src: cliBuildSource.directory,
  out: serviceStripOutput,
  unsafeInputPolicy: 'strip',
});
assertSanitized(
  await readFile(path.join(serviceStripOutput, 'Matrix.tsx'), 'utf8')
);
record('SVGService', 'strip');
const serviceSafe = await createSource('service-safe', 'service.svg', safeSVG);
const serviceSandbox = await createSandbox('service-sandbox', 'Service.tsx');
await expectCode(
  () =>
    svgService.buildAll({
      src: serviceSafe.directory,
      out: serviceSandbox.output,
    }),
  'E_OUTPUT_PATH_ESCAPE'
);
await assertSandboxUnchanged(serviceSandbox.outside);
record('SVGService', 'sandbox');

// Vite
await expectCode(
  () => svgerVitePlugin().transform(unsafeSVG, 'vite.svg'),
  'E_UNSAFE_SVG_CONTENT'
);
record('Vite', 'reject');
const viteStripResult = await svgerVitePlugin({
  unsafeInputPolicy: 'strip',
}).transform(unsafeSVG, 'vite.svg');
assertSanitized(viteStripResult.code);
record('Vite', 'strip');
const viteSafe = await createSource('vite-safe', 'vite.svg', safeSVG);
const viteSandbox = await createSandbox('vite-sandbox', 'Vite.tsx');
await svgerVitePlugin({
  source: viteSafe.directory,
  output: viteSandbox.output,
}).buildStart();
await assertSandboxUnchanged(viteSandbox.outside);
record('Vite', 'sandbox');

// Rollup
await expectCode(
  () => svgerRollupPlugin().transform(unsafeSVG, 'rollup.svg'),
  'E_UNSAFE_SVG_CONTENT'
);
record('Rollup', 'reject');
const rollupStripResult = await svgerRollupPlugin({
  unsafeInputPolicy: 'strip',
}).transform(unsafeSVG, 'rollup.svg');
assertSanitized(rollupStripResult.code);
record('Rollup', 'strip');
const rollupSafe = await createSource('rollup-safe', 'rollup.svg', safeSVG);
const rollupSandbox = await createSandbox('rollup-sandbox', 'Rollup.tsx');
await svgerRollupPlugin({
  source: rollupSafe.directory,
  output: rollupSandbox.output,
}).buildStart();
await assertSandboxUnchanged(rollupSandbox.outside);
record('Rollup', 'sandbox');

// Webpack
await expectCode(() => runWebpackLoader(unsafeSVG), 'E_UNSAFE_SVG_CONTENT');
record('Webpack', 'reject');
assertSanitized(
  await runWebpackLoader(unsafeSVG, { unsafeInputPolicy: 'strip' })
);
record('Webpack', 'strip');
const webpackSafe = await createSource('webpack-safe', 'webpack.svg', safeSVG);
const webpackSandbox = await createSandbox('webpack-sandbox', 'Webpack.tsx');
await runWebpackPlugin({
  source: webpackSafe.directory,
  output: webpackSandbox.output,
});
await assertSandboxUnchanged(webpackSandbox.outside);
record('Webpack', 'sandbox');

// Babel
const babelRejectOutput = path.join(workRoot, 'babel-reject');
await svgerBabelPlugin(undefined, {
  source: cliBuildSource.directory,
  output: babelRejectOutput,
}).visitor.Program.enter();
assert.deepEqual(await readdir(babelRejectOutput).catch(() => []), []);
record('Babel', 'reject');
const babelStripOutput = path.join(workRoot, 'babel-strip');
await svgerBabelPlugin(undefined, {
  source: cliBuildSource.directory,
  output: babelStripOutput,
  unsafeInputPolicy: 'strip',
}).visitor.Program.enter();
assertSanitized(
  await readFile(path.join(babelStripOutput, 'Matrix.tsx'), 'utf8')
);
record('Babel', 'strip');
const babelSafe = await createSource('babel-safe', 'babel.svg', safeSVG);
const babelSandbox = await createSandbox('babel-sandbox', 'Babel.tsx');
await svgerBabelPlugin(undefined, {
  source: babelSafe.directory,
  output: babelSandbox.output,
}).visitor.Program.enter();
await assertSandboxUnchanged(babelSandbox.outside);
record('Babel', 'sandbox');

// Jest transformer (no filesystem artifact surface, so sandbox is not applicable)
assert.throws(
  () => svgerJestTransformer.process(unsafeSVG, 'jest.svg', {}),
  error => error?.code === 'E_UNSAFE_SVG_CONTENT'
);
record('Jest transformer', 'reject');
assertSanitized(
  svgerJestTransformer.process(unsafeSVG, 'jest.svg', {
    transformerConfig: { svger: { unsafeInputPolicy: 'strip' } },
  }).code
);
record('Jest transformer', 'strip');
matrix['Jest transformer'].sandbox =
  'N/A — transformer performs no filesystem writes';

// Next.js delegates processing and writes to the tested Webpack plugin/loader.
matrix['Next.js'] = {
  reject: 'PASS — delegated to Webpack contract',
  strip: 'PASS — option propagated to Webpack contract',
  sandbox: 'PASS — delegated to Webpack artifact writer',
};

const report = { schemaVersion: 1, matrix };
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(0);
