#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile, VERSION as SVELTE_VERSION } from 'svelte/compiler';
import { analyzeSvelteArtifact } from '../experiments/phase3/svelte-artifact-oracle.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPORT_SCHEMA = 'svger-local-evaluation-v2';
const DIMENSIONS = [
  'text',
  'namespaces',
  'attributes',
  'references',
  'accessibility',
  'geometry',
];
const SECURITY_CHECKS = [
  'tests/phase0/svg-security-corpus.test.mjs',
  'tests/phase0/security-containment.test.mjs',
  'tests/phase0/entrypoint-safety-matrix.test.mjs',
  'tests/phase0/recovery-transaction-hardening.test.mjs',
];

function fail(message) {
  throw new Error(message);
}

function positiveInteger(value, name, maximum) {
  if (!/^\d+$/u.test(value)) fail(`${name} must be a positive integer.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum)
    fail(`${name} must be between 1 and ${maximum}.`);
  return number;
}

export function parseArguments(argv) {
  const options = {
    groups: [50, 750],
    warmups: 8,
    samples: 40,
    beforeBuild: null,
    afterBuild: null,
    output: null,
    overwrite: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--overwrite') {
      options.overwrite = true;
      continue;
    }
    const names = new Map([
      ['--groups', 'groups'],
      ['--warmups', 'warmups'],
      ['--samples', 'samples'],
      ['--before-build', 'beforeBuild'],
      ['--after-build', 'afterBuild'],
      ['--output', 'output'],
    ]);
    const name = names.get(arg);
    if (!name) fail(`Unknown option: ${arg}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`Missing value for ${arg}.`);
    if (name === 'groups') {
      options.groups = value
        .split(',')
        .map(item => positiveInteger(item, '--groups value', 5_000));
      if (new Set(options.groups).size !== options.groups.length)
        fail('--groups values must be unique.');
      options.groups.sort((left, right) => left - right);
    } else if (name === 'warmups') {
      options.warmups = positiveInteger(value, '--warmups', 100);
    } else if (name === 'samples') {
      options.samples = positiveInteger(value, '--samples', 500);
    } else if (name === 'output') {
      options.output = path.resolve(value);
    } else {
      options[name] = path.resolve(value);
    }
  }
  if (Boolean(options.beforeBuild) !== Boolean(options.afterBuild))
    fail('--before-build and --after-build must be supplied together.');
  if (options.beforeBuild && options.afterBuild) {
    if (options.beforeBuild === options.afterBuild)
      fail('Before and after builds must be different directories.');
  }
  return options;
}

