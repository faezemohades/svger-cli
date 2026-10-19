import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ConfigService,
  ContentAddressableCache,
  DiagnosticError,
  ExitCode,
  NullLogger,
  SVGCompilerApplicationService,
  SVGProcessor,
  createBuildReport,
  createSVGCompiler,
  diagnosticFromUnknown,
  explainConfiguration,
  formatBuildReport,
  resolveConfiguration,
  sanitizePublicError,
  svgerRollupPlugin,
  svgerVitePlugin,
} from '../../dist/index.js';
import { OptimizerPipeline } from '../../dist/optimizers/optimizer-pipeline.js';
import { svgerLoader } from '../../dist/integrations/webpack.js';
import {
  EnhancedPluginManager,
  getPluginManager,
} from '../../dist/core/enhanced-plugin-manager.js';
import { SVGService } from '../../dist/services/svg-service.js';

const defaults = new ConfigService().getDefaultConfig();
const mutableLayer = {
  origin: 'compiler',
  value: {
    cache: false,
    performance: { cacheTimeout: 0 },
    styleRules: { fill: '' },
    animations: [],
  },
};
const resolved = resolveConfiguration(defaults, [mutableLayer]);
assert.equal(resolved.config.cache, false);
assert.equal(resolved.config.performance.cacheTimeout, 0);
assert.equal(resolved.config.styleRules.fill, '');
assert.equal(resolved.config.styleRules.stroke, 'none');
assert.deepEqual(resolved.config.animations, []);
assert.equal(resolved.origins.cache, 'compiler');
assert.equal(resolved.origins['performance.cacheTimeout'], 'compiler');
assert.ok(Object.isFrozen(resolved.config.styleRules));
mutableLayer.value.styleRules.fill = 'mutated';
assert.equal(resolved.config.styleRules.fill, '');

assert.throws(
  () =>
    resolveConfiguration(defaults, [
      { origin: 'request', value: { framwork: 'react' } },
    ]),
  error =>
    error.code === 'E_INVALID_CONFIGURATION' &&
    /unknown setting/.test(error.message)
);
assert.throws(
  () =>
    resolveConfiguration(defaults, [
      { origin: 'request', value: { framework: 'unknown' } },
    ]),
  error =>
    error.code === 'E_INVALID_CONFIGURATION' &&
    /supported framework/.test(error.message)
);

const explained = explainConfiguration(
  resolveConfiguration(defaults, [
    {
      origin: 'request',
      value: {
        framework: 'vue',
        plugins: [{ name: 'fixture', options: { apiToken: 'do-not-print' } }],
      },
    },
  ])
);
assert.equal(
  explained.find(entry => entry.path === 'plugins.0.options.apiToken').value,
  '[REDACTED]'
);

const publicSecret = 'cfg-secret-7e84';
const causeWithSecret = new Error(`provider failure apiToken=${publicSecret}`);
const internalFailure = new DiagnosticError(
  'E_PLUGIN_HOOK_FAILED',
  'Plugin rejected credentials. Retry after configuration review.',
  {
    exitCode: ExitCode.PluginFailure,
    cause: causeWithSecret,
    file: `apiToken=${publicSecret}`,
    hint: `token=${publicSecret}`,
    metadata: { apiToken: publicSecret },
  }
);
const sanitizedFailure = sanitizePublicError(internalFailure);
assert.equal(sanitizedFailure.cause, causeWithSecret);
assert.match(sanitizedFailure.message, /Retry after configuration review/);
assert.equal(sanitizedFailure.message.includes(publicSecret), false);
assert.equal(sanitizedFailure.file, 'apiToken=[REDACTED]');
assert.equal(sanitizedFailure.hint, 'token=[REDACTED]');
assert.equal(sanitizedFailure.metadata.apiToken, '[REDACTED]');
assert.equal(
  diagnosticFromUnknown(new Error(`CLI apiToken=${publicSecret}`)).message,
  'CLI apiToken=[REDACTED]'
);

