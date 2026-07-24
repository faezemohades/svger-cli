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
import {
  applySVGInputSafety,
  resolveOutputArtifactPath,
} from '../../dist/security/input-safety.js';
import {
  svgerLoader,
  SvgerWebpackPlugin,
} from '../../dist/integrations/webpack.js';
import { svgerVitePlugin } from '../../dist/integrations/vite.js';
import { svgerRollupPlugin } from '../../dist/integrations/rollup.js';
import { svgerBabelPlugin } from '../../dist/integrations/babel.js';
import { svgerJestTransformer } from '../../dist/integrations/jest-preset.js';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const workRoot = await mkdtemp(path.join(tmpdir(), 'svger-phase0-security-'));
const safeSVG = '<svg viewBox="0 0 24 24"><path d="M0 0h1v1z"/></svg>';
const unsafeSamples = [
  ['script element', '<svg><script>alert(1)</script><path/></svg>'],
  ['event handler', '<svg onload="alert(1)"><path/></svg>'],
  ['JavaScript URI', '<svg><a href="javascript:alert(1)"><path/></a></svg>'],
];
let assertions = 0;

const expectCode = async (operation, code) => {
  await assert.rejects(operation, error => {
    assertions += 1;
    return (
      error instanceof Error &&
      error.code === code &&
      error.message.includes(code)
    );
  });
};

for (const [label, content] of unsafeSamples) {
  await expectCode(
    () => svgProcessor.generateComponent('Unsafe', content),
    'E_UNSAFE_SVG_CONTENT'
  );
  console.log(`PASS core rejects ${label}`);
}

const warnings = [];
const stripped = applySVGInputSafety(
  '<svg onload="bad()"><script>bad()</script><a href="javascript:bad()"><path/></a></svg>',
  { unsafeInputPolicy: 'strip', warn: warning => warnings.push(warning) }
);
assert.equal(stripped.includes('<script'), false);
assert.equal(/\sonload\s*=/.test(stripped), false);
assert.equal(/javascript\s*:/i.test(stripped), false);
assert.match(warnings[0], /SECURITY WARNING/);
assertions += 4;
console.log('PASS explicit strip policy warns and removes blocked constructs');

await expectCode(
  () =>
    svgProcessor.generateComponent('Oversized', safeSVG, {
      maxInputSizeBytes: 8,
    }),
  'E_SVG_INPUT_TOO_LARGE'
);
console.log('PASS configurable input size limit');

const sandboxRoot = path.join(workRoot, 'sandbox');
await mkdir(sandboxRoot);
assert.throws(
  () => resolveOutputArtifactPath(sandboxRoot, '..', 'escape.tsx'),
  error => error instanceof Error && error.code === 'E_OUTPUT_PATH_ESCAPE'
);
await writeFile(path.join(workRoot, 'outside.tsx'), 'outside');
await symlink(
  path.join(workRoot, 'outside.tsx'),
  path.join(sandboxRoot, 'linked.tsx')
);
assert.throws(
  () => resolveOutputArtifactPath(sandboxRoot, 'linked.tsx'),
  error => error instanceof Error && error.code === 'E_OUTPUT_PATH_ESCAPE'
);
assertions += 2;
console.log('PASS lexical and symbolic-link output escapes are rejected');

const unsafeSource = path.join(workRoot, 'unsafe-source');
await mkdir(unsafeSource);
await writeFile(path.join(unsafeSource, 'unsafe.svg'), unsafeSamples[0][1]);

const legacyOutput = path.join(workRoot, 'legacy-output');
const legacyReport = await buildAll({ src: unsafeSource, out: legacyOutput });
assert.equal(legacyReport.exitCode, 5);
assert.equal(legacyReport.diagnostics[0].code, 'E_UNSAFE_SVG_CONTENT');
await assert.rejects(() => readdir(legacyOutput), { code: 'ENOENT' });
assertions += 3;
console.log('PASS legacy builder rejects without writing an artifact');

const serviceOutput = path.join(workRoot, 'service-output');
await expectCode(
  () => svgService.buildAll({ src: unsafeSource, out: serviceOutput }),
  'E_UNSAFE_SVG_CONTENT'
);
assert.deepEqual(await readdir(serviceOutput), []);
assertions += 1;
console.log('PASS SVGService rejects without writing an artifact or index');