export function makeFixture(groups) {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 16">${Array.from(
    { length: groups },
    (_, index) =>
      `<g id="g${index}"><path d="M${index} 0h8v8z" fill="currentColor"/><text x="${index}" y="8">Icon ${index}</text></g>`
  ).join('')}</svg>`;
  return {
    groups,
    source,
    utf8Bytes: Buffer.byteLength(source),
    elementCount: groups * 3 + 1,
    sha256: createHash('sha256').update(source).digest('hex'),
  };
}

export function summarize(values) {
  if (!Array.isArray(values) || values.length === 0)
    fail('Cannot summarize an empty sample set.');
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = fraction =>
    sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[(sorted.length - 1) / 2];
  return {
    sampleCount: sorted.length,
    medianMs: Number(median.toFixed(3)),
    p95Ms: Number(percentile(0.95).toFixed(3)),
    minMs: Number(sorted[0].toFixed(3)),
    maxMs: Number(sorted.at(-1).toFixed(3)),
    throughputPerSecond: Number((1000 / median).toFixed(2)),
  };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function hashDirectory(directory) {
  const hash = createHash('sha256');
  let totalBytes = 0;
  async function visit(current, relative = '') {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await visit(entryPath, name);
      else if (entry.isFile()) {
        const bytes = await readFile(entryPath);
        totalBytes += bytes.length;
        hash.update(name).update('\0').update(digest(bytes)).update('\n');
      } else {
        fail(`Build contains a non-regular object: ${name}`);
      }
    }
  }
  await visit(directory);
  return { sha256: hash.digest('hex'), bytes: totalBytes };
}

function childResult(command, args, cwd) {
  const start = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CI: '1', NO_COLOR: '1' },
  });
  return {
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    durationMs: Number((performance.now() - start).toFixed(3)),
    outputSha256: digest(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
    spawnError: result.error?.code ?? null,
  };
}

function npmVersion() {
  const npmCli = process.env.npm_execpath;
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, '--version'], {
        encoding: 'utf8',
        timeout: 5_000,
        env: process.env,
      })
    : spawnSync('npm', ['--version'], {
        encoding: 'utf8',
        timeout: 5_000,
        env: process.env,
      });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function gitEvidence() {
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });
  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });
  return {
    head: revision.status === 0 ? revision.stdout.trim() : null,
    workingTreeClean: status.status === 0 && status.stdout.length === 0,
  };
}

async function loadBuild(buildId, rootPath) {
  const root = path.resolve(rootPath);
  const packagePath = path.join(root, 'package.json');
  const distPath = path.join(root, 'dist');
  const entryPath = path.join(distPath, 'index.js');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const dist = await hashDirectory(distPath);
  const module = await import(pathToFileURL(entryPath).href);
  if (
    typeof module.SVGProcessor !== 'function' ||
    typeof module.NullLogger !== 'function'
  )
    fail(`${buildId} build does not expose the expected public processor API.`);
  return {
    id: buildId,
    root,
    packageVersion: packageJson.version,
    dist,
    module,
    processor: new module.SVGProcessor({ logger: new module.NullLogger() }),
  };
}

async function generate(build, fixture, mode) {
  return build.processor.generateComponent('EvaluationIcon', fixture.source, {
    framework: 'svelte',
    typescript: false,
    optimizationLevel: 'none',
    ...(mode === 'ir-v1' ? { svelteCompiler: 'ir-v1' } : {}),
  });
}

async function benchmarkMode(build, fixture, options, mode) {
  const timings = [];
  let output = '';
  try {
    for (let index = 0; index < options.warmups; index++)
      output = await generate(build, fixture, mode);
    const memoryBefore = process.memoryUsage();
    for (let index = 0; index < options.samples; index++) {
      const start = performance.now();
      output = await generate(build, fixture, mode);
      timings.push(performance.now() - start);
    }
    const memoryAfter = process.memoryUsage();
    return {
      status: 'measured',
      ...summarize(timings),
      outputBytes: Buffer.byteLength(output),
      outputSha256: digest(output),
      memoryObservation: {
        method:
          'process.memoryUsage snapshots around sample batch; no forced GC or threshold',
        rssBeforeBytes: memoryBefore.rss,
        rssAfterBytes: memoryAfter.rss,
        heapDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
      },
    };
  } catch (error) {
    return {
      status: 'unsupported-or-failed',
      diagnosticCode:
        typeof error?.code === 'string' &&
        /^E_[A-Z0-9_]{1,80}$/u.test(error.code)
          ? error.code
          : 'E_EVALUATION_MODE_FAILED',
    };
  }
}

function modeComparison(modes) {
  const legacy = modes.legacy;
  const ir = modes['ir-v1'];
  if (legacy?.status !== 'measured' || ir?.status !== 'measured')
    return { status: 'unavailable' };
  return {
    status: 'measured',
    irMedianRelativeToLegacy: Number(
      (ir.medianMs / legacy.medianMs).toFixed(3)
    ),
    irMedianReductionVsLegacyPercent: Number(
      (((legacy.medianMs - ir.medianMs) / legacy.medianMs) * 100).toFixed(2)
    ),
    note: 'Fixture- and host-specific; descriptive only.',
  };
}

function projectionComparison(source, artifact) {
  const result = {};
  for (const dimension of DIMENSIONS) {
    const complete =
      source?.coverage?.[dimension] === 'complete' &&
      artifact?.coverage?.[dimension] === 'complete' &&
      source?.validity?.status === 'valid' &&
      artifact?.validity?.status === 'valid' &&
      source?.projection &&
      artifact?.projection;
    if (!complete) {
      result[dimension] = 'unresolved-or-partial';
      continue;
    }
    result[dimension] =
      JSON.stringify(source.projection[dimension]) ===
      JSON.stringify(artifact.projection[dimension])
        ? 'match'
        : 'mismatch';
  }
  return result;
}

async function qualityEvaluation(build, fixture, outputs) {
  const generated = {};
  const checks = [];
  const semanticChecks = [];
  const sourceProjection = analyzeSvelteArtifact({
    path: 'source.svg',
    content: fixture.source,
  });
  for (const [mode, output] of Object.entries(outputs)) {
    if (!output) {
      generated[mode] = {
        status: 'failed',
        diagnosticCode: 'E_EVALUATION_MODE_UNAVAILABLE',
      };
      checks.push('failed');
      semanticChecks.push('failed');
      continue;
    }
    let compileStatus = 'passed';
    try {
      compile(output, {
        filename: `EvaluationIcon.${mode}.svelte`,
        generate: 'dom',
      });
    } catch {
      compileStatus = 'failed';
    }
    let repeatedOutput = null;
    try {
      repeatedOutput = await generate(build, fixture, mode);
    } catch {
      // A repeat failure is captured below as a deterministic-generation failure.
    }
    const deterministic = repeatedOutput === output;
    const artifactProjection = analyzeSvelteArtifact({
      path: `EvaluationIcon.${mode}.svelte`,
      content: output,
    });
    const semanticComparison = projectionComparison(
      sourceProjection,
      artifactProjection
    );
    const semanticMismatch =
      Object.values(semanticComparison).includes('mismatch');
    const status =
      compileStatus === 'passed' && deterministic && !semanticMismatch
        ? 'passed'
        : 'failed';
    const semanticStatus = semanticMismatch
      ? 'failed'
      : Object.values(semanticComparison).includes('unresolved-or-partial')
        ? 'partial'
        : 'complete';
    generated[mode] = {
      status,
      frameworkCompile: {
        status: compileStatus,
        compiler: 'svelte/compiler',
        version: SVELTE_VERSION,
      },
      deterministic,
      semanticComparison: {
        status: semanticStatus,
        sourceCoverage: sourceProjection.coverageStatus,
        artifactCoverage: artifactProjection.coverageStatus,
        dimensions: semanticComparison,
        note: 'Partial oracle projections are reported unresolved, never counted as matches.',
      },
    };
    checks.push(status);
    semanticChecks.push(semanticStatus);
  }

  const npmPath = process.env.npm_execpath;
  const npmCommand = npmPath
    ? [process.execPath, npmPath, 'run', 'test:phase4']
    : ['npm', 'run', 'test:phase4'];
  const compatibility = childResult(
    npmCommand[0],
    npmCommand.slice(1),
    REPOSITORY_ROOT
  );
  return {
    status:
      checks.length > 0 &&
      checks.every(item => item === 'passed') &&
      compatibility.exitCode === 0
        ? 'passed'
        : 'failed',
    semanticStatus: semanticChecks.includes('failed')
      ? 'failed'
      : semanticChecks.includes('partial')
        ? 'partial'
        : semanticChecks.length > 0
          ? 'complete'
          : 'failed',
    frameworkOutputs: generated,
    compatibilitySuite: {
      command: 'npm run test:phase4',
      ...compatibility,
    },
  };
}

function securityEvaluation() {
  const checks = SECURITY_CHECKS.map(script => ({
    script,
    ...childResult(process.execPath, [script], REPOSITORY_ROOT),
  }));
  return {
    status: checks.every(check => check.exitCode === 0) ? 'passed' : 'failed',
    policy:
      'pass/fail for the listed non-destructive regression suites only; not comprehensive security certification; no security score is computed',
    checks,
  };
}

function compareBuilds(buildRecords, groupResults) {
  const comparisons = [];
  for (const groupResult of groupResults) {
    for (const [buildId, modes] of Object.entries(groupResult.builds)) {
      comparisons.push({
        kind: 'legacy-vs-ir-v1',
        buildId,
        groups: groupResult.groups,
        ...modeComparison(modes),
      });
    }
    if (buildRecords.before && buildRecords.after) {
      for (const mode of ['legacy', 'ir-v1']) {
        const before = groupResult.builds.before[mode];
        const after = groupResult.builds.after[mode];
        comparisons.push({
          kind: 'before-vs-after',
          mode,
          groups: groupResult.groups,
          status:
            before?.status === 'measured' && after?.status === 'measured'
              ? 'measured'
              : 'unavailable',
          ...(before?.status === 'measured' && after?.status === 'measured'
            ? {
                beforeMedianMs: before.medianMs,
                afterMedianMs: after.medianMs,
                relativeChangePercent: Number(
                  (
                    ((after.medianMs - before.medianMs) / before.medianMs) *
                    100
                  ).toFixed(2)
                ),
              }
            : {}),
        });
      }
    }
  }
  return comparisons;
}

function performanceStatus(buildRecords, groupResults) {
  const required = [];
  for (const result of groupResults) {
    if (buildRecords.current) {
      required.push(
        result.builds.current.legacy,
        result.builds.current['ir-v1']
      );
    } else {
      required.push(
        result.builds.before.legacy,
        result.builds.after.legacy,
        result.builds.after['ir-v1']
      );
    }
  }
  return {
    status:
      required.length > 0 && required.every(item => item?.status === 'measured')
        ? 'passed'
        : 'failed',
    requiredMeasurements: required.length,
    note: 'Timing thresholds are informational; failed required modes fail the evaluation.',
  };
}

function helpText() {
  return `SVGER local evaluation (opt-in; no upload or telemetry)

