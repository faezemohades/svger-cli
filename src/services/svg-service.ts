import path from 'path';
import { promises as fs } from 'fs';
import { FileSystem } from '../utils/native.js';
import {
  BuildOptions,
  GenerateOptions,
  WatchOptions,
  FileWatchEvent,
  FrameworkOptions,
  SVGConfig,
} from '../types/index.js';
import { logger } from '../core/logger.js';
import { configService } from './config.js';
import { svgProcessor } from '../processors/svg-processor.js';
import { frameworkTemplateEngine } from '../core/framework-templates.js';
import { fileWatcher } from './file-watcher.js';
import { OptLevel } from '../optimizers/types.js';
import { resolveOutputArtifactPath } from '../security/input-safety.js';
import type { UnsafeInputPolicy } from '../types/index.js';
import { resolveConfiguration } from '../configuration/resolver.js';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';
import {
  createBuildPlan,
  type BuildPlanItem,
} from '../application/build-plan.js';
import {
  commitOutputTransaction,
  type OutputContent,
} from '../application/output-transaction.js';
import {
  createBarrelContent,
  getFrameworkArtifactContract,
  moduleSpecifierForFileName,
} from '../application/artifact-contract.js';

type RuntimeProcessingOverrides = {
  framework?: SVGConfig['framework'];
  frameworkOptions?: FrameworkOptions;
  optimize?: string;
  typescript?: boolean;
  maxInputSizeBytes?: number;
  unsafeInputPolicy?: UnsafeInputPolicy;
};

type BuildRequestOptions = BuildOptions & RuntimeProcessingOverrides;
type GenerateRequestOptions = GenerateOptions & RuntimeProcessingOverrides;
type ResolvedRuntimeConfig = SVGConfig & RuntimeProcessingOverrides;

const OPTIMIZATION_LEVELS = new Set([
  'none',
  'basic',
  'balanced',
  'aggressive',
  'maximum',
]);

function validateOptimizationLevel(level: string | undefined): void {
  if (level !== undefined && !OPTIMIZATION_LEVELS.has(level.toLowerCase())) {
    throw new DiagnosticError(
      'E_INVALID_OPTIMIZATION_LEVEL',
      'Optimization level must be none, basic, balanced, aggressive, or maximum.',
      { exitCode: ExitCode.InvalidConfiguration }
    );
  }
}

function optimizationLevel(level: string | undefined): OptLevel | undefined {
  validateOptimizationLevel(level);
  return level === undefined ? undefined : (level.toLowerCase() as OptLevel);
}

/**
 * Main SVG service that orchestrates all SVG processing operations
 */
export class SVGService {
  private static instance: SVGService;
  private activeWatchers: Set<string> = new Set();
  private activeWatchJobs = new Map<string, AbortController>();
  private watchJobControllers = new Map<string, Set<AbortController>>();
  private watchAbortListeners = new Map<
    string,
    { signal: AbortSignal; listener: () => void }
  >();
  public lockService: LockService;

  private constructor() {
    this.lockService = LockService.getInstance();
  }

  public static getInstance(): SVGService {
    if (!SVGService.instance) {
      SVGService.instance = new SVGService();
    }
    return SVGService.instance;
  }

  /**
   * Set optimizer level for SVG processing
   */
  public setOptimizerLevel(level: string): void {
    validateOptimizationLevel(level);
    svgProcessor.setOptimizationLevel(level.toLowerCase() as OptLevel);
  }

