import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolRoot, '../..');
const sourceRoot = path.join(repositoryRoot, 'assets/svges');
const engine = process.argv[2];
const count = Number(process.argv[3]);
if (!['svger', 'svgr'].includes(engine) || ![50, 100, 170].includes(count)) {
  process.stderr.write('Invalid benchmark worker arguments.\n');
  process.exit(2);
}

const entries = (await readdir(sourceRoot, { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.svg'))
  .sort((left, right) => left.name.localeCompare(right.name))
  .slice(0, count);
if (entries.length !== count) throw new Error('The checked-in SVG corpus is incomplete.');

const fixtures = [];
const fixtureHash = createHash('sha256');
for (const entry of entries) {
  const source = await readFile(path.join(sourceRoot, entry.name), 'utf8');
  fixtureHash.update(entry.name).update('\0').update(source).update('\0');
  fixtures.push({ name: entry.name, source });
}

let transform;
let engineVersion;
if (engine === 'svger') {
  const [{ SVGProcessor }, packageJson] = await Promise.all([
    import(pathToFileURL(path.join(repositoryRoot, 'dist/processors/svg-processor.js'))),
    readFile(path.join(repositoryRoot, 'package.json'), 'utf8').then(JSON.parse),
  ]);
  const logger = { debug() {}, info() {}, warn() {}, error() {}, success() {} };
  const processor = new SVGProcessor({ logger });
  transform = (source, name) => processor.generateComponent(name, source, {
    framework: 'react',
    typescript: false,
    optimizationLevel: 'none',
    unsafeInputPolicy: 'reject',
  });
  engineVersion = packageJson.version;
} else {
  const [{ transform: svgrTransform }, jsxPlugin, packageJson] = await Promise.all([
    import('@svgr/core'),
    import('@svgr/plugin-jsx').then(module => module.default),
    readFile(path.join(toolRoot, 'node_modules/@svgr/core/package.json'), 'utf8').then(JSON.parse),
  ]);
  transform = (source, name) => svgrTransform(source, {
    plugins: [jsxPlugin],
    typescript: false,
    svgo: false,
  }, { componentName: name });
  engineVersion = packageJson.version;
}

const cpuStart = process.cpuUsage();
const start = performance.now();
const outputHash = createHash('sha256');
let peakRssBytes = process.memoryUsage().rss;
const sampler = setInterval(() => {
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
}, 10);
let succeeded = 0;
let failed = 0;
let outputBytes = 0;
for (let index = 0; index < fixtures.length; index += 1) {
  const fixture = fixtures[index];
  const componentName = `BenchmarkIcon${String(index + 1).padStart(3, '0')}`;
  try {
    const output = await transform(fixture.source, componentName);
    if (typeof output !== 'string') throw new Error('Transform did not return source text.');
    outputBytes += Buffer.byteLength(output, 'utf8');
    outputHash.update(fixture.name).update('\0success\0').update(output).update('\0');
    succeeded += 1;
  } catch {
    outputHash.update(fixture.name).update('\0failure\0');
    failed += 1;
  }
}
clearInterval(sampler);
peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
const wallTimeMs = performance.now() - start;
const cpuUsage = process.cpuUsage(cpuStart);
const cpuTimeMs = (cpuUsage.user + cpuUsage.system) / 1000;

process.stdout.write(`${JSON.stringify({
  schemaVersion: 1,
  engine,
  engineVersion,
  fileCount: count,
  succeeded,
  failed,
  wallTimeMs,
  cpuTimeMs,
  cpuCoreEquivalent: wallTimeMs === 0 ? 0 : cpuTimeMs / wallTimeMs,
  peakRssBytes,
  rssSamplingIntervalMs: 10,
  outputBytes,
  fixtureSha256: fixtureHash.digest('hex'),
  outputSha256: outputHash.digest('hex'),
})}\n`);
