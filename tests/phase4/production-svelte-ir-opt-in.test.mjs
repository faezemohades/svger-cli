import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSVGCompiler } from '../../dist/index.js';
import { collectAdmittedSVGDocument } from '../../dist/security/input-safety.js';
import { createPipelineFingerprint } from '../../dist/cache/content-addressable-cache.js';
import { lowerAdmittedSVGToIR } from '../../dist/compiler/lower-svg-document-to-ir.js';
import { validateAndFreezeIR } from '../../dist/compiler/ir-v1.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-phase43a-'));
const sourceDir = path.join(root, 'icons');
const outputJS = path.join(root, 'js');
const outputTS = path.join(root, 'ts');
await fs.mkdir(sourceDir);
const source =
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 8 8" width="8\tpx" xml:space="preserve"><!--ordered--><text>A&amp;B\r\n<tspan><![CDATA[C]]></tspan></text><path id="shape" d="M0 0h8v8z"/><use xlink:href="#shape"/></svg>';
const collected = collectAdmittedSVGDocument(source);
const validatedIR = lowerAdmittedSVGToIR(
  collected.source,
  collected.document,
  'Icon'
);
assert.equal(
  validateAndFreezeIR(validatedIR),
  validatedIR,
  'an already validated, deeply frozen IR value is reused without recopying'
);
assert.equal(collected.document.root.attributes[3].value, '8 px');
assert.equal(collected.document.root.children[0].kind, 'comment');
assert.equal(collected.document.root.children[1].kind, 'element');
assert.equal(collected.document.root.children[1].children[0].value, 'A&B\n');
assert.equal(
  collected.document.root.children[1].children[1].children[0].kind,
  'cdata'
);
assert.equal(
  collected.document.root.children[3].attributes[0].name.namespaceUri,
  'http://www.w3.org/1999/xlink'
);
assert.equal(Object.isFrozen(collected.document.root.children), true);
assert.equal(
  collectAdmittedSVGDocument('<svg><text>bad]]&gt;</text></svg>').document.root
    .children[0].children[0].value,
  'bad]]>'
);
assert.throws(
  () => collectAdmittedSVGDocument('<svg><text>bad]]></text></svg>'),
  error => error?.code === 'E_INVALID_SVG_XML'
);

