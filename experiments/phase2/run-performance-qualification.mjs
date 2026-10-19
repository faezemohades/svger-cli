import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import {
  performanceFixtures,
  describeStructure,
} from './performance-fixtures.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map(value => {
    const [key, ...rest] = value.replace(/^--/u, '').split('=');
    return [key, rest.join('=')];
  })
);
const runtimes = [
  {
    label: 'node18.20.6-npm10.8.2',
    node: '18.20.6',
    npm: '10.8.2',
    executable: args.node18,
  },
  {
    label: 'node24.13.1-npm11.8.0',
    node: '24.13.1',
    npm: '11.8.0',
    executable: args.node24,
  },
];
if (runtimes.some(runtime => !runtime.executable)) {
  throw new Error('Pass --node18=/path/to/node and --node24=/path/to/node.');
}
const configurations = [
  'scanner',
  'saxes-events',
  'saxes-adapter',
  'xmldom',
  'xmldom-walk',
  'source-spans',
];
const warmIterations = {
  small: 100,
  medium: 100,
  large: 30,
  'text-heavy': 50,
  'attribute-heavy': 30,
  'near-depth-limit': 10,
  'near-byte-limit': 2,
};

function runChild(
  runtime,
  fixture,
  configuration,
  iterations,
  mode = 'accepted'
) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      runtime.executable,
      [
        '--expose-gc',
        '--max-old-space-size=384',
        'experiments/phase2/performance-worker.mjs',
        fixture,
        configuration,
        String(iterations),
        mode,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill('SIGKILL'), 45_000);
    child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(
          new Error(
            `${runtime.label} ${fixture}/${configuration}/${mode} failed (${signal ?? code}): ${stderr.slice(-2000)}`
          )
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim().split('\n').at(-1)));
      } catch (error) {
        reject(
          new Error(
            `Could not parse worker output: ${stdout.slice(-1000)} ${stderr.slice(-1000)} ${error}`
          )
        );
      }
    });
  });
}

const results = [];
const memoryResults = [];
for (const runtime of runtimes) {
  for (const fixture of performanceFixtures.accepted) {
    for (const configuration of configurations) {
      const result = await runChild(
        runtime,
        fixture.name,
        configuration,
        warmIterations[fixture.name]
      );
      results.push({ runtime: runtime.label, ...result });
      process.stdout.write(
        `${runtime.label} ${fixture.name} ${configuration}: ${result.warmMedianMs.toFixed(2)} ms median\n`
      );
      const memory = await runChild(
        runtime,
        fixture.name,
        configuration,
        1,
        'memory'
      );
      memoryResults.push({ runtime: runtime.label, ...memory });
    }
  }
}

const rejectedResults = [];
for (const runtime of runtimes) {
  for (const fixture of performanceFixtures.rejected) {
    for (const configuration of ['scanner', 'saxes-adapter', 'xmldom']) {
      const result = await runChild(
        runtime,
        fixture.name,
        configuration,
        3,
        'rejected'
      );
      rejectedResults.push({
        runtime: runtime.label,
        fixture: fixture.name,
        configuration,
        ...result,
      });
    }
  }
  for (const [configuration, fixture] of [
    ['saxes-raw', 'malformed-tag'],
    ['xmldom-raw', 'malformed-tag'],
  ]) {
    const result = await runChild(
      runtime,
      fixture,
      configuration,
      10,
      'raw-parser-failure'
    );
    rejectedResults.push({
      runtime: runtime.label,
      fixture,
      configuration,
      ...result,
    });
  }
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  host: {
    platform: process.platform,
    release: process.release,
    arch: process.arch,
    osRelease: os.release(),
    cpuModel: os.cpus()[0]?.model ?? null,
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytesAtReport: os.freemem(),
    parentNode: process.version,
    runtimes: runtimes.map(({ node, npm }) => ({ node, npm })),
    flags: ['--expose-gc', '--max-old-space-size=384'],
    childTimeoutMs: 45_000,
  },
  fixtureSeed: '0x5a17c0de',
  fixtures: performanceFixtures.accepted.map(
    ({ name, bytes, codeUnits, seed, source }) => ({
      name,
      bytes,
      codeUnits,
      seed,
      ...describeStructure(source),
    })
  ),
  rejectedFixtures: performanceFixtures.rejected.map(
    ({ name, bytes, codeUnits, seed }) => ({ name, bytes, codeUnits, seed })
  ),
  warmIterations,
  results,
  memoryResults,
  rejectedResults,
};
const output = args.output ?? 'experiments/phase2/performance-results.json';
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `Wrote ${output}; ${results.length} accepted and ${rejectedResults.length} rejection observations.\n`
);