  private mergeRuntimeConfig(
    configOverrides: Partial<SVGConfig> | undefined,
    runtimeOverrides: RuntimeProcessingOverrides
  ): ResolvedRuntimeConfig {
    const resolved = resolveConfiguration(configService.getDefaultConfig(), [
      { origin: 'configuration-file', value: configService.readConfig() },
      {
        origin: 'request',
        value: {
          ...(configOverrides ?? {}),
          ...(runtimeOverrides.framework === undefined
            ? {}
            : { framework: runtimeOverrides.framework }),
          ...(runtimeOverrides.typescript === undefined
            ? {}
            : { typescript: runtimeOverrides.typescript }),
          ...(runtimeOverrides.frameworkOptions === undefined
            ? {}
            : { frameworkOptions: runtimeOverrides.frameworkOptions }),
          ...(runtimeOverrides.maxInputSizeBytes === undefined
            ? {}
            : { maxInputSizeBytes: runtimeOverrides.maxInputSizeBytes }),
          ...(runtimeOverrides.unsafeInputPolicy === undefined
            ? {}
            : { unsafeInputPolicy: runtimeOverrides.unsafeInputPolicy }),
        },
      },
    ]);
    return {
      ...resolved.config,
      ...(runtimeOverrides.optimize === undefined
        ? {}
        : { optimize: runtimeOverrides.optimize }),
    };
  }

  /**
   * Build all SVG files from source to output directory
   */
  public async buildAll(options: BuildRequestOptions): Promise<void> {
    logger.info('Starting SVG build process');
    logger.info(`Source: ${options.src}`);
    logger.info(`Output: ${options.out}`);

    const srcDir = path.resolve(options.src);
    const outDir = path.resolve(options.out);

    // Validate source directory
    if (!(await FileSystem.exists(srcDir))) {
      throw new Error(`Source folder not found: ${srcDir}`);
    }

    // Get configuration - merge config file with options
    const mergedConfig = this.mergeRuntimeConfig(options.config, options);

    const optimizeLevel = optimizationLevel(mergedConfig.optimize);
    if (mergedConfig.optimize !== undefined) {
      logger.info(`Using optimization level: ${mergedConfig.optimize}`);
    }

    // Read all SVG files
    const files = await FileSystem.readDir(srcDir);
    const svgFiles = files.filter((file: string) => file.endsWith('.svg'));

    if (svgFiles.length === 0) {
      logger.warn('No SVG files found in source directory');
      return;
    }

    logger.info(`Found ${svgFiles.length} SVG files to process`);

    const extension = frameworkTemplateEngine.getFileExtension(
      mergedConfig.framework,
      mergedConfig.typescript
    );
    const artifactContract = getFrameworkArtifactContract(
      mergedConfig.framework
    );
    const naming = mergedConfig.outputConfig?.naming || 'pascal';
    const componentNaming = naming === 'kebab' ? 'pascal' : naming;
    const plan = createBuildPlan(
      svgFiles.map(file => ({
        absolutePath: path.join(srcDir, file),
        relativePath: file,
      })),
      outDir,
      {
        componentName: fileName =>
          svgProcessor.generateComponentName(fileName, componentNaming),
        outputFileName: componentName =>
          svgProcessor.generateFileName(componentName, extension, naming),
        exportStyle: () => artifactContract.componentExportStyle,
        exportedName: componentName =>
          artifactContract.exportedName(componentName),
        moduleSpecifier: (_componentName, outputFileName) =>
          moduleSpecifierForFileName(
            outputFileName,
            mergedConfig.framework,
            mergedConfig.typescript
          ),
      },
      'error',
      {
        framework: mergedConfig.framework,
        typescript: mergedConfig.typescript,
        ...(artifactContract.barrel && {
          barrelFileName: `index.${mergedConfig.typescript ? 'ts' : 'js'}`,
        }),
      }
    );

    // Complete planning and collision validation before creating or modifying
    // the output directory.
    await fs.mkdir(path.dirname(outDir), { recursive: true });
    const stageDir = await fs.mkdtemp(
      path.join(path.dirname(outDir), '.svger-service-stage-')
    );
    try {
      const results: Array<{ success: boolean; file: string; error?: Error }> =
        [];
      const barrelItems: BuildPlanItem[] = [];

      // Process each SVG file
      for (const item of plan.items) {
        const file = item.relativePath;
        const svgPath = item.absolutePath;

        // Check if file is locked
        if (this.lockService.isLocked(svgPath)) {
          logger.warn(`Skipped locked file: ${file}`);
          if (await FileSystem.exists(item.outputPath)) barrelItems.push(item);
          continue;
        }

        try {
          const processingResult = await svgProcessor.processSVGFile(
            svgPath,
            stageDir,
            {
              framework: mergedConfig.framework,
              typescript: mergedConfig.typescript,
              frameworkOptions: mergedConfig.frameworkOptions,
              defaultWidth: mergedConfig.defaultWidth,
              defaultHeight: mergedConfig.defaultHeight,
              defaultFill: mergedConfig.defaultFill,
              namingConvention: naming,
              styleRules: Object.fromEntries(
                Object.entries(mergedConfig.styleRules || {}).filter(
                  ([, v]) => v !== undefined
                )
              ) as Record<string, string>,
              maxInputSizeBytes: mergedConfig.maxInputSizeBytes,
              unsafeInputPolicy: mergedConfig.unsafeInputPolicy,
              optimizationLevel: optimizeLevel,
            }
          );

          results.push({
            success: processingResult.success,
            file,
            error: processingResult.error,
          });
          if (processingResult.success) barrelItems.push(item);
        } catch (error) {
          logger.error(`Failed to process ${file}.`);
          results.push({
            success: false,
            file,
            error: error as Error,
          });
        }
      }

      // Log summary - single pass through results
      const successfulResults: typeof results = [];
      const failedResults: typeof results = [];

      for (const result of results) {
        if (result.success) {
          successfulResults.push(result);
        } else {
          failedResults.push(result);
        }
      }

      logger.info(
        `Build complete: ${successfulResults.length} successful, ${failedResults.length} failed`
      );

      if (failedResults.length > 0) {
        logger.warn('Some files failed to process:');
        failedResults.forEach(r => {
          logger.warn(`  - ${r.file}: generation failed`);
        });
        throw failedResults[0].error ?? new Error('SVG build failed.');
      }

      // Generate index.ts file with all component exports
      // This includes both newly generated components and existing locked components
      await this.generateIndexFile(stageDir, mergedConfig, barrelItems);
      const stagedFiles = await fs.readdir(stageDir);
      const outputContents: OutputContent[] = await Promise.all(
        stagedFiles.map(async outputFileName => ({
          outputFileName,
          content: await fs.readFile(
            path.join(stageDir, outputFileName),
            'utf8'
          ),
        }))
      );
      await commitOutputTransaction(outDir, outputContents);
    } finally {
      await fs.rm(stageDir, { recursive: true, force: true });
    }
  }

