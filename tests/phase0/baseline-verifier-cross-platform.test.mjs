import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  BASELINE_VERIFICATION_LIMITS,
  canonicalizeFilesystemPath,
  registerPortablePath,
  verifyBaselineDirectory,
} from '../../scripts/lib/baseline-verification.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), 'svger-baseline-verification-')
);
after(() => rm(temporaryRoot, { recursive: true, force: true }));

async function createBaseline(name, files) {
  const root = path.join(temporaryRoot, name);
  await mkdir(root, { recursive: true });
  for (const [key, value] of Object.entries(files)) {
    const filePath = path.join(root, ...key.split('/'));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, value);
  }
  const lockFiles = Object.fromEntries(
    Object.entries(files).map(([key, value]) => [key, digest(value)])
  );
  await writeFile(
    path.join(root, 'baseline.lock.json'),
    JSON.stringify({ schemaVersion: 1, files: lockFiles })
  );
  return root;
}

const withLimits = overrides => ({
  limits: { ...BASELINE_VERIFICATION_LIMITS, ...overrides },
});

test('production canonicalizer normalizes Windows and POSIX paths', () => {
  const expected = 'fixtures/basic.svg';
  const posix = canonicalizeFilesystemPath(
    '/baseline',
    '/baseline/fixtures/basic.svg',
    path.posix
  );
  const windows = canonicalizeFilesystemPath(
    'C:\\baseline',
    'C:\\baseline\\fixtures\\basic.svg',
    path.win32
  );

  assert.equal(posix, expected);
  assert.equal(windows, expected);
  assert.equal(posix, windows);
  assert.throws(() =>
    canonicalizeFilesystemPath('/baseline', '/outside/basic.svg', path.posix)
  );
});

test('rejects unsafe manifest keys before traversing manifest paths', async () => {
  const root = path.join(temporaryRoot, 'traversal');
  const outsidePath = path.join(temporaryRoot, 'outside.svg');
  await mkdir(root);
  await writeFile(outsidePath, 'outside sentinel');
  await writeFile(
    path.join(root, 'baseline.lock.json'),
    JSON.stringify({
      schemaVersion: 1,
      files: { '../outside.svg': digest('outside sentinel') },
    })
  );

  await assert.rejects(
    verifyBaselineDirectory(root),
    /Unsafe or noncanonical manifest path/
  );
  assert.equal(await readFile(outsidePath, 'utf8'), 'outside sentinel');
});

test('verifies every listed regular file hash in a valid archive', async () => {
  const root = await createBaseline('valid', {
    'fixtures/basic.svg': '<svg/>',
    'fixtures/nested/second.svg': '<svg><path/></svg>',
  });

  assert.equal((await verifyBaselineDirectory(root)).verifiedFiles, 2);
});

test('rejects case and Unicode aliases of the reserved lockfile', async () => {
  for (const alias of ['BASELINE.LOCK.JSON', 'baseline.locK.json']) {
    const root = await createBaseline(
      `reserved-${Buffer.from(alias).toString('hex')}`,
      {
        [alias]: '<svg/>',
      }
    );
    await assert.rejects(
      verifyBaselineDirectory(root),
      /baseline\.lock\.json or a portable alias cannot list itself/
    );
  }
});

test('rejects portable directory collisions in the manifest before file access', async () => {
  const root = path.join(temporaryRoot, 'manifest-directory-collision');
  await mkdir(root);
  await writeFile(
    path.join(root, 'baseline.lock.json'),
    JSON.stringify({
      schemaVersion: 1,
      files: {
        'Folder/first.svg': digest('<svg/>'),
        'folder/second.svg': digest('<svg/>'),
      },
    })
  );

  await assert.rejects(
    verifyBaselineDirectory(root),
    /Canonical path collision.*Folder.*folder/
  );
});

