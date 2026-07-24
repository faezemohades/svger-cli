import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createSVGCompiler } from '../../dist/index.js';

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function buildCleanFixture(name) {
  const fixture = await fs.mkdtemp(
    path.join(os.tmpdir(), `svger-p1-repro-${name}-`)
  );
  const source = path.join(fixture, 'icons');
  await fs.mkdir(source);
  await fs.writeFile(
    path.join(source, 'alpha.svg'),
    '<svg viewBox="0 0 16 16"><path d="M0 0h4v4z"/></svg>\n'
  );
  await fs.writeFile(
    path.join(source, 'Beta.SVG'),
    '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/></svg>\n'
  );
  const compiler = await createSVGCompiler({ cwd: fixture });
  const report = await compiler.build({
    src: 'icons',
    out: 'components',
    concurrency: name === 'first' ? 1 : 4,
    batchSize: name === 'first' ? 1 : 8,
  });
  assert.equal(report.status, 'success');
  const files = (await fs.readdir(path.join(fixture, 'components'))).sort();
  const outputs = Object.fromEntries(
    await Promise.all(
      files.map(async file => {
        const content = await fs.readFile(
          path.join(fixture, 'components', file)
        );
        return [file, { bytes: content, sha256: sha256(content) }];
      })
    )
  );
  return { fixture, report, outputs };
}

const first = await buildCleanFixture('first');
const second = await buildCleanFixture('second');
assert.deepEqual(Object.keys(first.outputs), Object.keys(second.outputs));
for (const file of Object.keys(first.outputs)) {
  assert.deepEqual(first.outputs[file].bytes, second.outputs[file].bytes, file);
  assert.equal(first.outputs[file].sha256, second.outputs[file].sha256, file);
}
assert.deepEqual(
  first.report.artifacts.map(artifact => ({
    componentName: artifact.componentName,
    sha256: artifact.sha256,
    byteLength: artifact.byteLength,
  })),
  second.report.artifacts.map(artifact => ({
    componentName: artifact.componentName,
    sha256: artifact.sha256,
    byteLength: artifact.byteLength,
  }))
);

await fs.rm(first.fixture, { recursive: true, force: true });
await fs.rm(second.fixture, { recursive: true, force: true });
console.log('Phase 1 byte-level reproducibility contracts passed.');
