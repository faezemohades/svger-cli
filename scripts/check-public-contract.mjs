import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function publicPackageContract(packageJson) {
  return {
    schemaVersion: 1,
    packageName: packageJson.packageName ?? packageJson.name,
    main: packageJson.main,
    types: packageJson.types,
    bin: packageJson.bin,
    exports: packageJson.exports,
  };
}

export function assertPublicContract(expected, actual) {
  assert.deepStrictEqual(
    publicPackageContract(actual),
    publicPackageContract(expected),
    'Public package entrypoints changed without an approved compatibility baseline update.'
  );
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function main(args) {
  let expectedPath;
  let actualPath;
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (key === '--expected') expectedPath = value;
    else if (key === '--actual') actualPath = value;
    else throw new Error(`Unknown option: ${key}`);
    if (!value) throw new Error(`Missing value for ${key}`);
  }
  if (!expectedPath || !actualPath) {
    throw new Error('Usage: check-public-contract --expected <json> --actual <package.json>');
  }
  const [expected, actual] = await Promise.all([
    readJson(expectedPath),
    readJson(actualPath),
  ]);
  assertPublicContract(expected, actual);
  process.stdout.write('Public package contract matches its approved baseline.\n');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
