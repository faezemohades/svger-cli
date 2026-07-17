import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const baselineRoot = path.join(repositoryRoot, 'baselines', 'v4.0.x');
const lockPath = path.join(baselineRoot, 'baseline.lock.json');

try {
  await readFile(lockPath, 'utf8');
  throw new Error('The v4.0.x baseline is sealed and cannot be regenerated.');
} catch (error) {
  if (error instanceof Error && !error.message.includes('ENOENT')) {
    throw error;
  }
}

const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
);
if (packageJson.version !== '4.0.8') {
  throw new Error(`Expected v4.0.8, received v${packageJson.version}.`);
}

const api = await import(path.join(repositoryRoot, 'dist', 'index.js'));
const { buildAll } = await import(
  path.join(repositoryRoot, 'dist', 'builder.js')
);
const { svgService } = await import(
  path.join(repositoryRoot, 'dist', 'services', 'svg-service.js')
);
const { configService } = await import(
  path.join(repositoryRoot, 'dist', 'services', 'config.js')
);

const workRoot = await mkdtemp(path.join(tmpdir(), 'svger-v4-baseline-'));
const legacyOutput = path.join(workRoot, 'legacy');
const serviceOutput = path.join(workRoot, 'service');
const fixtureRoot = path.join(baselineRoot, 'fixtures');
await mkdir(legacyOutput, { recursive: true });
await mkdir(serviceOutput, { recursive: true });

const captureConsole = async operation => {
  const entries = [];
  const originals = {};
  for (const level of ['log', 'info', 'warn', 'error']) {
    originals[level] = console[level];
    console[level] = (...values) => {
      entries.push({ level, message: values.map(String).join(' ') });
    };
  }
  try {
    await operation();
  } finally {
    Object.assign(console, originals);
  }
  return entries;
};

const resolvedConfig = configService.readConfig();
const legacyDiagnostics = await captureConsole(() =>
  buildAll({ src: fixtureRoot, out: legacyOutput })
);
const serviceDiagnostics = await captureConsole(() =>
  svgService.buildAll({
    src: fixtureRoot,
    out: serviceOutput,
    config: resolvedConfig,
  })
);

const copyRecordedOutputs = async (sourceRoot, destinationRoot) => {
  await mkdir(destinationRoot, { recursive: true });
  for (const name of (await readdir(sourceRoot)).sort()) {
    await writeFile(
      path.join(destinationRoot, name),
      await readFile(path.join(sourceRoot, name))
    );
  }
};

await copyRecordedOutputs(
  legacyOutput,
  path.join(baselineRoot, 'outputs', 'legacy-builder')
);
await copyRecordedOutputs(
  serviceOutput,
  path.join(baselineRoot, 'outputs', 'svg-service')
);

const commandNames = [
  'build',
  'watch',
  'generate',
  'lock',
  'unlock',
  'config',
  'plugins',
  'optimize',
  'clean',
];
const invokeCLI = args => {
  const result = spawnSync(
    'node',
    [path.join(repositoryRoot, 'bin', 'svg-tool.js'), ...args],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    }
  );
  return {
    args,
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};
const cliBehavior = {
  schemaVersion: 1,
  packageVersion: packageJson.version,
  rootHelp: invokeCLI(['--help']),
  version: invokeCLI(['--version']),
  commands: Object.fromEntries(
    commandNames.map(command => [command, invokeCLI([command, '--help'])])
  ),
  unknownCommand: invokeCLI(['not-a-command']),
  missingBuildArguments: invokeCLI(['build']),
};
await writeFile(
  path.join(baselineRoot, 'cli-behavior.json'),
  `${JSON.stringify(cliBehavior, null, 2)}\n`
);

const integrationSpecifiers = {
  webpack: './dist/integrations/webpack.js',
  vite: './dist/integrations/vite.js',
  rollup: './dist/integrations/rollup.js',
  babel: './dist/integrations/babel.js',
  nextjs: './dist/integrations/nextjs.js',
  jest: './dist/integrations/jest-preset.js',
};
const integrationExports = {};
for (const [name, specifier] of Object.entries(integrationSpecifiers)) {
  const module = await import(path.join(repositoryRoot, specifier));
  integrationExports[name] = Object.keys(module).sort();
}
await writeFile(
  path.join(baselineRoot, 'public-api.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      packageVersion: packageJson.version,
      rootExports: Object.keys(api).sort(),
      integrationExports,
      packageExports: packageJson.exports,
    },
    null,
    2
  )}\n`
);

await writeFile(
  path.join(baselineRoot, 'resolved-config.json'),
  `${JSON.stringify(resolvedConfig, null, 2)}\n`
);

const inferSchema = value => {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? inferSchema(value[0]) : {},
    };
  }
  if (value !== null && typeof value === 'object') {
    const properties = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, inferSchema(child)])
    );
    return {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: true,
    };
  }
  return { type: value === null ? 'null' : typeof value };
};
await writeFile(
  path.join(baselineRoot, 'config-schema.json'),
  `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://svger.dev/baselines/v4.0.x/config.schema.json',
      title: 'Resolved SVGER v4.0.x configuration',
      ...inferSchema(resolvedConfig),
    },
    null,
    2
  )}\n`
);

const fixtureContents = await Promise.all(
  (await readdir(fixtureRoot)).sort().map(async name => ({
    name,
    content: await readFile(path.join(fixtureRoot, name), 'utf8'),
  }))
);
const samples = [];
for (let iteration = 0; iteration < 10; iteration += 1) {
  const startedAt = performance.now();
  for (const fixture of fixtureContents) {
    await api.svgProcessor.generateComponent(
      api.svgProcessor.generateComponentName(fixture.name),
      fixture.content,
      { framework: 'react', typescript: true }
    );
  }
  samples.push(Number((performance.now() - startedAt).toFixed(3)));
}
const sortedSamples = [...samples].sort((left, right) => left - right);
await writeFile(
  path.join(baselineRoot, 'performance-trace.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      packageVersion: packageJson.version,
      corpus: fixtureContents.map(({ name, content }) => ({
        name,
        bytes: Buffer.byteLength(content),
      })),
      iterations: samples.length,
      samplesMs: samples,
      medianMs: sortedSamples[Math.floor(sortedSamples.length / 2)],
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: process.memoryUsage(),
    },
    null,
    2
  )}\n`
);

await writeFile(
  path.join(baselineRoot, 'dual-path-observations.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      packageVersion: packageJson.version,
      legacyBuilder: { diagnostics: legacyDiagnostics },
      svgService: { diagnostics: serviceDiagnostics },
    },
    null,
    2
  )}\n`
);

const walk = async directory => {
  const paths = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(absolutePath)));
    else if (absolutePath !== lockPath) paths.push(absolutePath);
  }
  return paths;
};
const hashes = {};
for (const filePath of await walk(baselineRoot)) {
  hashes[path.relative(baselineRoot, filePath)] = createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}
await writeFile(
  lockPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      packageVersion: packageJson.version,
      sourceCommit: '0d48aff',
      files: hashes,
    },
    null,
    2
  )}\n`
);

await rm(workRoot, { recursive: true, force: true });
process.exit(0);
