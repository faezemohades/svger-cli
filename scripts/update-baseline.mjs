import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const reason = args.get('--reason');
const target = args.get('--target');

if (!reason || !target) {
  console.error(
    'Usage: npm run baseline:update -- --target <new-version-directory> --reason "<review reason>"'
  );
  process.exit(1);
}
if (!/^v[0-9]+\.[0-9]+(?:\.[0-9x]+)?$/.test(target)) {
  console.error(
    'The baseline target must be a simple version name such as v4.1.x.'
  );
  process.exit(1);
}

const baselineRoot = path.join(repositoryRoot, 'baselines', target);
const lockPath = path.join(baselineRoot, 'baseline.lock.json');
try {
  await readFile(lockPath, 'utf8');
  console.error(
    `${target} is already sealed. Existing baselines are immutable; create a new versioned baseline.`
  );
  process.exit(1);
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('ENOENT'))
    throw error;
}

const walk = async directory => {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(absolutePath)));
    else paths.push(absolutePath);
  }
  return paths;
};
const files = (await walk(baselineRoot)).filter(file => file !== lockPath);
if (files.length === 0) {
  console.error(`No baseline artifacts exist under baselines/${target}.`);
  process.exit(1);
}

const hashes = {};
for (const file of files.sort()) {
  hashes[path.relative(baselineRoot, file)] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
}
const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
});
await writeFile(
  lockPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy: 'npm run baseline:update',
      sourceCommit: commit.status === 0 ? commit.stdout.trim() : 'unavailable',
      updateReason: reason,
      files: hashes,
    },
    null,
    2
  )}\n`
);
console.log(
  `Sealed ${files.length} files in baselines/${target}. Request explicit baseline-owner review.`
);
