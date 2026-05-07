import path from 'path';
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

type RuntimeProcessingOverrides = {
  framework?: SVGConfig['framework'];
  frameworkOptions?: FrameworkOptions;
  optimize?: string;
  typescript?: boolean;
};

type BuildRequestOptions = BuildOptions & RuntimeProcessingOverrides;
type GenerateRequestOptions = GenerateOptions & RuntimeProcessingOverrides;
type ResolvedRuntimeConfig = SVGConfig & RuntimeProcessingOverrides;

/**
 * Main SVG service that orchestrates all SVG processing operations
 */
export class SVGService {
  private static instance: SVGService;
  private activeWatchers: Set<string> = new Set();
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
    // O(1) Set lookup instead of O(n) Array.includes()
    const validLevels = new Set([
      'none',
      'basic',
      'balanced',
      'aggressive',
      'maximum',
    ]);
    if (!validLevels.has(level.toLowerCase())) {
      logger.warn(
        `Invalid optimization level "${level}". Using "basic" instead.`
      );
      svgProcessor.setOptimizationLevel(OptLevel.BASIC);
      return;
    }

    const optLevel = level.toLowerCase() as
      | 'none'
      | 'basic'
      | 'balanced'
      | 'aggressive'
      | 'maximum';
    svgProcessor.setOptimizationLevel(
      OptLevel[optLevel.toUpperCase() as keyof typeof OptLevel]
    );
  }

  private mergeRuntimeConfig(
    configOverrides: Partial<SVGConfig> | undefined,
    runtimeOverrides: RuntimeProcessingOverrides
  ): ResolvedRuntimeConfig {
    const config = configService.readConfig();

    return {
      ...config,
      ...(configOverrides || {}),
      ...(runtimeOverrides.framework && {
        framework: runtimeOverrides.framework,
      }),
      ...(runtimeOverrides.typescript !== undefined && {
        typescript: runtimeOverrides.typescript,
      }),
      ...(runtimeOverrides.frameworkOptions && {
        frameworkOptions: runtimeOverrides.frameworkOptions,
      }),
      ...(runtimeOverrides.optimize && {
        optimize: runtimeOverrides.optimize,
      }),
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

    // Ensure output directory exists
    await FileSystem.ensureDir(outDir);

    // Get configuration - merge config file with options
    const mergedConfig = this.mergeRuntimeConfig(options.config, options);

    // Set optimizer level if specified
    if (options.optimize) {
      const optimizeLevel = options.optimize;
      logger.info(`Using optimization level: ${optimizeLevel}`);
      this.setOptimizerLevel(optimizeLevel);
    }

    // Read all SVG files
    const files = await FileSystem.readDir(srcDir);
    const svgFiles = files.filter((file: string) => file.endsWith('.svg'));

    if (svgFiles.length === 0) {
      logger.warn('No SVG files found in source directory');
      return;
    }

    logger.info(`Found ${svgFiles.length} SVG files to process`);

    const results: Array<{ success: boolean; file: string; error?: Error }> =
      [];

    // Process each SVG file
    for (const file of svgFiles) {
      const svgPath = path.join(srcDir, file);

      // Check if file is locked
      if (this.lockService.isLocked(svgPath)) {
        logger.warn(`Skipped locked file: ${file}`);
        continue;
      }

      try {
        const processingResult = await svgProcessor.processSVGFile(
          svgPath,
          outDir,
          {
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
          }
        );

        results.push({
          success: processingResult.success,
          file,
          error: processingResult.error,
        });
      } catch (error) {
        logger.error(`Failed to process ${file}:`, error);
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
        logger.warn(`  - ${r.file}: ${r.error?.message}`);
      });
    }

    // Generate index.ts file with all component exports
    // This includes both newly generated components and existing locked components
    await this.generateIndexFile(outDir, mergedConfig);
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

    // Set optimizer level if specified
    if (options.optimize) {
      const optimizeLevel = options.optimize;
      logger.info(`Using optimization level: ${optimizeLevel}`);
      this.setOptimizerLevel(optimizeLevel);
    }

    // Get configuration
    const mergedConfig = this.mergeRuntimeConfig(options.config, options);

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
    const watchId = await fileWatcher.watchDirectory(srcDir, options);
    this.activeWatchers.add(watchId);

    // Register event handler
    fileWatcher.onFileEvent(watchId, async (event: FileWatchEvent) => {
      await this.handleWatchEvent(event, outDir, options.config);
    });

    logger.success(`Watch mode active - waiting for file changes...`);
    return watchId;
  }

  /**
   * Handle file watch events
   */
  private async handleWatchEvent(
    event: FileWatchEvent,
    outDir: string,
    config?: Partial<SVGConfig>
  ): Promise<void> {
    const fileName = path.basename(event.filePath);

    // Object lookup map for event handlers - O(1) performance
    const eventHandlers: Record<string, () => Promise<void>> = {
      add: async () => {
        logger.info(`New SVG detected: ${fileName}`);
        await this.processWatchedFile(event.filePath, outDir, config);
      },
      change: async () => {
        logger.info(`SVG updated: ${fileName}`);
        await this.processWatchedFile(event.filePath, outDir, config);
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
    config?: Partial<SVGConfig>
  ): Promise<void> {
    try {
      // Check if file is locked
      if (this.lockService.isLocked(filePath)) {
        logger.warn(`Skipped locked file: ${path.basename(filePath)}`);
        return;
      }

      // Get configuration
      const fullConfig = configService.readConfig();
      const mergedConfig = { ...fullConfig, ...config };

      // Process the file
      await svgProcessor.processSVGFile(filePath, outDir, {
        defaultWidth: mergedConfig.defaultWidth,
        defaultHeight: mergedConfig.defaultHeight,
        defaultFill: mergedConfig.defaultFill,
        styleRules: Object.fromEntries(
          Object.entries(mergedConfig.styleRules || {}).filter(
            ([, v]) => v !== undefined
          )
        ) as Record<string, string>,
      });
    } catch (error) {
      logger.error(
        `Failed to process watched file ${path.basename(filePath)}:`,
        error
      );
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
      // Get configuration
      const fullConfig = configService.readConfig();
      const mergedConfig = { ...fullConfig, ...config };

      const namingConvention = mergedConfig.outputConfig?.naming || 'pascal';
      const framework = mergedConfig.framework || 'react';
      const typescript = mergedConfig.typescript !== false;
      const extension = frameworkTemplateEngine.getFileExtension(
        framework,
        typescript
      );

      const componentName = svgProcessor.generateComponentName(
        path.basename(filePath),
        namingConvention
      );
      const componentPath = path.join(outDir, `${componentName}.${extension}`);

      if (await FileSystem.exists(componentPath)) {
        await FileSystem.unlink(componentPath);
        logger.success(`Removed component: ${componentName}.${extension}`);
      }
    } catch (error) {
      logger.error(
        `Failed to remove component for ${path.basename(filePath)}:`,
        error
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
    } else {
      // Stop all watchers
      for (const id of this.activeWatchers) {
        fileWatcher.stopWatching(id);
      }
      this.activeWatchers.clear();
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
    config?: Partial<SVGConfig>
  ): Promise<void> {
    try {
      // Scan output directory for all component files
      const files = await FileSystem.readDir(outDir);

      // Get the file extension based on typescript setting
      const typescript = config?.typescript !== false;
      const ext = typescript ? '.tsx' : '.jsx';

      // Filter component files (exclude index.ts/index.js)
      const componentFiles = files.filter(
        file =>
          (file.endsWith(ext) ||
            file.endsWith('.ts') ||
            file.endsWith('.js')) &&
          !file.startsWith('index.')
      );

      if (componentFiles.length === 0) {
        logger.warn(
          'No component files found in output directory for index generation'
        );
        return;
      }

      // Extract component names from filenames
      const componentNames = componentFiles.map(file => {
        // Remove extension to get component name
        const baseName = path.basename(file, path.extname(file));
        return baseName;
      });

      const indexContent = this.generateIndexContent(componentNames);
      const indexPath = path.join(outDir, 'index.ts');

      await FileSystem.writeFile(indexPath, indexContent, 'utf-8');
      logger.success(
        `Generated index.ts with ${componentNames.length} component exports`
      );
    } catch (error) {
      logger.error('Failed to generate index.ts:', error);
    }
  }

  /**
   * Generate the content for index.ts file
   */
  private generateIndexContent(componentNames: string[]): string {
    const imports = componentNames
      .map(name => `export { default as ${name} } from './${name}';`)
      .join('\n');

    return `/**
 * SVG Components Index
 * Generated by svger-cli
 * 
 * Import individual components:
 * import { ${componentNames[0] || 'ComponentName'} } from './components';
 * 
 * Import all components:
 * import * as Icons from './components';
 */

${imports}
`;
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
