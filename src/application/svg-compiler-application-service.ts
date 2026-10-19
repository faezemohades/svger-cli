import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { Logger } from '../types/index.js';
import type {
  FrameworkOptions,
  FrameworkType,
  SVGConfig,
  UnsafeInputPolicy,
} from '../types/index.js';
import type { SVGProcessor } from '../processors/svg-processor.js';
import { OptLevel } from '../optimizers/types.js';
import {
  applySVGInputSafety,
  readSVGInputFile,
  resolveOutputArtifactPath,
} from '../security/input-safety.js';
import {
  DiagnosticError,
  ExitCode,
  exitCodeFromUnknown,
} from '../contracts/diagnostics.js';
import type { Diagnostic } from '../contracts/diagnostics.js';
import {
  createBuildReport,
  type BuildMode,
  type BuildReport,
  type GeneratedArtifact,
} from '../contracts/reporting.js';
import {
  resolveConfiguration,
  type ConfigurationLayer,
  type ResolvedConfiguration,
} from '../configuration/resolver.js';
import { runBounded } from './bounded-scheduler.js';
import {
  createBuildPlan,
  type BuildPlanItem,
  type PlannedArtifact,
} from './build-plan.js';
import {
  createBarrelContent,
  getFrameworkArtifactContract,
  moduleSpecifierForFileName,
} from './artifact-contract.js';
import {
  commitOutputTransaction,
  type OutputContent,
} from './output-transaction.js';
import { discoverSVGInputs } from './source-discovery.js';
import {
  createCacheKey,
  createPipelineFingerprint,
  type ContentAddressableCache,
  type PipelineFingerprint,
} from '../cache/content-addressable-cache.js';

export interface BuildRequest {
  src: string;
  out: string;
  config?: Partial<SVGConfig>;
  framework?: FrameworkType;
  frameworkOptions?: FrameworkOptions;
  optimize?: string;
  typescript?: boolean;
  maxInputSizeBytes?: number;
  unsafeInputPolicy?: UnsafeInputPolicy;
  mode?: BuildMode;
  collision?: 'error' | 'first' | 'last';
  recursive?: boolean;
  include?: readonly string[];
  exclude?: readonly string[];
  includeHidden?: boolean;
  symlinks?: 'ignore' | 'follow' | 'error';
  maxFileCount?: number;
  concurrency?: number;
  batchSize?: number;
  preserveCommitOrder?: boolean;
  signal?: AbortSignal;
}

export interface ApplicationServiceContext {
  cwd: string;
  defaultConfig: SVGConfig;
  configurationLayers: readonly ConfigurationLayer[];
  processor: SVGProcessor;
  logger: Logger;
  cache: ContentAddressableCache;
  isLocked(filePath: string): boolean;
}

interface GeneratedWork {
  item: BuildPlanItem;
  artifact?: GeneratedArtifact;
  content?: string;
  diagnostic?: Diagnostic;
  cacheKey?: string;
  cacheStatus?: 'hit' | 'miss' | 'corrupt';
}