const vite = svgerVitePlugin({
  source: unsafeSource,
  output: path.join(workRoot, 'vite'),
});
await expectCode(
  () =>
    vite.transform(unsafeSamples[1][1], path.join(unsafeSource, 'vite.svg')),
  'E_UNSAFE_SVG_CONTENT'
);
const rollup = svgerRollupPlugin({
  source: unsafeSource,
  output: path.join(workRoot, 'rollup'),
});
await expectCode(
  () =>
    rollup.transform(
      unsafeSamples[2][1],
      path.join(unsafeSource, 'rollup.svg')
    ),
  'E_UNSAFE_SVG_CONTENT'
);
console.log('PASS Vite and Rollup transform hooks reject unsafe raw content');

await new Promise((resolve, reject) => {
  const loaderContext = {
    async: () => error => {
      try {
        assert.equal(error?.code, 'E_UNSAFE_SVG_CONTENT');
        assertions += 1;
        resolve();
      } catch (assertionError) {
        reject(assertionError);
      }
    },
    getOptions: () => ({}),
    hot: false,
    resourcePath: path.join(unsafeSource, 'webpack-loader.svg'),
  };
  void svgerLoader.call(loaderContext, unsafeSamples[0][1]);
});
console.log('PASS Webpack loader rejects unsafe raw content');

assert.throws(
  () =>
    svgerJestTransformer.process(unsafeSamples[0][1], 'jest.svg', {
      transformerConfig: { svger: {} },
    }),
  error => error instanceof Error && error.code === 'E_UNSAFE_SVG_CONTENT'
);
assertions += 1;
console.log('PASS Jest transformer rejects before mock/fallback behavior');

const webpackOutput = path.join(workRoot, 'webpack-plugin');
let webpackBuild;
const webpackPlugin = new SvgerWebpackPlugin({
  source: unsafeSource,
  output: webpackOutput,
  generateIndex: true,
});
webpackPlugin.apply({
  hooks: {
    beforeCompile: {
      tapPromise: (_name, callback) => (webpackBuild = callback),
    },
    done: { tap: () => undefined },
    watchRun: { tapPromise: () => undefined },
  },
  options: { watch: false },
});
await webpackBuild();
assert.deepEqual(await readdir(webpackOutput), []);
assertions += 1;
console.log('PASS Webpack plugin emits no artifact for unsafe input');

const babelOutput = path.join(workRoot, 'babel-plugin');
const babel = svgerBabelPlugin(undefined, {
  source: unsafeSource,
  output: babelOutput,
  processOnInit: true,
});
await babel.visitor.Program.enter();
assert.deepEqual(await readdir(babelOutput).catch(() => []), []);
assertions += 1;
console.log('PASS Babel plugin emits no artifact for unsafe input');

const cliOutput = path.join(workRoot, 'cli-output');
const rejectedCLI = spawnSync(
  'node',
  [
    path.join(repositoryRoot, 'bin', 'svg-tool.js'),
    'generate',
    path.join(unsafeSource, 'unsafe.svg'),
    cliOutput,
  ],
  { cwd: repositoryRoot, encoding: 'utf8' }
);
assert.equal(rejectedCLI.status, 5);
assert.match(
  `${rejectedCLI.stdout}${rejectedCLI.stderr}`,
  /E_UNSAFE_SVG_CONTENT/
);
assertions += 2;

const strippedCLI = spawnSync(
  'node',
  [
    path.join(repositoryRoot, 'bin', 'svg-tool.js'),
    'generate',
    path.join(unsafeSource, 'unsafe.svg'),
    cliOutput,
    '--unsafe-input-policy',
    'strip',
  ],
  { cwd: repositoryRoot, encoding: 'utf8' }
);
assert.equal(strippedCLI.status, 0);
assert.match(`${strippedCLI.stdout}${strippedCLI.stderr}`, /SECURITY WARNING/);
const cliArtifact = await readFile(path.join(cliOutput, 'Unsafe.tsx'), 'utf8');
assert.equal(cliArtifact.includes('<script'), false);
assertions += 3;
console.log('PASS CLI reject default and explicit strip policy');

await svgProcessor.generateFrameworkComponent('Safe', safeSVG, {
  componentName: 'Safe',
  svgContent: safeSVG,
  framework: 'react',
  typescript: true,
});
assertions += 1;
console.log(`Phase 0 containment assertions passed: ${assertions}`);
process.exit(0);