  /**
   * Generate a React component from a single SVG file
   */
  public async generateSingle(options: GenerateRequestOptions): Promise<void> {
    logger.info(`Generating component from: ${options.svgFile}`);

    const filePath = path.resolve(options.svgFile);
    const outDir = path.resolve(options.outDir);

    // Validate SVG file
    if (!(await FileSystem.exists(filePath))) {
      throw new Error(`SVG file not found: ${filePath}`);
    }

    // Check if file is locked
    if (this.lockService.isLocked(filePath)) {
      logger.warn(`File is locked: ${path.basename(options.svgFile)}`);
      return;
    }

    // Get configuration
    const mergedConfig = this.mergeRuntimeConfig(options.config, options);
    const optimizeLevel = optimizationLevel(mergedConfig.optimize);
    if (mergedConfig.optimize !== undefined) {
      logger.info(`Using optimization level: ${mergedConfig.optimize}`);
    }

    // Process the file
    const result = await svgProcessor.processSVGFile(filePath, outDir, {
      framework: mergedConfig.framework,
      typescript: mergedConfig.typescript,
      frameworkOptions: mergedConfig.frameworkOptions,
      defaultWidth: mergedConfig.defaultWidth,
      defaultHeight: mergedConfig.defaultHeight,
      defaultFill: mergedConfig.defaultFill,
      namingConvention: mergedConfig.outputConfig?.naming || 'pascal',
      styleRules: Object.fromEntries(
        Object.entries(mergedConfig.styleRules || {}).filter(
          ([, v]) => v !== undefined
        )
      ) as Record<string, string>,
      maxInputSizeBytes: mergedConfig.maxInputSizeBytes,
      unsafeInputPolicy: mergedConfig.unsafeInputPolicy,
      optimizationLevel: optimizeLevel,
    });

    if (!result.success) {
      throw result.error || new Error('Failed to generate component');
    }

    logger.success(`Component generated: ${result.componentName}`);
  }

