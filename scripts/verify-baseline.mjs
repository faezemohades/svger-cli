import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const baselinesRoot = path.join(repositoryRoot, 'baselines');
const failures = [];

const walk = async directory => {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(absolutePath)));
    else paths.push(absolutePath);
  }
  return paths;
};

const baselineDirectories = (
  await readdir(baselinesRoot, {
    withFileTypes: true,
  })
)
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(baselinesRoot, entry.name));
let verifiedFiles = 0;

for (const baselineRoot of baselineDirectories) {
  const baselineName = path.basename(baselineRoot);
  let lock;
  try {
    lock = JSON.parse(
      await readFile(path.join(baselineRoot, 'baseline.lock.json'), 'utf8')
    );
  } catch (error) {
    failures.push(
      `${baselineName}/baseline.lock.json: ${error instanceof Error ? error.message : String(error)}`
    );
    continue;
  }

  const expectedPaths = new Set([
    ...Object.keys(lock.files),
    'baseline.lock.json',
  ]);
  for (const absolutePath of await walk(baselineRoot)) {
    const relativePath = path.relative(baselineRoot, absolutePath);
    if (!expectedPaths.has(relativePath)) {
      failures.push(
        `${baselineName}/${relativePath}: unexpected file in sealed baseline`
      );
    }
  }

  for (const [relativePath, expectedHash] of Object.entries(lock.files)) {
    try {
      const actualHash = createHash('sha256')
        .update(await readFile(path.join(baselineRoot, relativePath)))
        .digest('hex');
      if (actualHash !== expectedHash) {
        failures.push(
          `${baselineName}/${relativePath}: expected ${expectedHash}, received ${actualHash}`
        );
      }
      verifiedFiles += 1;
    } catch (error) {
      failures.push(
        `${baselineName}/${relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`Baseline verification failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${verifiedFiles} immutable files across ${baselineDirectories.length} baseline archive(s).`
  );
}