const secretReport = createBuildReport({
  exitCode: ExitCode.PluginFailure,
  diagnostics: [
    {
      code: 'E_PLUGIN_HOOK_FAILED',
      severity: 'error',
      message: `Provider failed for apiToken=${publicSecret}. Check access policy.`,
      file: `apiToken=${publicSecret}`,
      hint: `token=${publicSecret}`,
      metadata: {
        apiToken: publicSecret,
        detail: `credential=${publicSecret}`,
      },
    },
  ],
});
for (const format of ['pretty', 'json', 'ndjson']) {
  const rendered = formatBuildReport(secretReport, format);
  assert.equal(rendered.includes(publicSecret), false, `${format} redaction`);
  assert.match(rendered, /\[REDACTED\]/, `${format} keeps diagnostic context`);
}
assert.equal(JSON.stringify(secretReport).includes('cause'), false);
assert.equal(JSON.stringify(secretReport).includes(publicSecret), false);

const optimizer = new OptimizerPipeline();
const stageCause = new Error('private stage detail');
optimizer.registerStage('fixture-stage', async () => {
  throw stageCause;
});
await assert.rejects(
  optimizer.optimize('<svg/>'),
  error =>
    error.code === 'E_OPTIMIZER_STAGE_FAILED' &&
    error.cause === stageCause &&
    !error.message.includes(stageCause.message)
);

const pluginManager = new EnhancedPluginManager();
const pluginCause = new Error('private plugin detail');
pluginManager.registerPlugin({
  name: 'failure-fixture',
  version: '1.0.0',
  hooks: {
    'after-parse': async () => {
      throw pluginCause;
    },
  },
});
const pluginProcessor = new SVGProcessor({ pluginManager });
await assert.rejects(
  pluginProcessor.generateComponent('PluginFailure', '<svg/>'),
  error =>
    error.code === 'E_PLUGIN_HOOK_FAILED' &&
    error.cause === pluginCause &&
    !error.message.includes(pluginCause.message)
);

const integrationSvg = '<svg viewBox="0 0 24 24"><path d="M0 0h1v1z"/></svg>';
const vitePlugin = svgerVitePlugin({
  config: { framework: 'vue', typescript: true },
  typescript: false,
});
const viteResult = await vitePlugin.transform(integrationSvg, 'ViteIcon.svg');
assert.match(viteResult.code, /<script setup>/);
assert.doesNotMatch(viteResult.code, /<script setup lang="ts">/);

const rollupPlugin = svgerRollupPlugin({
  config: { framework: 'vue', typescript: true },
  typescript: false,
});
const rollupResult = await rollupPlugin.transform(
  integrationSvg,
  'RollupIcon.svg'
);
assert.match(rollupResult.code, /<script setup>/);
assert.doesNotMatch(rollupResult.code, /<script setup lang="ts">/);

const webpackOutput = await new Promise((resolve, reject) => {
  const loaderContext = {
    async: () => (error, result) => (error ? reject(error) : resolve(result)),
    getOptions: () => ({
      config: { framework: 'vue', typescript: true },
      typescript: false,
    }),
    hot: false,
    resourcePath: '/fixture/LoaderIcon.svg',
  };
  void svgerLoader.call(loaderContext, integrationSvg);
});
assert.match(webpackOutput, /<script setup>/);
assert.doesNotMatch(webpackOutput, /<script setup lang="ts">/);

