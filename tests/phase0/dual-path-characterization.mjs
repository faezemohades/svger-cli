import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAll } from '../../dist/builder.js';
import { configService } from '../../dist/services/config.js';
import { svgService } from '../../dist/services/svg-service.js';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const fixtures = path.join(repositoryRoot, 'baselines', 'v4.0.x', 'fixtures');
const workRoot = await mkdtemp(path.join(tmpdir(), 'svger-dual-path-'));
const legacyOutput = path.join(workRoot, 'legacy');
const serviceOutput = path.join(workRoot, 'service');
await mkdir(legacyOutput);
await mkdir(serviceOutput);

const normalize = value =>
  value
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[TIMESTAMP]')
    .replaceAll(workRoot, '[WORK_ROOT]');

const capture = async operation => {
  const diagnostics = [];
  const originalWrite = {
    stdout: process.stdout.write,
    stderr: process.stderr.write,
  };
  process.stdout.write = (chunk, ...args) => {
    diagnostics.push({ stream: 'stdout', message: normalize(String(chunk)) });
    return true;
  };
  process.stderr.write = (chunk, ...args) => {
    diagnostics.push({ stream: 'stderr', message: normalize(String(chunk)) });
    return true;
  };
  try {
    await operation();
    return { status: 'resolved', diagnostics };
  } catch (error) {
    return {
      status: 'rejected',
      error: error instanceof Error ? normalize(error.message) : String(error),
      diagnostics,
    };
  } finally {
    process.stdout.write = originalWrite.stdout;
    process.stderr.write = originalWrite.stderr;
  }
};

const readArtifacts = async directory => {
  const artifacts = {};
  for (const name of (await readdir(directory)).sort()) {
    const content = await readFile(path.join(directory, name), 'utf8');
    artifacts[name] = {
      bytes: Buffer.byteLength(content),
      sha256: createHash('sha256').update(content).digest('hex'),
      content,
    };
  }
  return artifacts;
};

const resolvedConfig = configService.readConfig();
const legacyExecution = await capture(() =>
  buildAll({ src: fixtures, out: legacyOutput })
);
const serviceExecution = await capture(() =>
  svgService.buildAll({
    src: fixtures,
    out: serviceOutput,
    config: resolvedConfig,
  })
);
const legacyArtifacts = await readArtifacts(legacyOutput);
const serviceArtifacts = await readArtifacts(serviceOutput);
const sharedNames = Object.keys(legacyArtifacts).filter(
  name => serviceArtifacts[name]
);

const report = {
  schemaVersion: 1,
  baselineVersion: '4.0.8',
  fixtureNames: (await readdir(fixtures)).sort(),
  paths: {
    legacyBuilder: {
      execution: legacyExecution,
      generatedFileNames: Object.keys(legacyArtifacts),
      artifacts: legacyArtifacts,
    },
    svgService: {
      execution: serviceExecution,
      generatedFileNames: Object.keys(serviceArtifacts),
      artifacts: serviceArtifacts,
    },
  },
  diff: {
    outputContent: sharedNames.map(name => ({
      name,
      equal: legacyArtifacts[name].content === serviceArtifacts[name].content,
      legacySha256: legacyArtifacts[name].sha256,
      serviceSha256: serviceArtifacts[name].sha256,
    })),
    diagnosticsEqual:
      JSON.stringify(legacyExecution.diagnostics) ===
      JSON.stringify(serviceExecution.diagnostics),
    exitSemanticsEqual: legacyExecution.status === serviceExecution.status,
    generatedFileNaming: {
      shared: sharedNames,
      legacyOnly: Object.keys(legacyArtifacts).filter(
        name => !serviceArtifacts[name]
      ),
      serviceOnly: Object.keys(serviceArtifacts).filter(
        name => !legacyArtifacts[name]
      ),
    },
  },
};

const reportPath = path.join(
  repositoryRoot,
  'compatibility',
  'dual-path-diff-v4.0.8.json'
);
if (process.argv.includes('--record')) {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
} else {
  const expected = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.deepEqual(report, expected);
}

assert.equal(report.diff.exitSemanticsEqual, true);
assert.equal(report.diff.diagnosticsEqual, false);
assert.deepEqual(report.diff.generatedFileNaming.serviceOnly, ['index.ts']);
assert.equal(
  report.diff.outputContent.every(entry => entry.equal),
  true
);
console.log(
  'Dual-path characterization matches the recorded v4.0.8 diff report.'
);
process.exit(0);