  /**
   * Start watching SVG files for changes
   */
  public async startWatching(options: WatchOptions): Promise<string> {
    logger.info('Starting watch mode');
    logger.info(`Watching: ${options.src}`);
    logger.info(`Output: ${options.out}`);

    const srcDir = path.resolve(options.src);
    const outDir = path.resolve(options.out);

    // Validate source directory
    if (!(await FileSystem.exists(srcDir))) {
      throw new Error(`Source folder not found: ${srcDir}`);
    }

    // Start watching
    const mergedConfig = this.mergeRuntimeConfig(options.config, options);
    const watchId = await fileWatcher.watchDirectory(srcDir, {
      ...options,
      config: mergedConfig,
    });
    this.activeWatchers.add(watchId);

    // Register event handler
    fileWatcher.onFileEvent(watchId, async (event: FileWatchEvent) => {
      await this.handleWatchEvent(watchId, event, outDir, mergedConfig);
    });

    if (options.signal) {
      if (options.signal.aborted) {
        this.stopWatching(watchId);
        throw Object.assign(new Error('Watch operation was cancelled.'), {
          code: 'ABORT_ERR',
          cause: options.signal.reason,
        });
      }
      const listener = () => this.stopWatching(watchId);
      this.watchAbortListeners.set(watchId, {
        signal: options.signal,
        listener,
      });
      options.signal.addEventListener('abort', listener, { once: true });
    }

    logger.success(`Watch mode active - waiting for file changes...`);
    return watchId;
  }

  /**
   * Handle file watch events
   */
  private async handleWatchEvent(
    watchId: string,
    event: FileWatchEvent,
    outDir: string,
    config?: Partial<SVGConfig>
  ): Promise<void> {
    const fileName = path.basename(event.filePath);

    // Object lookup map for event handlers - O(1) performance
    const eventHandlers: Record<string, () => Promise<void>> = {
      add: async () => {
        logger.info(`New SVG detected: ${fileName}`);
        await this.processWatchedFile(event.filePath, outDir, config, watchId);
      },
      change: async () => {
        logger.info(`SVG updated: ${fileName}`);
        await this.processWatchedFile(event.filePath, outDir, config, watchId);
      },
      unlink: async () => {
        logger.info(`SVG removed: ${fileName}`);
        await this.handleFileRemoval(event.filePath, outDir, config);
      },
    };

    const handler = eventHandlers[event.type];
    if (handler) {
      await handler();
    }
  }