const fixture = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-config-pipeline-')
);
try {
  const cliSource = path.join(fixture, 'cli-source');
  await fs.mkdir(cliSource);
  const cliPath = path.resolve('dist/cli.js');
  for (const format of ['pretty', 'json']) {
    const cliResult = spawnSync(
      process.execPath,
      [
        cliPath,
        'build',
        cliSource,
        path.join(fixture, `cli-output-${format}`),
        '--framework',
        `apiToken=${publicSecret}`,
        `--format=${format}`,
      ],
      { cwd: fixture, encoding: 'utf8' }
    );
    assert.equal(cliResult.status, ExitCode.InvalidConfiguration);
    assert.equal(
      `${cliResult.stdout}${cliResult.stderr}`.includes(publicSecret),
      false,
      `CLI ${format} diagnostics redact credentials`
    );
    assert.match(cliResult.stdout, /\[REDACTED\]/);
  }

  const source = path.join(fixture, 'source');
  await fs.mkdir(source);
  await fs.writeFile(
    path.join(source, 'Icon.svg'),
    '<svg viewBox="0 0 24 24"><path stroke-width="1.00000" d="M0.12345 0h1.00000v1z"/></svg>'
  );

  const compiler = await createSVGCompiler({ cwd: fixture });
  const explanation = compiler.config.explain({
    typescript: false,
    config: {
      framework: 'vue',
      frameworkOptions: { scriptSetup: true },
    },
    frameworkOptions: { scriptSetup: false },
  });
  assert.equal(
    explanation.find(entry => entry.path === 'typescript').value,
    false
  );
  assert.equal(
    explanation.find(entry => entry.path === 'frameworkOptions.scriptSetup')
      .value,
    false
  );

  const first = await compiler.build({
    src: source,
    out: path.join(fixture, 'first'),
    typescript: false,
    optimize: 'none',
    mode: 'write',
  });
  assert.equal(first.exitCode, 0, JSON.stringify(first.diagnostics));
  const firstComponent = await fs.readFile(
    path.join(fixture, 'first', 'Icon.jsx'),
    'utf8'
  );

  const repeated = await compiler.build({
    src: source,
    out: path.join(fixture, 'first'),
    typescript: false,
    optimize: 'none',
    mode: 'write',
  });
  assert.equal(repeated.exitCode, 0, JSON.stringify(repeated.diagnostics));
  assert.equal(
    await fs.readFile(path.join(fixture, 'first', 'Icon.jsx'), 'utf8'),
    firstComponent
  );
  assert.ok(repeated.diagnostics.some(item => item.code === 'I_CACHE_HIT'));

  const [noneReport, balancedReport] = await Promise.all([
    compiler.build({
      src: source,
      out: path.join(fixture, 'none'),
      typescript: false,
      optimize: 'none',
    }),
    compiler.build({
      src: source,
      out: path.join(fixture, 'balanced'),
      typescript: false,
      optimize: 'balanced',
    }),
  ]);
  assert.equal(noneReport.exitCode, 0, JSON.stringify(noneReport.diagnostics));
  assert.equal(
    balancedReport.exitCode,
    0,
    JSON.stringify(balancedReport.diagnostics)
  );
  assert.notEqual(
    await fs.readFile(path.join(fixture, 'none', 'Icon.jsx'), 'utf8'),
    await fs.readFile(path.join(fixture, 'balanced', 'Icon.jsx'), 'utf8'),
    'per-build optimization levels must not bleed across concurrent builds'
  );

  const invalid = await compiler.build({
    src: path.join(fixture, 'missing'),
    out: path.join(fixture, 'invalid'),
    config: { framework: 'unknown' },
  });
  assert.equal(invalid.diagnostics[0].code, 'E_INVALID_CONFIGURATION');

  // Inject a late failure into the canonical compiler service. The first item
  // completes generation in memory, but neither it nor the barrel may commit.
  const batchSource = path.join(fixture, 'compiler-batch-source');
  const batchOutput = path.join(fixture, 'compiler-batch-output');
  await fs.mkdir(batchSource);
  await fs.mkdir(batchOutput);
  await fs.writeFile(path.join(batchSource, '01-first.svg'), '<svg/>');
  await fs.writeFile(path.join(batchSource, '02-second.svg'), '<svg/>');
  await fs.writeFile(path.join(batchOutput, '01-first.tsx'), 'old component');
  await fs.writeFile(path.join(batchOutput, 'index.ts'), 'old barrel');
  await fs.writeFile(path.join(batchOutput, 'keep.txt'), 'unchanged');
  let compilerCalls = 0;
  const compilerCause = new Error(`optimizer apiToken=${publicSecret}`);
  const service = new SVGCompilerApplicationService({
    cwd: fixture,
    defaultConfig: defaults,
    configurationLayers: [],
    processor: {
      getFileExtension: () => 'tsx',
      generateComponentName: fileName => path.basename(fileName, '.svg'),
      generateFileName: (name, extension) => `${name}.${extension}`,
      generateComponent: async () => {
        compilerCalls += 1;
        if (compilerCalls === 2) {
          throw new DiagnosticError(
            'E_OPTIMIZER_STAGE_FAILED',
            'A late optimizer stage failed.',
            { exitCode: ExitCode.InternalError, cause: compilerCause }
          );
        }
        return 'new first component';
      },
    },
    logger: new NullLogger(),
    cache: new ContentAddressableCache(path.join(fixture, 'test-cache')),
    isLocked: () => false,
  });
  const compilerBatchReport = await service.build({
    src: batchSource,
    out: batchOutput,
    config: { cache: false },
    concurrency: 1,
    batchSize: 1,
  });
  assert.equal(compilerCalls, 2, 'failure occurs after earlier work completed');
  assert.equal(compilerBatchReport.status, 'failed');
  assert.equal(
    compilerBatchReport.diagnostics[0].code,
    'E_OPTIMIZER_STAGE_FAILED'
  );
  assert.deepEqual(
    Object.fromEntries(
      await Promise.all(
        ['01-first.tsx', 'index.ts', 'keep.txt'].map(async file => [
          file,
          await fs.readFile(path.join(batchOutput, file), 'utf8'),
        ])
      )
    ),
    {
      '01-first.tsx': 'old component',
      'index.ts': 'old barrel',
      'keep.txt': 'unchanged',
    }
  );
  assert.deepEqual(await fs.readdir(batchOutput), [
    '01-first.tsx',
    'index.ts',
    'keep.txt',
  ]);

  // Exercise the integration staging path with a real plugin-hook failure on
  // the second SVG after the first component has been written to private stage.
  const pluginRegistry = getPluginManager();
  const integrationSource = path.join(fixture, 'integration-batch-source');
  const integrationOutput = path.join(fixture, 'integration-batch-output');
  await fs.mkdir(integrationSource);
  await fs.mkdir(integrationOutput);
  await fs.writeFile(
    path.join(integrationSource, 'first.svg'),
    '<svg><title>first completed item</title></svg>'
  );
  await fs.writeFile(
    path.join(integrationSource, 'second.svg'),
    '<svg><title>second item</title></svg>'
  );
  await fs.writeFile(path.join(integrationOutput, 'First.tsx'), 'old output');
  await fs.writeFile(path.join(integrationOutput, 'keep.txt'), 'keep');
  let hookCalls = 0;
  const integrationCause = new Error(`backend apiToken=${publicSecret}`);
  pluginRegistry.registerPlugin({
    name: 'late-failure-redaction-fixture',
    version: '1.0.0',
    hooks: {
      'after-parse': async context => {
        hookCalls += 1;
        if (hookCalls === 2) throw integrationCause;
        return { content: context.content };
      },
    },
  });
  try {
    const batchPlugin = svgerVitePlugin({
      source: integrationSource,
      output: integrationOutput,
      generateIndex: true,
    });
    await assert.rejects(
      () => batchPlugin.buildStart(),
      error =>
        error.code === 'E_PLUGIN_HOOK_FAILED' &&
        error.cause === integrationCause &&
        !error.message.includes(publicSecret)
    );
  } finally {
    pluginRegistry.unregisterPlugin('late-failure-redaction-fixture');
  }
  assert.equal(hookCalls, 2);
  assert.deepEqual(await fs.readdir(integrationOutput), [
    'First.tsx',
    'keep.txt',
  ]);
  assert.equal(
    await fs.readFile(path.join(integrationOutput, 'First.tsx'), 'utf8'),
    'old output'
  );
  assert.equal(
    (await fs.readdir(fixture)).some(name =>
      name.startsWith('.svger-build-stage-')
    ),
    false,
    'temporary integration stage is cleaned after failure'
  );
  assert.equal(
    (await fs.readdir(fixture)).some(name =>
      name.startsWith('.svger-transaction-')
    ),
    false,
    'no transaction journal is left when generation fails before commit'
  );

  const legacySource = path.join(fixture, 'legacy-source');
  const legacyOutput = path.join(fixture, 'legacy-output');
  await fs.mkdir(legacySource);
  await fs.writeFile(path.join(legacySource, 'a-good.svg'), '<svg/>');
  await fs.writeFile(
    path.join(legacySource, 'z-bad.svg'),
    '<svg><script>unsafe()</script></svg>'
  );
  await assert.rejects(
    () =>
      SVGService.getInstance().buildAll({
        src: legacySource,
        out: legacyOutput,
        config: { unsafeInputPolicy: 'reject' },
      }),
    error => error.code === 'E_UNSAFE_SVG_CONTENT'
  );
  await assert.rejects(
    fs.access(legacyOutput),
    error => error.code === 'ENOENT'
  );
} finally {
  await fs.rm(fixture, { recursive: true, force: true });
}

// eslint-disable-next-line no-console
console.log(
  'Configuration, failure propagation, and deterministic pipeline contracts passed.'
);
