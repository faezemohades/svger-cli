import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const verify = spawnSync(process.execPath, ['scripts/verify-baseline.mjs'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
});
process.stdout.write(verify.stdout);
process.stderr.write(verify.stderr);
if (verify.status !== 0) process.exit(verify.status ?? 1);

const baseRef = process.env.GITHUB_BASE_REF;
if (!baseRef) {
  console.log(
    'Baseline change policy: no pull-request base ref; hash verification only.'
  );
  process.exit(0);
}

const diff = spawnSync(
  'git',
  ['diff', '--name-status', `origin/${baseRef}...HEAD`, '--', 'baselines/'],
  { cwd: repositoryRoot, encoding: 'utf8' }
);
if (diff.status !== 0) {
  process.stderr.write(diff.stderr);
  process.exit(diff.status ?? 1);
}

const changes = diff.stdout
  .split(/\r?\n/)
  .map(file => file.trim())
  .filter(Boolean)
  .map(line => {
    const [status, ...paths] = line.split(/\t/);
    return { status, file: paths.at(-1) };
  });

const mutations = changes.filter(({ status }) => !status.startsWith('A'));
if (mutations.length > 0) {
  console.error(
    'A sealed baseline was modified, deleted, or renamed. Existing baseline archives are immutable:\n' +
      mutations.map(change => `${change.status}\t${change.file}`).join('\n')
  );
  process.exit(1);
}

if (changes.length > 0 && process.env.BASELINE_UPDATE_APPROVED !== 'true') {
  console.error(
    'A new baseline was added without the baseline-update-approved pull-request label:\n' +
      changes.map(change => change.file).join('\n')
  );
  process.exit(1);
}

const addedLocks = changes
  .map(change => change.file)
  .filter(file => file.endsWith('/baseline.lock.json'));
for (const lockFile of addedLocks) {
  const lock = JSON.parse(
    await readFile(path.join(repositoryRoot, lockFile), 'utf8')
  );
  const isInitialPhaseZeroCapture =
    lockFile === 'baselines/v4.0.x/baseline.lock.json' &&
    lock.generatedBy === 'node scripts/capture-v4-baseline.mjs';
  if (
    lock.generatedBy !== 'npm run baseline:update' &&
    !isInitialPhaseZeroCapture
  ) {
    console.error(
      `${lockFile} was not created by the approved baseline:update workflow.`
    );
    process.exit(1);
  }
  if (
    typeof lock.updateReason !== 'string' ||
    lock.updateReason.trim().length === 0
  ) {
    console.error(`${lockFile} does not record the required review reason.`);
    process.exit(1);
  }
}

console.log(
  changes.length === 0
    ? 'Baseline change policy: no baseline files changed.'
    : `Baseline change policy: ${changes.length} files in a new, reviewed baseline approved.`
);
