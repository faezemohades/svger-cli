import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { getPackageInfo } from '../utils/package-info.js';
import type { SVGConfig } from '../types/index.js';

const CACHE_SCHEMA_VERSION = '1.0.0' as const;
const DEFAULT_MAX_CACHE_ENTRIES = 1_000;
const DEFAULT_MAX_CACHE_BYTES = 256 * 1024 * 1024;

export interface PipelineFingerprint {
  compilerVersion: string;
  parser: { id: string; version: string };
  optimizer: {
    passIds: readonly string[];
    version: string;
    configHash: string;
  };
  frameworkAdapter: { id: string; version: string };
  formatter: { id: string; version: string };
  pluginGraphHash: string;
  policyHash: string;
  target: { platform: string; nodeMajor: string };
  accessibilityMode: string;
  namingStrategy: string;
  featureFlags: Readonly<Record<string, boolean | string | number>>;
  resolvedConfigHash: string;
}

interface CacheEntry {
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  key: string;
  contentSha256: string;
  content: string;
}

export interface CacheReadResult {
  status: 'hit' | 'miss' | 'corrupt';
  content?: string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createPipelineFingerprint(
  config: Readonly<SVGConfig>,
  optimizationLevel: string
): PipelineFingerprint {
  const optimizerPasses =
    optimizationLevel === 'none'
      ? []
      : [
          'xml-input-safety-v2',
          'basic-cleaning',
          `optimization:${optimizationLevel}`,
        ];
  const policy = {
    unsafeInputPolicy: config.unsafeInputPolicy ?? 'reject',
    maxInputSizeBytes: config.maxInputSizeBytes,
  };
  const pluginGraph = config.plugins.map(plugin => ({
    name: plugin.name,
    options: plugin.options ?? {},
  }));

  return Object.freeze({
    compilerVersion: getPackageInfo().version,
    parser: Object.freeze({ id: 'bounded-svg-xml-scanner', version: '2' }),
    optimizer: Object.freeze({
      passIds: Object.freeze(optimizerPasses),
      version: '1',
      configHash: hashValue(
        stableSerialize({
          level: optimizationLevel,
          performance: config.performance,
        })
      ),
    }),
    frameworkAdapter: Object.freeze({
      id: config.framework,
      version: 'builtin-v1',
    }),
    formatter: Object.freeze({ id: 'framework-template-engine', version: '1' }),
    pluginGraphHash: hashValue(stableSerialize(pluginGraph)),
    policyHash: hashValue(stableSerialize(policy)),
    target: Object.freeze({
      platform: process.platform,
      nodeMajor: process.versions.node.split('.')[0],
    }),
    accessibilityMode: 'legacy',
    namingStrategy: config.outputConfig.naming ?? 'pascal',
    featureFlags: Object.freeze({
      typescript: config.typescript,
      framework: config.framework,
      svelteCompiler: config.svelteCompiler ?? 'legacy',
      stripUnsafeInput: config.unsafeInputPolicy === 'strip',
    }),
    resolvedConfigHash: hashValue(stableSerialize(config)),
  });
}

export function createCacheKey(
  source: string,
  fingerprint: PipelineFingerprint
): string {
  return hashValue(`${source}\0${stableSerialize(fingerprint)}`);
}

export class ContentAddressableCache {
  public constructor(
    private readonly cacheDirectory: string,
    private readonly limits: {
      maxEntries?: number;
      maxBytes?: number;
    } = {}
  ) {
    if (
      (limits.maxEntries !== undefined &&
        (!Number.isSafeInteger(limits.maxEntries) || limits.maxEntries < 1)) ||
      (limits.maxBytes !== undefined &&
        (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 1))
    ) {
      throw new Error('Cache limits must be positive safe integers.');
    }
  }

  public get directory(): string {
    return this.cacheDirectory;
  }

  private entryPath(key: string): string {
    if (!/^[a-f0-9]{64}$/u.test(key)) {
      throw new Error('Invalid cache key.');
    }
    return path.join(this.cacheDirectory, CACHE_SCHEMA_VERSION, `${key}.json`);
  }

  public async read(
    key: string,
    options: { evictCorrupt: boolean }
  ): Promise<CacheReadResult> {
    const entryPath = this.entryPath(key);
    try {
      const parsed = JSON.parse(
        await fs.readFile(entryPath, 'utf8')
      ) as CacheEntry;
      const valid =
        parsed.schemaVersion === CACHE_SCHEMA_VERSION &&
        parsed.key === key &&
        typeof parsed.content === 'string' &&
        parsed.contentSha256 === hashValue(parsed.content);
      if (!valid) {
        if (options.evictCorrupt) await fs.rm(entryPath, { force: true });
        return { status: 'corrupt' };
      }
      return { status: 'hit', content: parsed.content };
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT')
        return { status: 'miss' };
      if (error instanceof SyntaxError) {
        if (options.evictCorrupt) await fs.rm(entryPath, { force: true });
        return { status: 'corrupt' };
      }
      throw error;
    }
  }

  /** Atomic cache write. Callers must invoke this only after artifact commit. */
  public async write(key: string, content: string): Promise<void> {
    const entryPath = this.entryPath(key);
    await fs.mkdir(path.dirname(entryPath), { recursive: true });
    const temporaryPath = `${entryPath}.${process.pid}.${randomUUID()}.tmp`;
    const entry: CacheEntry = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      key,
      contentSha256: hashValue(content),
      content,
    };
    try {
      await fs.writeFile(temporaryPath, `${JSON.stringify(entry)}\n`, 'utf8');
      await fs.rename(temporaryPath, entryPath);
    } finally {
      await fs.rm(temporaryPath, { force: true });
    }
    await this.enforceLimits(path.dirname(entryPath));
  }

  private async enforceLimits(directory: string): Promise<void> {
    const maxEntries = this.limits.maxEntries ?? DEFAULT_MAX_CACHE_ENTRIES;
    const maxBytes = this.limits.maxBytes ?? DEFAULT_MAX_CACHE_BYTES;
    const candidates: Array<{ path: string; size: number; modified: number }> =
      [];
    for (const name of await fs.readdir(directory)) {
      if (!/^[a-f0-9]{64}\.json$/u.test(name)) continue;
      const filePath = path.join(directory, name);
      try {
        const stat = await fs.lstat(filePath);
        if (!stat.isFile()) continue;
        candidates.push({
          path: filePath,
          size: stat.size,
          modified: stat.mtimeMs,
        });
      } catch (error) {
        if ((error as { code?: string }).code !== 'ENOENT') throw error;
      }
    }
    candidates.sort(
      (left, right) =>
        left.modified - right.modified || left.path.localeCompare(right.path)
    );
    let totalBytes = candidates.reduce((total, entry) => total + entry.size, 0);
    while (candidates.length > maxEntries || totalBytes > maxBytes) {
      const oldest = candidates.shift();
      if (!oldest) break;
      try {
        await fs.rm(oldest.path, { force: true });
        totalBytes -= oldest.size;
      } catch (error) {
        if ((error as { code?: string }).code !== 'ENOENT') throw error;
      }
    }
  }
}
