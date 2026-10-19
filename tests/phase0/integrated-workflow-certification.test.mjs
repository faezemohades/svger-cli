import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExitCode, createSVGCompiler } from '../../dist/index.js';

const fixture = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-integrated-workflow-')
);
const source = path.join(fixture, 'safe-input');
const output = path.join(fixture, 'generated-components');
await fs.mkdir(source);
await fs.writeFile(
  path.join(source, 'shield.svg'),
  '<svg viewBox="0 0 24 24"><!-- optimization marker --><path fill-rule="nonzero" d="M1 1h2v2z"/></svg>'
);

const compiler = await createSVGCompiler({ cwd: fixture });
const report = await compiler.build({
  src: 'safe-input',
  out: 'generated-components',
  framework: 'react',
  typescript: true,
  optimize: 'basic',
});

assert.equal(report.status, 'success');
assert.equal(report.exitCode, ExitCode.Success);
assert.deepEqual(
  report.artifacts.map(artifact => path.basename(artifact.output)).sort(),
  ['Shield.tsx', 'index.ts']
);
assert.equal(report.summary.created, 2);

const generatedComponent = await fs.readFile(
  path.join(output, 'Shield.tsx'),
  'utf8'
);
assert.match(generatedComponent, /const Shield = React\.forwardRef/u);
assert.match(generatedComponent, /viewBox="0 0 24 24"/u);
assert.doesNotMatch(generatedComponent, /optimization marker/u);
assert.match(
  await fs.readFile(path.join(output, 'index.ts'), 'utf8'),
  /Shield/u
);
assert.deepEqual(
  (await fs.readdir(fixture)).filter(
    name =>
      name.startsWith('.svger-transaction-') ||
      name.startsWith('.svger-stage-')
  ),
  [],
  'successful artifact commit must clean transaction metadata and staging'
);

const unsafeSource = path.join(fixture, 'unsafe-input');
const unsafeOutput = path.join(fixture, 'unsafe-components');
await fs.mkdir(unsafeSource);
await fs.writeFile(
  path.join(unsafeSource, 'unsafe.svg'),
  '<svg><script>alert(1)</script></svg>'
);
const rejected = await compiler.build({
  src: 'unsafe-input',
  out: 'unsafe-components',
  framework: 'react',
  typescript: true,
});
assert.equal(rejected.status, 'failed');
assert.equal(rejected.exitCode, ExitCode.SecurityViolation);
assert.ok(rejected.diagnostics.some(item => item.code === 'E_UNSAFE_SVG_CONTENT'));
await assert.rejects(fs.access(unsafeOutput));

await fs.rm(fixture, { recursive: true, force: true });
console.log(
  'Integrated workflow certification passed: secure input, optimization, React TSX generation, and transactional commit.'
);
