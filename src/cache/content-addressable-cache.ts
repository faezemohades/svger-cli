import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { getPackageInfo } from '../utils/package-info.js';
import type { SVGConfig } from '../types/index.js';

const CACHE_SCHEMA_VERSION = '1.0.0' as const;

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
      : ['input-safety', 'basic-cleaning', `optimization:${optimizationLevel}`];
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
    parser: Object.freeze({ id: 'legacy-raw-svg-gate', version: '1' }),
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
  public constructor(private readonly cacheDirectory: string) {}

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
    const temporaryPath = `${entryPath}.${process.pid}.tmp`;
    const entry: CacheEntry = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      key,
      contentSha256: hashValue(content),
      content,
    };
    await fs.writeFile(temporaryPath, `${JSON.stringify(entry)}\n`, 'utf8');
    await fs.rename(temporaryPath, entryPath);
  }
}