  /**
   * Process a watched file
   */
  private async processWatchedFile(
    filePath: string,
    outDir: string,
    config?: Partial<SVGConfig>,
    watchId?: string
  ): Promise<void> {
    // Supersede work only within the same watcher registration. Two watchers
    // may intentionally observe the same source path with independent lifetimes.
    const jobKey = watchId ? `${watchId}\0${filePath}` : filePath;
    const previousController = this.activeWatchJobs.get(jobKey);
    previousController?.abort('Superseded by a newer watch event.');
    const controller = new AbortController();
    this.activeWatchJobs.set(jobKey, controller);
    if (watchId) {
      const controllers = this.watchJobControllers.get(watchId) ?? new Set();
      controllers.add(controller);
      this.watchJobControllers.set(watchId, controllers);
    }
    try {
      // Check if file is locked
      if (this.lockService.isLocked(filePath)) {
        logger.warn(`Skipped locked file: ${path.basename(filePath)}`);
        return;
      }

      const mergedConfig = this.mergeRuntimeConfig(config, {});

      // Process the file
      const result = await svgProcessor.processSVGFile(filePath, outDir, {
        framework: mergedConfig.framework,
        typescript: mergedConfig.typescript,
        frameworkOptions: mergedConfig.frameworkOptions,
        defaultWidth: mergedConfig.defaultWidth,
        defaultHeight: mergedConfig.defaultHeight,
        defaultFill: mergedConfig.defaultFill,
        styleRules: Object.fromEntries(
          Object.entries(mergedConfig.styleRules || {}).filter(
            ([, v]) => v !== undefined
          )
        ) as Record<string, string>,
        maxInputSizeBytes: mergedConfig.maxInputSizeBytes,
        unsafeInputPolicy: mergedConfig.unsafeInputPolicy,
        optimizationLevel: optimizationLevel(mergedConfig.optimize),
        signal: controller.signal,
      });
      if (!result.success && result.error) {
        const code = (result.error as { code?: string }).code;
        if (code !== 'ABORT_ERR') throw result.error;
      }
    } catch (error) {
      if ((error as { code?: string }).code === 'ABORT_ERR') return;
      logger.error(
        `Failed to process watched file ${path.basename(filePath)}.`
      );
    } finally {
      if (this.activeWatchJobs.get(jobKey) === controller) {
        this.activeWatchJobs.delete(jobKey);
      }
      if (watchId) {
        const controllers = this.watchJobControllers.get(watchId);
        controllers?.delete(controller);
        if (controllers?.size === 0) this.watchJobControllers.delete(watchId);
      }
    }
  }

  /**
   * Handle file removal in watch mode
   */
  private async handleFileRemoval(
    filePath: string,
    outDir: string,
    config?: Partial<SVGConfig>
  ): Promise<void> {
    try {
      const mergedConfig = this.mergeRuntimeConfig(config, {});

      const namingConvention = mergedConfig.outputConfig?.naming || 'pascal';
      const framework = mergedConfig.framework || 'react';
      const typescript = mergedConfig.typescript !== false;
      const extension = frameworkTemplateEngine.getFileExtension(
        framework,
        typescript
      );

      const componentName = svgProcessor.generateComponentName(
        path.basename(filePath),
        namingConvention === 'kebab' ? 'pascal' : namingConvention
      );
      const componentPath = resolveOutputArtifactPath(
        outDir,
        svgProcessor.generateFileName(
          componentName,
          extension,
          namingConvention
        )
      );

      if (await FileSystem.exists(componentPath)) {
        await FileSystem.unlink(componentPath);
        logger.success(
          `Removed component: ${svgProcessor.generateFileName(componentName, extension, namingConvention)}`
        );
      }
    } catch (error) {
      logger.error(
        `Failed to remove component for ${path.basename(filePath)}.`
      );
    }
  }

  /**
   * Stop watching files
   */
  public stopWatching(watchId?: string): void {
    if (watchId) {
      fileWatcher.stopWatching(watchId);
      this.activeWatchers.delete(watchId);
      for (const controller of this.watchJobControllers.get(watchId) ?? []) {
        controller.abort('Watcher stopped.');
      }
      this.watchJobControllers.delete(watchId);
      const abortRegistration = this.watchAbortListeners.get(watchId);
      abortRegistration?.signal.removeEventListener(
        'abort',
        abortRegistration.listener
      );
      this.watchAbortListeners.delete(watchId);
    } else {
      // Stop all watchers
      for (const id of [...this.activeWatchers]) this.stopWatching(id);
    }
  }

  /**
   * Clean output directory
   */
  public async clean(outDir: string): Promise<void> {
    const targetDir = path.resolve(outDir);

    if (!(await FileSystem.exists(targetDir))) {
      logger.warn(`Directory not found: ${targetDir}`);
      return;
    }

    await FileSystem.emptyDir(targetDir);
    logger.success(`Cleaned all generated SVG components in: ${targetDir}`);
  }

