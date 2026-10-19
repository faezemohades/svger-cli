import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CREDENTIAL_PATTERNS = [
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/u],
  ['npm token', /\bnpm_[A-Za-z0-9]{30,}\b/u],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/u],
  [
    'private key block',
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  ],
];

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

export function assertPackageBudgets({
  size,
  entryCount,
  maxBytes,
  maxEntries,
}) {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new TypeError('Package size must be a non-negative safe integer.');
  }
  if (!Number.isSafeInteger(entryCount) || entryCount < 0) {
    throw new TypeError('Package entry count must be a non-negative safe integer.');
  }
  if (size > maxBytes) {
    throw new Error(`Package size budget exceeded: ${size}/${maxBytes} bytes.`);
  }
  if (entryCount > maxEntries) {
    throw new Error(`Package entry budget exceeded: ${entryCount}/${maxEntries} files.`);
  }
}

export function credentialKindsInText(content) {
  return CREDENTIAL_PATTERNS.filter(([, pattern]) => pattern.test(content)).map(
    ([kind]) => kind
  );
}

export async function findCredentialContent(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const findings = [];
  const visit = async directory => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const content = await fs.readFile(absolutePath, 'utf8');
        const kinds = credentialKindsInText(content);
        if (kinds.length > 0) {
          findings.push({
            file: path.relative(root, absolutePath).split(path.sep).join('/'),
            kinds,
          });
        }
      }
    }
  };
  await visit(root);
  return findings;
}

export async function findCredentialContentInFiles(rootDirectory, files) {
  const root = path.resolve(rootDirectory);
  const findings = [];
  for (const relativeFile of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(relativeFile).toLowerCase())) continue;
    const content = await fs.readFile(path.join(root, relativeFile), 'utf8');
    const kinds = credentialKindsInText(content);
    if (kinds.length > 0) findings.push({ file: relativeFile, kinds });
  }
  return findings;
}

async function main(args) {
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('Expected paired --option value arguments.');
    }
    options.set(key, value);
  }

  if (options.has('--scan-dir')) {
    const findings = await findCredentialContent(options.get('--scan-dir'));
    if (findings.length > 0) {
      throw new Error(
        `Credential-shaped content found: ${findings
          .map(finding => `${finding.file} (${finding.kinds.join(', ')})`)
          .join('; ')}`
      );
    }
  }

  if (options.has('--size') || options.has('--entries')) {
    const number = key => {
      const parsed = Number(options.get(key));
      if (!Number.isSafeInteger(parsed)) throw new Error(`${key} must be an integer.`);
      return parsed;
    };
    assertPackageBudgets({
      size: number('--size'),
      entryCount: number('--entries'),
      maxBytes: number('--max-size'),
      maxEntries: number('--max-entries'),
    });
  }
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
