import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ExitCode,
  createSVGCompiler,
} from '../../dist/index.js';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-p1-app-'));
const source = path.join(fixture, 'icons');
const output = path.join(fixture, 'components');
await fs.mkdir(source);
await fs.writeFile(
  path.join(source, 'check.svg'),
  '<svg viewBox="0 0 24 24"><path d="M1 1h2v2z"/></svg>'
);

const compiler = await createSVGCompiler({ cwd: fixture });
const dryRun = await compiler.build({
  src: 'icons',
  out: 'components',
  mode: 'dry-run',
});
assert.equal(dryRun.exitCode, ExitCode.Success);
assert.ok(dryRun.artifacts.every(artifact => artifact.status === 'planned'));
await assert.rejects(fs.access(output));

const written = await compiler.build({ src: 'icons', out: 'components' });
assert.equal(written.status, 'success');
assert.deepEqual(
  written.artifacts.map(artifact => path.basename(artifact.output)).sort(),
  ['Check.tsx', 'index.ts']
);
assert.match(await fs.readFile(path.join(output, 'Check.tsx'), 'utf8'), /Check/);
assert.match(await fs.readFile(path.join(output, 'index.ts'), 'utf8'), /Check/);

const check = await compiler.build({
  src: 'icons',
  out: 'components',
  mode: 'check',
});
assert.equal(check.exitCode, ExitCode.Success);
assert.ok(check.artifacts.every(artifact => artifact.status === 'unchanged'));

const previousOutput = await fs.readFile(path.join(output, 'Check.tsx'), 'utf8');
await fs.writeFile(
  path.join(source, 'check.svg'),
  '<svg viewBox="0 0 24 24"><circle cx="4" cy="4" r="2"/></svg>'
);
const stale = await compiler.build({
  src: 'icons',
  out: 'components',
  mode: 'diff',
});
assert.equal(stale.exitCode, ExitCode.StaleOutput);
assert.ok(stale.diagnostics.some(item => item.code === 'I_OUTPUT_DIFF'));
assert.equal(
  await fs.readFile(path.join(output, 'Check.tsx'), 'utf8'),
  previousOutput,
  'diff mode must not mutate output'
);

const collisionSource = path.join(fixture, 'collisions');
const collisionOutput = path.join(fixture, 'collision-output');
await fs.mkdir(collisionSource);
await fs.writeFile(path.join(collisionSource, 'home-icon.svg'), '<svg/>');
await fs.writeFile(path.join(collisionSource, 'home_icon.svg'), '<svg/>');
const collision = await compiler.build({
  src: 'collisions',
  out: 'collision-output',
});
assert.equal(collision.exitCode, ExitCode.NameCollision);
assert.equal(collision.diagnostics[0].code, 'E_NAME_COLLISION');
await assert.rejects(fs.access(collisionOutput));
assert.equal(
  (await fs.readdir(fixture)).some(name => name.startsWith('.svger-stage-')),
  false,
  'collision validation must happen before staging'
);

const reactCompiler = await createSVGCompiler({
  cwd: fixture,
  config: { framework: 'react', typescript: true },
});
const vueCompiler = await createSVGCompiler({
  cwd: fixture,
  config: { framework: 'vue', typescript: true },
});
const [react, vue] = await Promise.all([
  reactCompiler.build({ src: 'icons', out: 'react-output' }),
  vueCompiler.build({ src: 'icons', out: 'vue-output' }),
]);
assert.ok(react.artifacts.some(artifact => artifact.output.endsWith('.tsx')));
assert.ok(vue.artifacts.some(artifact => artifact.output.endsWith('.vue')));
assert.ok(!vue.artifacts.some(artifact => artifact.componentName === 'index'));

await fs.rm(fixture, { recursive: true, force: true });
console.log('Phase 1 canonical application service contracts passed.');
