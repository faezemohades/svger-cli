import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import {
  assertRasterizerCompatibility,
  compareVisually,
} from '../../dist/utils/visual-diff.js';

const manifest = JSON.parse(
  await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8')
);
const lockfile = JSON.parse(
  await fs.readFile(new URL('../../package-lock.json', import.meta.url), 'utf8')
);

assert.equal(manifest.optionalDependencies?.sharp, undefined);
assert.equal(lockfile.packages[''].optionalDependencies?.sharp, undefined);
assert.equal(lockfile.packages['node_modules/sharp'], undefined);

assert.doesNotThrow(() => assertRasterizerCompatibility('v20.9.0', '0.35.5'));
assert.doesNotThrow(() => assertRasterizerCompatibility('24.22.0', '0.36.0'));
assert.throws(
  () => assertRasterizerCompatibility('18.17.0', '0.35.5'),
  error =>
    error?.code === 'DEPENDENCY_UNAVAILABLE' &&
    /Node >=20\.9\.0/u.test(error.message)
);
for (const unsafeVersion of ['0.34.5', '0.35.4', '0.35.5-rc.1', 'unknown']) {
  assert.throws(
    () => assertRasterizerCompatibility('20.20.2', unsafeVersion),
    error =>
      error?.code === 'DEPENDENCY_UNAVAILABLE' &&
      /sharp >=0\.35\.5/u.test(error.message),
    `sharp ${unsafeVersion} must not be allowed`
  );
}

await assert.rejects(
  () => compareVisually('<svg/>', '<svg/>'),
  error =>
    error?.code === 'DEPENDENCY_UNAVAILABLE' &&
    (/Node >=20\.9\.0/u.test(error.message) ||
      /sharp >=0\.35\.5/u.test(error.message) ||
      /separately installed optional dependencies/u.test(error.message))
);

console.log('Optional rasterization security and runtime policy passed.');