const compiler = await createSVGCompiler({ cwd: root });
await fs.writeFile(path.join(sourceDir, 'icon.svg'), source);
for (const [typescript, output] of [
  [false, outputJS],
  [true, outputTS],
]) {
  const report = await compiler.build({
    src: sourceDir,
    out: output,
    framework: 'svelte',
    typescript,
    svelteCompiler: 'ir-v1',
    optimize: 'none',
    mode: 'write',
  });
  assert.equal(report.status, 'success', JSON.stringify(report.diagnostics));
  const generated = await fs.readFile(path.join(output, 'Icon.svelte'), 'utf8');
  assert.equal(generated.includes('<script lang="ts">'), typescript);
  assert.match(generated, /xlink:href="#shape"/u);
  assert.match(generated, /A&amp;B/u);
  assert.doesNotMatch(generated, /\{#if|on:|bind:/u);
}

const legacy = await compiler.build({
  src: sourceDir,
  out: path.join(root, 'legacy'),
  framework: 'svelte',
  typescript: false,
  optimize: 'none',
  mode: 'write',
});
const explicitLegacy = await compiler.build({
  src: sourceDir,
  out: path.join(root, 'explicit-legacy'),
  framework: 'svelte',
  typescript: false,
  svelteCompiler: 'legacy',
  optimize: 'none',
  mode: 'write',
});
assert.equal(legacy.status, 'success');
assert.equal(explicitLegacy.status, 'success');
assert.equal(
  await fs.readFile(path.join(root, 'legacy', 'Icon.svelte'), 'utf8'),
  await fs.readFile(path.join(root, 'explicit-legacy', 'Icon.svelte'), 'utf8')
);

await fs.writeFile(
  path.join(root, '.svgconfig.json'),
  JSON.stringify({
    framework: 'svelte',
    typescript: false,
    svelteCompiler: 'ir-v1',
  })
);
const configuredCompiler = await createSVGCompiler({ cwd: root });
const configuredReport = await configuredCompiler.build({
  src: sourceDir,
  out: path.join(root, 'configured'),
  optimize: 'none',
  mode: 'write',
});
assert.equal(configuredReport.status, 'success');
assert.doesNotMatch(
  await fs.readFile(path.join(root, 'configured', 'Icon.svelte'), 'utf8'),
  /<script lang="ts">/u
);

const before = await fs.readdir(path.join(root, 'unsupported')).catch(() => []);
const cacheDirectory = path.join(root, '.svger-cache', '1.0.0');
const cachedEntriesBeforeFailure = await fs.readdir(cacheDirectory);
const unsupportedPath = path.join(sourceDir, 'unsupported.svg');
await fs.writeFile(unsupportedPath, '<svg><marker id="m"/></svg>');
const unsupported = await compiler.build({
  src: sourceDir,
  out: path.join(root, 'unsupported'),
  framework: 'svelte',
  typescript: false,
  svelteCompiler: 'ir-v1',
  optimize: 'none',
  mode: 'write',
});
assert.equal(unsupported.status, 'failed');
assert.ok(
  unsupported.diagnostics.some(item => item.code === 'E_SVELTE_IR_UNSUPPORTED'),
  JSON.stringify(unsupported.diagnostics)
);
assert.deepEqual(
  await fs.readdir(path.join(root, 'unsupported')).catch(() => []),
  before
);
assert.deepEqual(await fs.readdir(cacheDirectory), cachedEntriesBeforeFailure);

const malformedPath = path.join(sourceDir, 'malformed.svg');
await fs.writeFile(malformedPath, '<svg><g></svg>');
const malformed = await compiler.build({
  src: sourceDir,
  out: path.join(root, 'malformed-output'),
  framework: 'svelte',
  typescript: false,
  svelteCompiler: 'ir-v1',
  optimize: 'none',
  mode: 'write',
});
assert.equal(malformed.status, 'failed');
assert.ok(
  malformed.diagnostics.some(item => item.code === 'E_INVALID_SVG_XML')
);
assert.deepEqual(
  await fs.readdir(path.join(root, 'malformed-output')).catch(() => []),
  []
);
assert.deepEqual(await fs.readdir(cacheDirectory), cachedEntriesBeforeFailure);
assert.throws(
  () =>
    compiler.config.explain({ framework: 'react', svelteCompiler: 'ir-v1' }),
  error => error?.code === 'E_INVALID_CONFIGURATION'
);
assert.throws(
  () =>
    compiler.config.explain({ framework: 'react', svelteCompiler: 'legacy' }),
  error => error?.code === 'E_INVALID_CONFIGURATION'
);

const config = compiler.config.explain({
  framework: 'svelte',
  svelteCompiler: 'ir-v1',
});
assert.ok(
  config.some(item => item.path === 'svelteCompiler' && item.value === 'ir-v1')
);
const defaultConfig = (
  await import('../../dist/services/config.js')
).configService.getDefaultConfig();
const legacyFingerprint = createPipelineFingerprint(
  { ...defaultConfig, framework: 'svelte', svelteCompiler: undefined },
  'none'
);
const irFingerprint = createPipelineFingerprint(
  { ...defaultConfig, framework: 'svelte', svelteCompiler: 'ir-v1' },
  'none'
);
assert.notEqual(
  legacyFingerprint.featureFlags.svelteCompiler,
  irFingerprint.featureFlags.svelteCompiler
);

await fs.rm(root, { recursive: true, force: true });
console.log('Production Svelte IR opt-in integration regressions passed.');
