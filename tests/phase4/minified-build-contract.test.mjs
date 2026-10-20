import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const fixtureRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-minified-build-contract-')
);
const tscPath = path.join(
  repositoryRoot,
  'node_modules',
  'typescript',
  'bin',
  'tsc'
);
const minifierPath = path.join(
  repositoryRoot,
  'scripts',
  'minify-internal-production.mjs'
);
const modulesToCompare = [
  'compiler/ir-v1.js',
  'compiler/lower-svg-document-to-ir.js',
  'compiler/svelte-ir-emitter.js',
  'security/input-safety.js',
  'security/svg-xml-safety.js',
  'processors/svg-processor.js',
  'utils/visual-diff.js',
];

async function compileTo(destination) {
  const distRoot = path.join(destination, 'dist');
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(
    path.join(destination, 'package.json'),
    JSON.stringify({ name: 'svger-cli', version: '4.0.9', type: 'module' })
  );
  execFileSync(
    process.execPath,
    [
      tscPath,
      '-p',
      path.join(repositoryRoot, 'tsconfig.json'),
      '--outDir',
      distRoot,
    ],
    { cwd: repositoryRoot, stdio: 'pipe' }
  );
  await fs.symlink(
    path.join(repositoryRoot, 'node_modules'),
    path.join(destination, 'node_modules'),
    'junction'
  );
}

async function minifyAt(destination) {
  execFileSync(
    process.execPath,
    [minifierPath, '--dist-root', path.join(destination, 'dist')],
    { cwd: repositoryRoot, stdio: 'pipe' }
  );
}

async function runBuild(distribution, fixtureName, source, request) {
  const projectRoot = path.join(
    fixtureRoot,
    `${path.basename(distribution)}-${fixtureName}`
  );
  const sourceDirectory = path.join(projectRoot, 'icons');
  const outputDirectory = path.join(projectRoot, 'components');
  await fs.mkdir(sourceDirectory, { recursive: true });
  await fs.writeFile(path.join(sourceDirectory, 'icon.svg'), source);
  const { createSVGCompiler } = await import(
    pathToFileURL(path.join(distribution, 'dist', 'index.js')).href
  );
  const compiler = await createSVGCompiler({ cwd: projectRoot });
  const report = await compiler.build({
    src: sourceDirectory,
    out: outputDirectory,
    optimize: 'none',
    mode: 'write',
    ...request,
  });
  const files = await fs.readdir(outputDirectory).catch(() => []);
  const artifacts = await Promise.all(
    files
      .filter(file => file !== 'index.ts' && file !== 'index.js')
      .sort()
      .map(async file => [
        file,
        await fs.readFile(path.join(outputDirectory, file), 'utf8'),
      ])
  );
  return {
    status: report.status,
    diagnostics: report.diagnostics.map(item => ({
      code: item.code,
      severity: item.severity,
    })),
    artifacts,
  };
}

try {
  const original = path.join(fixtureRoot, 'original');
  const seed = path.join(fixtureRoot, 'seed');
  const minifiedOne = path.join(fixtureRoot, 'minified-one');
  const minifiedTwo = path.join(fixtureRoot, 'minified-two');
  await compileTo(original);
  await compileTo(seed);
  await fs.cp(seed, minifiedOne, { recursive: true });
  await fs.cp(seed, minifiedTwo, { recursive: true });
  await minifyAt(minifiedOne);
  await minifyAt(minifiedTwo);

  for (const relativeFile of modulesToCompare) {
    assert.equal(
      await fs.readFile(path.join(minifiedOne, 'dist', relativeFile), 'utf8'),
      await fs.readFile(path.join(minifiedTwo, 'dist', relativeFile), 'utf8'),
      `${relativeFile} must be byte-deterministic for identical compiler input`
    );
  }

  const scenarios = [
    {
      name: 'svelte-legacy-js',
      source:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8z"/></svg>',
      request: { framework: 'svelte', typescript: false },
    },
    {
      name: 'svelte-ir-js',
      source:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" role="img" aria-label="Icon"><title>Icon</title><path d="M0 0h8v8z"/></svg>',
      request: {
        framework: 'svelte',
        typescript: false,
        svelteCompiler: 'ir-v1',
      },
    },
    {
      name: 'svelte-ir-ts',
      source:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" role="img" aria-label="Icon"><title>Icon</title><path d="M0 0h8v8z"/></svg>',
      request: {
        framework: 'svelte',
        typescript: true,
        svelteCompiler: 'ir-v1',
      },
    },
    {
      name: 'unsupported-ir',
      source: '<svg><marker id="unsupported"/></svg>',
      request: {
        framework: 'svelte',
        typescript: false,
        svelteCompiler: 'ir-v1',
      },
    },
  ];

  for (const scenario of scenarios) {
    assert.deepEqual(
      await runBuild(
        original,
        scenario.name,
        scenario.source,
        scenario.request
      ),
      await runBuild(
        minifiedOne,
        scenario.name,
        scenario.source,
        scenario.request
      ),
      `${scenario.name}: minification must preserve public compiler behavior`
    );
  }

  const invalidRoot = path.join(fixtureRoot, 'invalid-dist');
  const invalidDistribution = path.join(invalidRoot, 'dist');
  const invalidModule = path.join(invalidDistribution, 'compiler', 'ir-v1.js');
  await fs.mkdir(path.dirname(invalidModule), { recursive: true });
  await fs.writeFile(invalidModule, 'export const = ;\n');
  const failedMinification = spawnSync(
    process.execPath,
    [minifierPath, '--dist-root', invalidDistribution],
    { cwd: repositoryRoot, encoding: 'utf8' }
  );
  assert.notEqual(failedMinification.status, 0);
  assert.match(failedMinification.stderr, /error|unexpected|syntax/iu);
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
  );
  assert.match(
    packageJson.scripts.build,
    /&& node scripts\/minify-internal-production\.mjs/u,
    'a minification failure must fail the build chain'
  );

  const minifiedProcessor = await fs.readFile(
    path.join(minifiedOne, 'dist/processors/svg-processor.js'),
    'utf8'
  );
  assert.match(minifiedProcessor, /generateComponent/u);
  assert.ok(
    minifiedProcessor.split('\n').every(line => line.length <= 180),
    'generated stack locations remain spread over bounded, readable lines'
  );
  assert.deepEqual(
    (await fs.readdir(path.join(minifiedOne, 'dist/processors'))).filter(name =>
      name.endsWith('.map')
    ),
    [],
    'the build must not create source-map references that are absent from the package'
  );
  const { emitSvelteIRComponent } = await import(
    pathToFileURL(path.join(minifiedOne, 'dist/compiler/svelte-ir-emitter.js'))
      .href
  );
  assert.throws(
    () => emitSvelteIRComponent(null, 'Icon', false),
    error =>
      error?.code === 'E_SVELTE_IR_INVALID' &&
      /at fail \(file:.*svelte-ir-emitter\.js:\d+:\d+\)/u.test(error.stack),
    'minified stack traces preserve function names and usable file/line/column locations'
  );
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

console.log(
  'Minifier failure, deterministic output, and public runtime parity contracts passed.'
);