const OPTIMIZATION_LEVELS: Readonly<Record<string, OptLevel>> = Object.freeze({
  none: OptLevel.NONE,
  basic: OptLevel.BASIC,
  balanced: OptLevel.BALANCED,
  aggressive: OptLevel.AGGRESSIVE,
  maximum: OptLevel.MAXIMUM,
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function relativePortable(cwd: string, filePath: string): string {
  return path
    .relative(cwd, filePath)
    .split(path.sep)
    .join('/')
    .normalize('NFC');
}

function requestConfiguration(request: BuildRequest): Partial<SVGConfig> {
  return {
    ...(request.config ?? {}),
    ...(request.framework === undefined
      ? {}
      : { framework: request.framework }),
    ...(request.frameworkOptions === undefined
      ? {}
      : {
          frameworkOptions: {
            ...(request.config?.frameworkOptions ?? {}),
            ...request.frameworkOptions,
          },
        }),
    ...(request.typescript === undefined
      ? {}
      : { typescript: request.typescript }),
    ...(request.maxInputSizeBytes === undefined
      ? {}
      : { maxInputSizeBytes: request.maxInputSizeBytes }),
    ...(request.unsafeInputPolicy === undefined
      ? {}
      : { unsafeInputPolicy: request.unsafeInputPolicy }),
  } as Partial<SVGConfig>;
}

function normalizeFailure(error: unknown, file?: string): DiagnosticError {
  if (error instanceof DiagnosticError) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : 'E_BUILD_EXECUTION';
  let exitCode = ExitCode.InternalError;
  if (code === 'E_SVG_INPUT_TOO_LARGE') exitCode = ExitCode.InvalidSVGInput;
  else if (code.startsWith('E_UNSAFE_')) exitCode = ExitCode.SecurityViolation;
  else if (code.startsWith('E_OUTPUT_')) exitCode = ExitCode.FilesystemFailure;

  return new DiagnosticError(
    code,
    error instanceof Error ? error.message : String(error),
    { exitCode, file, cause: error }
  );
}

/** Canonical v4.1 orchestration path shared by CLI and public APIs. */
export class SVGCompilerApplicationService {
  public constructor(private readonly context: ApplicationServiceContext) {}

  public resolveConfig(request: BuildRequest): ResolvedConfiguration {
    return resolveConfiguration(this.context.defaultConfig, [
      ...this.context.configurationLayers,
      { origin: 'request', value: requestConfiguration(request) },
    ]);
  }

  public async build(request: BuildRequest): Promise<BuildReport> {
    try {
      return await this.executeBuild(request);
    } catch (error) {
      const normalized = normalizeFailure(error);
      return createBuildReport({
        mode: request.mode,
        exitCode: normalized.exitCode,
        diagnostics: [normalized.toDiagnostic()],
      });
    }
  }

  private async executeBuild(request: BuildRequest): Promise<BuildReport> {
    this.validateRequest(request);
    const cwd = this.context.cwd;
    const sourceDir = path.resolve(cwd, request.src);
    const outputDir = path.resolve(cwd, request.out);
    const resolved = this.resolveConfig(request);
    const config = resolved.config;
    const mode = request.mode ?? 'write';
    const sources = await discoverSVGInputs({
      sourceDir,
      outputDir,
      recursive: request.recursive ?? false,
      include: request.include ?? config.include,
      exclude: request.exclude ?? config.exclude,
      includeHidden: request.includeHidden,
      symlinks: request.symlinks,
      maxFileCount: request.maxFileCount,
      signal: request.signal,
    });

    const extension = this.context.processor.getFileExtension(
      config.framework,
      config.typescript
    );
    const artifactContract = getFrameworkArtifactContract(config.framework);
    const naming = config.outputConfig.naming ?? 'pascal';
    const componentNaming = naming === 'kebab' ? 'pascal' : naming;
    const plan = createBuildPlan(
      sources,
      outputDir,
      {
        componentName: fileName =>
          this.context.processor.generateComponentName(
            fileName,
            componentNaming
          ),
        outputFileName: componentName =>
          this.context.processor.generateFileName(
            componentName,
            extension,
            naming
          ),
        exportStyle: () => artifactContract.componentExportStyle,
        exportedName: componentName =>
          artifactContract.exportedName(componentName),
        moduleSpecifier: (_componentName, outputFileName) =>
          moduleSpecifierForFileName(
            outputFileName,
            config.framework,
            config.typescript
          ),
      },
      request.collision,
      {
        framework: config.framework,
        typescript: config.typescript,
        ...(artifactContract.barrel && {
          barrelFileName: `index.${config.typescript ? 'ts' : 'js'}`,
        }),
      }
    );

    if (plan.items.length === 0) {
      return createBuildReport({
        mode,
        discovered: sources.length,
        diagnostics: [
          ...plan.diagnostics,
          {
            code: 'W_NO_SVG_FILES',
            severity: 'warning',
            message: 'No SVG files matched the build request.',
          },
        ],
      });
    }

    const optimizationLevel = request.optimize ?? 'basic';
    const optimizerLevel = OPTIMIZATION_LEVELS[optimizationLevel];
    const fingerprint = createPipelineFingerprint(config, optimizationLevel);

    const startRss = process.memoryUsage().rss;
    const work = await runBounded(
      plan.items,
      item =>
        this.generateItem(
          item,
          config,
          mode,
          fingerprint,
          optimizerLevel,
          request.signal
        ),
      {
        concurrency: request.concurrency ?? config.maxConcurrency,
        batchSize: request.batchSize ?? config.batchSize,
        preserveOrder: request.preserveCommitOrder ?? true,
        signal: request.signal,
      }
    );
    const peakRssBytes = Math.max(startRss, process.memoryUsage().rss);
    const diagnostics = [
      ...plan.diagnostics,
      ...work.flatMap(result =>
        result.diagnostic === undefined ? [] : [result.diagnostic]
      ),
      ...work.flatMap<Diagnostic>(result =>
        result.cacheStatus === 'hit'
          ? [
              {
                code: 'I_CACHE_HIT',
                severity: 'info',
                message: `Reused cached output for ${result.item.relativePath}.`,
                file: result.item.relativePath,
              },
            ]
          : result.cacheStatus === 'corrupt'
            ? [
                {
                  code: 'W_CACHE_CORRUPT',
                  severity: 'warning',
                  message: `Ignored a corrupt cache entry for ${result.item.relativePath}.`,
                  file: result.item.relativePath,
                },
              ]
            : []
      ),
    ];
    const artifacts = work.flatMap(result =>
      result.artifact === undefined ? [] : [result.artifact]
    );
    const failures = work.filter(
      result => result.diagnostic?.severity === 'error'
    );

    if (failures.length > 0) {
      const firstFailure = failures[0].diagnostic;
      return createBuildReport({
        mode,
        discovered: sources.length,
        exitCode: this.exitCodeForDiagnostic(firstFailure),
        artifacts,
        diagnostics,
      });
    }

    const outputContents: OutputContent[] = work.flatMap(result =>
      result.content === undefined || result.artifact?.status === 'unchanged'
        ? []
        : [
            {
              outputFileName: result.item.outputFileName,
              content: result.content,
            },
          ]
    );
    const barrelItems: BuildPlanItem[] = [];
    for (const result of work) {
      if (result.content !== undefined) {
        barrelItems.push(result.item);
      } else if (result.artifact?.status === 'skipped') {
        try {
          await fs.access(result.item.outputPath);
          barrelItems.push(result.item);
        } catch {
          // A locked source without an existing component is not a barrel export.
        }
      }
    }
    const indexWork = await this.createIndexWork(
      plan.artifacts,
      barrelItems,
      mode
    );
    if (indexWork) {
      artifacts.push(indexWork.artifact);
      if (indexWork.artifact.status !== 'unchanged') {
        outputContents.push({
          outputFileName: indexWork.outputFileName,
          content: indexWork.content,
        });
      }
    }

    const stale = artifacts.some(artifact =>
      ['created', 'updated'].includes(artifact.status)
    );
    if (mode === 'check' || mode === 'diff') {
      if (mode === 'diff') {
        diagnostics.push(
          ...artifacts
            .filter(artifact => artifact.status !== 'unchanged')
            .map<Diagnostic>(artifact => ({
              code: 'I_OUTPUT_DIFF',
              severity: 'info',
              message: `${artifact.output} would be ${artifact.status}.`,
              file: artifact.source,
              metadata: { sha256: artifact.sha256 },
            }))
        );
      }
      return createBuildReport({
        mode,
        discovered: sources.length,
        exitCode: stale ? ExitCode.StaleOutput : ExitCode.Success,
        artifacts,
        diagnostics,
      });
    }

    if (mode === 'write') {
      await commitOutputTransaction(outputDir, outputContents);
      if (config.cache) {
        for (const result of work) {
          if (
            result.cacheKey &&
            result.content &&
            result.cacheStatus !== 'hit'
          ) {
            try {
              await this.context.cache.write(result.cacheKey, result.content);
            } catch (error) {
              diagnostics.push({
                code: 'W_CACHE_WRITE_FAILED',
                severity: 'warning',
                message: `Unable to cache ${result.item.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
                file: result.item.relativePath,
              });
            }
          }
        }
      }
    } else {
      artifacts.forEach(artifact => {
        if (artifact.status !== 'unchanged') artifact.status = 'planned';
      });
    }

    diagnostics.push({
      code: 'I_BUILD_MEMORY',
      severity: 'info',
      message: 'Build memory usage was measured.',
      metadata: { peakRssBytes },
    });
    return createBuildReport({
      mode,
      discovered: sources.length,
      artifacts,
      diagnostics,
    });
  }

  private validateRequest(request: BuildRequest): void {
    if (!request.src || !request.out) {
      throw new DiagnosticError(
        'E_USAGE_BUILD_PATHS',
        'Both source and output paths are required.',
        { exitCode: ExitCode.UsageError }
      );
    }
    if (
      request.optimize !== undefined &&
      (typeof request.optimize !== 'string' ||
        !Object.hasOwn(OPTIMIZATION_LEVELS, request.optimize))
    ) {
      throw new DiagnosticError(
        'E_INVALID_OPTIMIZATION_LEVEL',
        `Unknown optimization level: ${request.optimize}`,
        { exitCode: ExitCode.InvalidConfiguration }
      );
    }
    if (
      request.mode !== undefined &&
      !['write', 'dry-run', 'check', 'diff'].includes(request.mode)
    ) {
      throw new DiagnosticError('E_INVALID_BUILD_MODE', 'Invalid build mode.', {
        exitCode: ExitCode.UsageError,
      });
    }
    for (const [name, value] of [
      ['maxFileCount', request.maxFileCount],
      ['concurrency', request.concurrency],
      ['batchSize', request.batchSize],
    ] as const) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
        throw new DiagnosticError(
          'E_INVALID_CONFIGURATION',
          `${name} must be a positive safe integer.`,
          { exitCode: ExitCode.InvalidConfiguration }
        );
      }
    }
    if (
      request.include !== undefined &&
      (!Array.isArray(request.include) ||
        !request.include.every(item => typeof item === 'string'))
    ) {
      throw new DiagnosticError(
        'E_INVALID_CONFIGURATION',
        'include must be an array of strings.',
        {
          exitCode: ExitCode.InvalidConfiguration,
        }
      );
    }
    if (
      request.exclude !== undefined &&
      (!Array.isArray(request.exclude) ||
        !request.exclude.every(item => typeof item === 'string'))
    ) {
      throw new DiagnosticError(
        'E_INVALID_CONFIGURATION',
        'exclude must be an array of strings.',
        {
          exitCode: ExitCode.InvalidConfiguration,
        }
      );
    }
  }

  private async generateItem(
    item: BuildPlanItem,
    config: Readonly<SVGConfig>,
    mode: BuildMode,
    fingerprint: PipelineFingerprint,
    optimizationLevel: OptLevel,
    signal?: AbortSignal
  ): Promise<GeneratedWork> {
    if (signal?.aborted) {
      return {
        item,
        diagnostic: new DiagnosticError(
          'E_BUILD_CANCELLED',
          'Build was cancelled.',
          { exitCode: ExitCode.BuildCancelled, file: item.relativePath }
        ).toDiagnostic(),
      };
    }
    if (this.context.isLocked(item.absolutePath)) {
      return {
        item,
        artifact: {
          source: relativePortable(this.context.cwd, item.absolutePath),
          output: relativePortable(this.context.cwd, item.outputPath),
          componentName: item.componentName,
          status: 'skipped',
          byteLength: 0,
          sha256: sha256(''),
        },
        diagnostic: {
          code: 'W_SOURCE_LOCKED',
          severity: 'warning',
          message: 'Locked source was skipped.',
          file: item.relativePath,
        },
      };
    }

    try {
      const svgContent = applySVGInputSafety(
        await readSVGInputFile(
          item.absolutePath,
          config.maxInputSizeBytes,
          item.relativePath
        ),
        {
          maxInputSizeBytes: config.maxInputSizeBytes,
          source: item.relativePath,
          unsafeInputPolicy: config.unsafeInputPolicy,
        }
      );
      const cacheKey = createCacheKey(
        `${item.componentName}\0${svgContent}`,
        fingerprint
      );
      const cached = config.cache
        ? await this.context.cache.read(cacheKey, {
            evictCorrupt: mode === 'write',
          })
        : { status: 'miss' as const };
      const content =
        cached.status === 'hit' && cached.content !== undefined
          ? cached.content
          : await this.context.processor.generateComponent(
              item.componentName,
              svgContent,
              {
                framework: config.framework,
                typescript: config.typescript,
                frameworkOptions: config.frameworkOptions,
                defaultWidth: config.defaultWidth,
                defaultHeight: config.defaultHeight,
                defaultFill: config.defaultFill,
                namingConvention: config.outputConfig.naming,
                styleRules: Object.fromEntries(
                  Object.entries(config.styleRules).filter(
                    ([, value]) => value !== undefined
                  )
                ) as Record<string, string>,
                maxInputSizeBytes: config.maxInputSizeBytes,
                unsafeInputPolicy: config.unsafeInputPolicy,
                optimizationLevel,
                signal,
              }
            );
      const status = await this.determineStatus(item.outputPath, content);
      return {
        item,
        content,
        cacheKey,
        cacheStatus: cached.status,
        artifact: {
          source: relativePortable(this.context.cwd, item.absolutePath),
          output: relativePortable(this.context.cwd, item.outputPath),
          componentName: item.componentName,
          status:
            mode === 'dry-run' && status !== 'unchanged' ? 'planned' : status,
          byteLength: Buffer.byteLength(content),
          sha256: sha256(content),
        },
      };
    } catch (error) {
      return {
        item,
        diagnostic: normalizeFailure(error, item.relativePath).toDiagnostic(),
      };
    }
  }

  private async createIndexWork(
    plannedArtifacts: readonly PlannedArtifact[],
    items: readonly BuildPlanItem[],
    mode: BuildMode
  ): Promise<
    | {
        artifact: GeneratedArtifact;
        content: string;
        outputFileName: string;
      }
    | undefined
  > {
    const plannedBarrel = plannedArtifacts.find(
      artifact => artifact.role === 'barrel'
    );
    if (!plannedBarrel) return undefined;
    const framework = plannedBarrel.framework;
    if (!framework) return undefined;
    const content = createBarrelContent(framework, items);
    const outputFileName = plannedBarrel.fileName;
    const outputPath = resolveOutputArtifactPath(
      path.dirname(plannedBarrel.outputPath),
      path.basename(plannedBarrel.outputPath)
    );
    const status = await this.determineStatus(outputPath, content);
    return {
      outputFileName,
      content,
      artifact: {
        source: '<build>',
        output: relativePortable(this.context.cwd, outputPath),
        componentName: 'index',
        status:
          mode === 'dry-run' && status !== 'unchanged' ? 'planned' : status,
        byteLength: Buffer.byteLength(content),
        sha256: sha256(content),
      },
    };
  }

  private async determineStatus(
    outputPath: string,
    content: string
  ): Promise<'created' | 'updated' | 'unchanged'> {
    const safePath = resolveOutputArtifactPath(
      path.dirname(outputPath),
      path.basename(outputPath)
    );
    try {
      const existing = await fs.readFile(safePath, 'utf8');
      return existing === content ? 'unchanged' : 'updated';
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return 'created';
      throw error;
    }
  }

  private exitCodeForDiagnostic(diagnostic?: Diagnostic): ExitCode {
    if (!diagnostic) return ExitCode.InternalError;
    return exitCodeFromUnknown({ code: diagnostic.code });
  }
}
