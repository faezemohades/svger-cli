import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runMigration } from '../../dist/index.js';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-p1-migrate-'));
const configPath = path.join(fixture, '.svgconfig.json');
const legacyConfig = `${JSON.stringify(
  {
    version: '4.0.9',
    plugin: 'color-replacer',
    framework: 'react',
  },
  null,
  2
)}\n`;
await fs.writeFile(configPath, legacyConfig);

const preview = await runMigration({
  target: 'config',
  inputPath: configPath,
  dryRun: true,
});
assert.equal(preview.changed, true);
assert.equal(preview.wrote, false);
assert.equal(await fs.readFile(configPath, 'utf8'), legacyConfig);

const migrated = await runMigration({
  target: 'config',
  inputPath: configPath,
});
assert.equal(migrated.wrote, true);
assert.equal(migrated.backups.length, 1);
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
assert.equal(config.version, '4.1.0');
assert.deepEqual(config.plugins, ['color-replacer']);
assert.equal(
  await fs.readFile(`${configPath}.svger-v4.bak`, 'utf8'),
  legacyConfig
);

const idempotent = await runMigration({
  target: 'config',
  inputPath: configPath,
  backup: false,
});
assert.equal(idempotent.changed, false);
assert.equal(idempotent.wrote, false);

const pluginMigration = await runMigration({
  target: 'plugins',
  inputPath: configPath,
  backup: false,
});
assert.equal(pluginMigration.wrote, true);
assert.deepEqual(JSON.parse(await fs.readFile(configPath, 'utf8')).plugins, [
  { name: 'color-replacer', options: {} },
]);

const sourceDirectory = path.join(fixture, 'src');
await fs.mkdir(sourceDirectory);
const sourcePath = path.join(sourceDirectory, 'consumer.ts');
await fs.writeFile(
  sourcePath,
  "import { buildAll } from 'svger-cli/dist/builder.js';\nimport vite from 'svger-cli/dist/integrations/vite.js';\n"
);
const importsPreview = await runMigration({
  target: 'imports',
  inputPath: sourceDirectory,
  dryRun: true,
});
assert.match(importsPreview.changes[0].after, /from 'svger-cli'/);
assert.match(importsPreview.changes[0].after, /from 'svger-cli\/vite'/);

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const cli = spawnSync(
  process.execPath,
  [
    path.join(repository, 'dist', 'cli.js'),
    'migrate',
    'imports',
    sourceDirectory,
    '--dry-run',
    '--format',
    'json',
  ],
  { encoding: 'utf8' }
);
assert.equal(cli.status, 0, cli.stderr);
assert.equal(JSON.parse(cli.stdout).mode, 'dry-run');
assert.match(await fs.readFile(sourcePath, 'utf8'), /dist\/builder/);

await fs.rm(fixture, { recursive: true, force: true });
console.log('Phase 1 migration toolkit contracts passed.');
