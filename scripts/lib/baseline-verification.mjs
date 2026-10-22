import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const LOCK_FILE = 'baseline.lock.json';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const BASELINE_VERIFICATION_LIMITS = Object.freeze({
  lockfileBytes: 1024 * 1024,
  manifestEntries: 10_000,
  traversalDepth: 64,
  filesystemEntries: 20_000,
});

/** Portable identity used to detect paths that alias on common filesystems. */
export const portablePathIdentity = value =>
  value.normalize('NFC').toLowerCase();

/** Convert a filesystem-relative path to its portable, canonical manifest form. */
export function canonicalizeFilesystemPath(root, absolutePath, pathApi = path) {
  const relativePath = pathApi.relative(root, absolutePath);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relativePath)
  ) {
    throw new Error(`Path is outside the baseline root: ${absolutePath}`);
  }

  return relativePath.split(pathApi.sep).join('/');
}

/** Validate a lock-file key before it is used to locate any filesystem entry. */
export function validateManifestPath(manifestPath) {
  if (typeof manifestPath !== 'string' || manifestPath.length === 0) {
    throw new Error('Manifest paths must be non-empty strings');
  }
  if (
    manifestPath.startsWith('/') ||
    manifestPath.includes('\\') ||
    manifestPath.includes(':') ||
    /[\u0000-\u001f\u007f<>"|?*]/u.test(manifestPath)
  ) {
    throw new Error(`Unsafe or noncanonical manifest path: ${manifestPath}`);
  }

  const segments = manifestPath.split('/');
  if (
    segments.some(
      segment =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..' ||
        segment.endsWith('.') ||
        segment.endsWith(' ')
    )
  ) {
    throw new Error(`Unsafe or noncanonical manifest path: ${manifestPath}`);
  }

  return manifestPath;
}

/**
 * Register all path segments, including intermediate directories. Repeated use
 * of the same directory is allowed; spelling aliases and type conflicts fail.
 */
export function registerPortablePath(registry, relativePath, finalKind) {
  validateManifestPath(relativePath);
  const segments = relativePath.split('/');
  let canonicalPath = '';

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    canonicalPath = canonicalPath ? `${canonicalPath}/${segment}` : segment;
    const kind = index === segments.length - 1 ? finalKind : 'directory';
    const identity = portablePathIdentity(canonicalPath);
    const previous = registry.get(identity);

    if (
      previous !== undefined &&
      (previous.path !== canonicalPath || previous.kind !== kind)
    ) {
      throw new Error(
        `Canonical path collision: ${previous.path} (${previous.kind}) and ${canonicalPath} (${kind})`
      );
    }
    registry.set(identity, { path: canonicalPath, kind });
  }
}

async function assertRegularFile(filePath, description, maxBytes) {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error(
      `${description} must be a regular file (symlinks are not allowed)`
    );
  }
  if (info.size > maxBytes) {
    throw new Error(
      `${description} exceeds the ${maxBytes}-byte verification limit`
    );
  }
  return info;
}

async function collectFiles(root, limits) {
  const files = new Map();
  const identities = new Map();
  const counters = { entries: 0 };

  // Reserve the lockfile identity so case/Unicode aliases cannot shadow it.
  registerPortablePath(identities, LOCK_FILE, 'file');

  async function visit(directory, depth) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const childDepth = depth + 1;
      if (childDepth > limits.traversalDepth) {
        throw new Error(
          `Baseline traversal exceeds the ${limits.traversalDepth}-level depth limit`
        );
      }
      counters.entries += 1;
      if (counters.entries > limits.filesystemEntries) {
        throw new Error(
          `Baseline traversal exceeds the ${limits.filesystemEntries}-entry filesystem limit`
        );
      }

      const absolutePath = path.join(directory, entry.name);
      const info = await lstat(absolutePath);
      if (info.isSymbolicLink()) {
        throw new Error(`Symlink is not allowed in baseline: ${absolutePath}`);
      }

      const kind = info.isDirectory()
        ? 'directory'
        : info.isFile()
          ? 'file'
          : null;
      if (kind === null) {
        throw new Error(
          `Unsupported filesystem entry in baseline: ${absolutePath}`
        );
      }

      const key = canonicalizeFilesystemPath(root, absolutePath);
      registerPortablePath(identities, key, kind);
      if (kind === 'directory') {
        await visit(absolutePath, childDepth);
      } else {
        files.set(key, absolutePath);
      }
    }
  }

  await visit(root, 0);
  return files;
}

/**
 * Verify one baseline archive. lstat checks reject observed symlinks but do not
 * eliminate TOCTOU races if another process mutates the archive concurrently;
 * run this gate against a trusted, immutable checkout.
 */
export async function verifyBaselineDirectory(
  baselineRoot,
  { limits = BASELINE_VERIFICATION_LIMITS } = {}
) {
  const root = path.resolve(baselineRoot);
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error(`Baseline root must be a real directory: ${root}`);
  }

  const lockPath = path.join(root, LOCK_FILE);
  await assertRegularFile(lockPath, LOCK_FILE, limits.lockfileBytes);
  let lock;
  try {
    lock = JSON.parse(await readFile(lockPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to read ${LOCK_FILE}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (
    lock === null ||
    typeof lock !== 'object' ||
    lock.schemaVersion !== 1 ||
    lock.files === null ||
    typeof lock.files !== 'object' ||
    Array.isArray(lock.files)
  ) {
    throw new Error(`${LOCK_FILE} has an invalid schema or files map`);
  }

  const manifestKeys = Object.keys(lock.files);
  if (manifestKeys.length > limits.manifestEntries) {
    throw new Error(
      `Manifest exceeds the ${limits.manifestEntries}-entry verification limit`
    );
  }

  // Validate every key and digest before enumerating or reading referenced files.
  const expectedFiles = new Map();
  const identities = new Map();
  registerPortablePath(identities, LOCK_FILE, 'file');
  for (const key of manifestKeys) {
    validateManifestPath(key);
    if (portablePathIdentity(key) === portablePathIdentity(LOCK_FILE)) {
      throw new Error(`${LOCK_FILE} or a portable alias cannot list itself`);
    }
    const digest = lock.files[key];
    if (typeof digest !== 'string' || !SHA256_PATTERN.test(digest)) {
      throw new Error(`Invalid SHA-256 digest for manifest path: ${key}`);
    }

    registerPortablePath(identities, key, 'file');
    expectedFiles.set(key, digest);
  }

  const actualFiles = await collectFiles(root, limits);
  const unexpected = [...actualFiles.keys()].filter(
    key => key !== LOCK_FILE && !expectedFiles.has(key)
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected file(s) in sealed baseline: ${unexpected.sort().join(', ')}`
    );
  }

  const missing = [...expectedFiles.keys()].filter(
    key => !actualFiles.has(key)
  );
  if (missing.length > 0) {
    throw new Error(`Missing manifest file(s): ${missing.sort().join(', ')}`);
  }

  for (const [key, expectedDigest] of expectedFiles) {
    const bytes = await readFile(actualFiles.get(key));
    const actualDigest = createHash('sha256').update(bytes).digest('hex');
    if (actualDigest !== expectedDigest) {
      throw new Error(
        `${key}: expected ${expectedDigest}, received ${actualDigest}`
      );
    }
  }

  return { baselineRoot: root, verifiedFiles: expectedFiles.size };
}
