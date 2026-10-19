import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const policy = JSON.parse(
  await fs.readFile(
    path.join(repositoryRoot, 'governance/release-policy.json'),
    'utf8'
  )
);

if (policy.schemaVersion !== 1 || policy.publishingAuthorized !== true) {
  process.stderr.write(
    `Publishing is disabled: ${policy.blocker ?? 'release authorization is not recorded.'}\n`
  );
  process.exitCode = 1;
} else {
  process.stdout.write('Release authorization is enabled by repository policy.\n');
}