Options:
  --groups <n[,n...]>         Fixture group counts (default: 50,750; max: 5000 each)
  --warmups <n>               Warm-ups per mode and fixture (default: 8; max: 100)
  --samples <n>               Timed samples per mode and fixture (default: 40; max: 500)
  --before-build <directory>  Local package root containing dist/index.js
  --after-build <directory>   Second local package root; requires --before-build
  --output <file>             Export the versioned JSON report
  --overwrite                 Allow replacing an existing report file
  --help                      Show this help

Build with npm run build first. Local builds are imported and executed, so only use trusted builds.
The command also runs Svelte compatibility tests and non-destructive security regression suites.
`;
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(helpText());
    return 0;
  }
  const packageJson = JSON.parse(
    await readFile(path.join(REPOSITORY_ROOT, 'package.json'), 'utf8')
  );
  const buildRecords = {};
  if (options.beforeBuild) {
    buildRecords.before = await loadBuild('before', options.beforeBuild);
    buildRecords.after = await loadBuild('after', options.afterBuild);
  } else {
    buildRecords.current = await loadBuild('current', REPOSITORY_ROOT);
  }

  const groupResults = [];
  for (const groups of options.groups) {
    const fixture = makeFixture(groups);
    const builds = {};
    const outputsForQuality = {};
    const buildList = Object.values(buildRecords);
    for (const build of buildList) {
      const modes = {};
      for (const mode of ['legacy', 'ir-v1'])
        modes[mode] = await benchmarkMode(build, fixture, options, mode);
      builds[build.id] = modes;
      if (groups === Math.max(...options.groups) && build.id === 'current') {
        for (const mode of ['legacy', 'ir-v1']) {
          try {
            outputsForQuality[mode] = await generate(build, fixture, mode);
          } catch {
            outputsForQuality[mode] = null;
          }
        }
      }
    }
    groupResults.push({
      groups,
      fixture: {
        id: `synthetic-svg-${fixture.sha256.slice(0, 16)}`,
        sha256: fixture.sha256,
        utf8Bytes: fixture.utf8Bytes,
        elementCount: fixture.elementCount,
      },
      buildIds: buildList.map(build => build.id),
      builds,
    });
  }

  let quality = { status: 'not-run' };
  const qualityBuild = buildRecords.current ?? buildRecords.after ?? null;
  if (qualityBuild) {
    const largest = makeFixture(Math.max(...options.groups));
    const qualityOutputs = {};
    for (const mode of ['legacy', 'ir-v1']) {
      const result = groupResults.at(-1).builds[qualityBuild.id][mode];
      qualityOutputs[mode] =
        result.status === 'measured'
          ? await awaitOutput(qualityBuild, largest, mode)
          : null;
    }
    quality = await qualityEvaluation(qualityBuild, largest, qualityOutputs);
  }
  const security = securityEvaluation();
  const performance = performanceStatus(buildRecords, groupResults);
  const git = await gitEvidence();
  const report = {
    schemaVersion: REPORT_SCHEMA,
    createdAt: new Date().toISOString(),
    package: { name: packageJson.name, version: packageJson.version },
    source: git,
    environment: {
      node: process.version,
      npm: npmVersion(),
      platform: process.platform,
      release: os.release(),
      architecture: process.arch,
      cpuModel: os.cpus()[0]?.model ?? null,
      cpuCount: os.cpus().length,
      svelteCompiler: SVELTE_VERSION,
    },
    settings: {
      fixtureGroups: options.groups,
      warmupsPerMode: options.warmups,
      samplesPerMode: options.samples,
      optimization: 'none',
      compilerModes: ['legacy', 'ir-v1'],
      timingThreshold: 'informational-only',
      memoryMethod:
        'before/after process snapshots; no forced GC or pass/fail threshold',
    },
    builds: Object.fromEntries(
      Object.values(buildRecords).map(build => [
        build.id,
        {
          packageVersion: build.packageVersion,
          distSha256: build.dist.sha256,
          distBytes: build.dist.bytes,
        },
      ])
    ),
    performance: groupResults,
    performanceStatus: performance,
    comparisons: compareBuilds(buildRecords, groupResults),
    quality,
    security,
    overallStatus:
      quality.status !== 'passed' ||
      security.status === 'failed' ||
      performance.status !== 'passed'
        ? 'failed'
        : 'passed',
    limitations: [
      'Synthetic local workload; does not represent all SVG inputs or operating systems.',
      'Memory values are process snapshots, not peak memory or a resource budget.',
      'Semantic comparison reports partial oracle dimensions as unresolved, not as matches.',
      'Security section is a regression pass/fail summary, not a security score or certification.',
      'No data is uploaded; results are written only when --output is supplied.',
    ],
  };

  if (options.output) {
    await mkdir(path.dirname(options.output), { recursive: true });
    try {
      await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, {
        encoding: 'utf8',
        flag: options.overwrite ? 'w' : 'wx',
      });
    } catch (error) {
      if (error?.code === 'EEXIST')
        fail('Report already exists; pass --overwrite to replace it.');
      throw error;
    }
    process.stdout.write(
      `Evaluation ${report.overallStatus}; JSON report written to ${options.output}\n`
    );
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
  return report.overallStatus === 'passed' ? 0 : 1;
}

async function awaitOutput(build, fixture, mode) {
  try {
    return await generate(build, fixture, mode);
  } catch {
    return null;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Evaluation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