test('portable registry rejects file and directory identity collisions', () => {
  const fileRegistry = new Map();
  registerPortablePath(fileRegistry, 'Icon.svg', 'file');
  assert.throws(
    () => registerPortablePath(fileRegistry, 'icon.svg', 'file'),
    /Canonical path collision/
  );

  const registry = new Map();
  registerPortablePath(registry, 'Folder/first.svg', 'file');
  assert.throws(
    () => registerPortablePath(registry, 'folder/second.svg', 'file'),
    /Canonical path collision/
  );

  const fileDirectoryRegistry = new Map();
  registerPortablePath(fileDirectoryRegistry, 'icons', 'file');
  assert.throws(
    () => registerPortablePath(fileDirectoryRegistry, 'ICONS/home.svg', 'file'),
    /Canonical path collision/
  );

  const directoryFileRegistry = new Map();
  registerPortablePath(directoryFileRegistry, 'icons/home.svg', 'file');
  assert.throws(
    () => registerPortablePath(directoryFileRegistry, 'ICONS', 'file'),
    /Canonical path collision/
  );

  const unicodeRegistry = new Map();
  registerPortablePath(unicodeRegistry, 'café/icon.svg', 'file');
  assert.throws(
    () => registerPortablePath(unicodeRegistry, 'cafe\u0301/other.svg', 'file'),
    /Canonical path collision/
  );
});

test('rejects missing files', async () => {
  const root = await createBaseline('missing', {
    'fixtures/present.svg': '<svg/>',
  });
  await rm(path.join(root, 'fixtures/present.svg'));

  await assert.rejects(verifyBaselineDirectory(root), /Missing manifest file/);
});

test('rejects unexpected files', async () => {
  const root = await createBaseline('unexpected', {
    'fixtures/expected.svg': '<svg/>',
  });
  await writeFile(path.join(root, 'extra.txt'), 'unexpected');

  await assert.rejects(
    verifyBaselineDirectory(root),
    /Unexpected file.*extra\.txt/
  );
});

test('rejects modified files by digest', async () => {
  const root = await createBaseline('modified', {
    'fixtures/first.svg': '<svg/>',
    'fixtures/second.svg': '<svg/>',
  });
  await writeFile(
    path.join(root, 'fixtures/second.svg'),
    '<svg changed="true"/>'
  );

  await assert.rejects(
    verifyBaselineDirectory(root),
    /fixtures\/second\.svg: expected/
  );
});

test('rejects file and directory symlinks', async () => {
  const outsidePath = path.join(temporaryRoot, 'symlink-target');
  await writeFile(outsidePath, 'outside');

  const fileRoot = await createBaseline('file-symlink', {
    'fixtures/expected.svg': '<svg/>',
  });
  await rm(path.join(fileRoot, 'fixtures/expected.svg'));
  await symlink(outsidePath, path.join(fileRoot, 'fixtures/expected.svg'));
  await assert.rejects(
    verifyBaselineDirectory(fileRoot),
    /Symlink is not allowed in baseline/
  );

  const directoryRoot = await createBaseline('directory-symlink', {
    'fixtures/expected.svg': '<svg/>',
  });
  await rm(path.join(directoryRoot, 'fixtures'), { recursive: true });
  await symlink(
    path.dirname(outsidePath),
    path.join(directoryRoot, 'fixtures'),
    'dir'
  );
  await assert.rejects(
    verifyBaselineDirectory(directoryRoot),
    /Symlink is not allowed in baseline/
  );
});

test('enforces lockfile byte budget before parsing', async () => {
  const root = await createBaseline('lock-budget', {});
  await writeFile(
    path.join(root, 'baseline.lock.json'),
    JSON.stringify({ schemaVersion: 1, files: {} })
  );

  await assert.rejects(
    verifyBaselineDirectory(root, withLimits({ lockfileBytes: 8 })),
    /baseline\.lock\.json exceeds the 8-byte verification limit/
  );
});

test('enforces manifest entry budget', async () => {
  const root = await createBaseline('manifest-budget', {
    'one.svg': '<svg/>',
    'two.svg': '<svg/>',
  });

  await assert.rejects(
    verifyBaselineDirectory(root, withLimits({ manifestEntries: 1 })),
    /Manifest exceeds the 1-entry verification limit/
  );
});

test('enforces traversal depth before descending', async () => {
  const root = await createBaseline('depth-budget', {
    'one/two/file.svg': '<svg/>',
  });

  await assert.rejects(
    verifyBaselineDirectory(root, withLimits({ traversalDepth: 2 })),
    /Baseline traversal exceeds the 2-level depth limit/
  );
});

test('enforces discovered filesystem entry budget', async () => {
  const root = await createBaseline('filesystem-budget', {
    'fixtures/file.svg': '<svg/>',
  });

  await assert.rejects(
    verifyBaselineDirectory(root, withLimits({ filesystemEntries: 2 })),
    /Baseline traversal exceeds the 2-entry filesystem limit/
  );
});
