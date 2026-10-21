#!/usr/bin/env node

import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frameworks = new Set([
  'react', 'react-native', 'vue', 'angular', 'svelte', 'solid', 'preact', 'lit', 'vanilla',
]);

function valueFor(name, fallback) {
  const inline = process.argv.find(argument => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

function printHelp() {
  process.stdout.write(`SVGER-CLI sample runner (synthetic fixtures; no bundled corpus)\n\nUsage:\n  test-svger [--framework NAME] [--count N] [--typescript] [--input DIR] [--output DIR]\n\nOptions:\n  --framework NAME  react, react-native, vue, angular, svelte, solid, preact, lit, vanilla\n  --count N         Number of synthetic files (1–170) or maximum files from --input\n  --typescript      Generate TypeScript where supported\n  --input DIR       Use SVG files from a local directory instead of synthetic fixtures\n  --output DIR      Output directory (default: ./svger-test-output)\n  --help            Show this help\n\nExamples:\n  test-svger --count 50   (also supports --count=50)\n  test-svger --framework vue --typescript --count 20\n  test-svger --input ./icons --output ./generated\n`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

let framework;
let requestedCount;
let inputDirectory;
let outputDirectory;
try {
  framework = valueFor('--framework', 'react');
  requestedCount = Number(valueFor('--count', '10'));
  inputDirectory = valueFor('--input', undefined);
  outputDirectory = path.resolve(valueFor('--output', 'svger-test-output'));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Invalid option.'}\n`);
  process.exit(2);
}

if (!frameworks.has(framework)) {
  process.stderr.write(`Unsupported framework: ${framework}\n`);
  process.exit(2);
}
if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 170) {
  process.stderr.write('--count must be an integer from 1 to 170.\n');
  process.exit(2);
}

let syntheticRoot;
try {
  let sourceDirectory;
  if (inputDirectory) {
    sourceDirectory = path.resolve(inputDirectory);
    const files = (await readdir(sourceDirectory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.svg'))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (!files.length) throw new Error('The input directory contains no top-level SVG files.');
    if (files.length > requestedCount) {
      const selected = await mkdtemp(path.join(tmpdir(), 'svger-test-input-'));
      syntheticRoot = selected;
      for (const file of files.slice(0, requestedCount)) {
        await writeFile(path.join(selected, file.name), await readFile(path.join(sourceDirectory, file.name)));
      }
      sourceDirectory = selected;
    }
  } else {
    sourceDirectory = await mkdtemp(path.join(tmpdir(), 'svger-test-input-'));
    syntheticRoot = sourceDirectory;
    await mkdir(sourceDirectory, { recursive: true });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="currentColor"/></svg>\n';
    for (let index = 1; index <= requestedCount; index += 1) {
      await writeFile(path.join(sourceDirectory, `fixture-${String(index).padStart(3, '0')}.svg`), svg);
    }
  }

  const cliPath = path.join(packageRoot, 'bin/svg-tool.js');
  const args = [cliPath, 'build', sourceDirectory, outputDirectory, '--framework', framework];
  if (!process.argv.includes('--typescript')) args.push('--no-typescript');
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`SVGER process terminated by ${result.signal}.`);
  process.exitCode = result.status ?? 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Sample run failed.'}\n`);
  process.exitCode = 1;
} finally {
  if (syntheticRoot) await rm(syntheticRoot, { recursive: true, force: true });
}