  /**
   * Generate index.ts file with all component exports
   * Scans the output directory for all existing component files,
   * including those from locked SVGs that weren't regenerated
   */
  private async generateIndexFile(
    outDir: string,
    config?: Partial<SVGConfig>,
    plannedComponents: readonly BuildPlanItem[] = []
  ): Promise<void> {
    try {
      const framework = config?.framework;
      if (!framework || plannedComponents.length === 0) {
        logger.warn(
          'No component files found in output directory for index generation'
        );
        return;
      }
      const componentNames = plannedComponents.map(item => item.componentName);
      const indexContent = this.generateIndexContent(
        framework,
        plannedComponents
      );
      const indexExtension = config.typescript === false ? 'js' : 'ts';
      const indexPath = resolveOutputArtifactPath(
        outDir,
        `index.${indexExtension}`
      );

      await FileSystem.writeFile(indexPath, indexContent, 'utf-8');
      logger.success(
        `Generated index.${indexExtension} with ${componentNames.length} component exports`
      );
    } catch (error) {
      logger.error('Failed to generate component index.');
      throw error;
    }
  }

  /**
   * Generate the content for index.ts file
   */
  private generateIndexContent(
    framework: NonNullable<SVGConfig['framework']>,
    components: readonly BuildPlanItem[]
  ): string {
    return createBarrelContent(framework, components);
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    activeWatchers: number;
    processingQueue: ReturnType<typeof svgProcessor.getProcessingStats>;
    watcherStats: ReturnType<typeof fileWatcher.getWatchStats>;
  } {
    return {
      activeWatchers: this.activeWatchers.size,
      processingQueue: svgProcessor.getProcessingStats(),
      watcherStats: fileWatcher.getWatchStats(),
    };
  }

  /**
   * Shutdown service
   */
  public shutdown(): void {
    for (const controller of this.activeWatchJobs.values()) controller.abort();
    this.activeWatchJobs.clear();
    this.stopWatching();
    fileWatcher.shutdown();
    svgProcessor.clearQueue();
    logger.info('SVG service shutdown complete');
  }
}

/**
 * Simple file locking service
 */
export class LockService {
  private static instance: LockService;
  private static readonly LOCK_FILE = '.svg-lock';
  private cachedLocks: Set<string> | null = null;

  private constructor() {}

  public static getInstance(): LockService {
    if (!LockService.instance) {
      LockService.instance = new LockService();
    }
    return LockService.instance;
  }

  private getLockFilePath(): string {
    return path.resolve(LockService.LOCK_FILE);
  }

  private readLockFile(): Set<string> {
    if (this.cachedLocks) {
      return this.cachedLocks;
    }

    try {
      const data = FileSystem.readJSONSync(this.getLockFilePath());
      this.cachedLocks = new Set(Array.isArray(data) ? data : []);
      return this.cachedLocks;
    } catch {
      this.cachedLocks = new Set();
      return this.cachedLocks;
    }
  }

  private writeLockFile(locks: Set<string>): void {
    try {
      FileSystem.writeJSONSync(this.getLockFilePath(), Array.from(locks), {
        spaces: 2,
      });
      this.cachedLocks = locks;
    } catch (error) {
      logger.error('Failed to write lock file:', error);
    }
  }

  public lockFiles(files: string[]): void {
    const fileNames = files.map(f => path.basename(f));
    const current = this.readLockFile();

    for (const fileName of fileNames) {
      current.add(fileName);
    }

    this.writeLockFile(current);
    logger.success(`Locked files: ${fileNames.join(', ')}`);
  }

  public unlockFiles(files: string[]): void {
    const fileNames = files.map(f => path.basename(f));
    const current = this.readLockFile();

    for (const fileName of fileNames) {
      current.delete(fileName);
    }

    this.writeLockFile(current);
    logger.success(`Unlocked files: ${fileNames.join(', ')}`);
  }

  public isLocked(file: string): boolean {
    const locks = this.readLockFile();
    return locks.has(path.basename(file));
  }

  public clearCache(): void {
    this.cachedLocks = null;
  }
}

// Export singleton instance
export const svgService = SVGService.getInstance();
