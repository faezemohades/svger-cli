/**
 * Official Webpack Plugin for SVGER-CLI
 *
 * Automatically converts SVG files to framework components during webpack builds
 * with full HMR support and optimization.
 *
 * @example
 * ```js
 * // webpack.config.js
 * const { SvgerWebpackPlugin } = require('svger-cli/webpack');
 *
 * module.exports = {
 *   plugins: [
 *     new SvgerWebpackPlugin({
 *       source: './src/icons',
 *       output: './src/components/icons',
 *       framework: 'react',
 *       typescript: true
 *     })
 *   ]
 * };
 * ```
 */

import path from 'path';
import { FileSystem } from '../utils/native.js';
import { svgProcessor } from '../processors/svg-processor.js';
import { configService } from '../services/config.js';
import { runStagedOutputBuild } from '../application/output-transaction.js';
import { logger } from '../core/logger.js';
import type {
  WebpackPluginOptions,
  WebpackLoaderOptions,
  ProcessingResult,
} from '../types/integrations.js';
import {
  DEFAULT_MAX_SVG_INPUT_SIZE_BYTES,
  resolveOutputArtifactPath,
} from '../security/input-safety.js';

const PLUGIN_NAME = 'SvgerWebpackPlugin';

/**
 * Webpack Plugin for SVGER-CLI
 */
export class SvgerWebpackPlugin {
  private options: Required<WebpackPluginOptions>;
  private processedFiles: Set<string> = new Set();
  private watchDebounceTimer?: ReturnType<typeof setTimeout>;
  private pendingChangedFiles = new Set<string>();
  private watchDebounceWaiters: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  private trackHmrFiles = false;

  constructor(options: WebpackPluginOptions = {}) {
    const effectiveConfig = configService.resolveEffectiveConfig({
      ...(options.config ?? {}),
      ...(options.framework === undefined
        ? {}
        : { framework: options.framework }),
      ...(options.typescript === undefined
        ? {}
        : { typescript: options.typescript }),
      ...(options.maxInputSizeBytes === undefined
        ? {}
        : { maxInputSizeBytes: options.maxInputSizeBytes }),
      ...(options.unsafeInputPolicy === undefined
        ? {}
        : { unsafeInputPolicy: options.unsafeInputPolicy }),
    });

    this.options = {
      source: options.source ?? effectiveConfig.source ?? './src/icons',
      output:
        options.output ?? effectiveConfig.output ?? './src/components/icons',
      framework: effectiveConfig.framework,
      typescript: effectiveConfig.typescript,
      config: effectiveConfig,
      include: options.include ?? ['**/*.svg'],
      exclude: options.exclude ?? ['node_modules/**'],
      hmr: options.hmr !== undefined ? options.hmr : true,
      emitFile: options.emitFile !== undefined ? options.emitFile : true,
      generateIndex:
        options.generateIndex !== undefined ? options.generateIndex : true,
      maxInputSizeBytes:
        effectiveConfig.maxInputSizeBytes ?? DEFAULT_MAX_SVG_INPUT_SIZE_BYTES,
      unsafeInputPolicy: effectiveConfig.unsafeInputPolicy ?? 'reject',
      watch: {
        debounce: options.watch?.debounce ?? 300,
        ignored: options.watch?.ignored ?? ['node_modules/**'],
      },
    };
  }

  apply(compiler: any): void {
    this.trackHmrFiles =
      this.options.hmr && Boolean(compiler.options.devServer);
    // Initial build - process all SVG files
    compiler.hooks.beforeCompile.tapPromise(PLUGIN_NAME, async () => {
      logger.info('SVGER Webpack Plugin: Processing SVG files...');
      await this.processAllSVGs();
    });

    // Watch mode - process changed files
    if (compiler.options.watch) {
      compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, async (comp: any) => {
        const changedFiles = this.getChangedFiles(comp);
        if (changedFiles.size > 0) {
          await this.processChangedFiles(changedFiles);
        }
      });
      compiler.hooks.watchClose?.tap(PLUGIN_NAME, () => this.dispose());
    }

    // Add HMR support
    if (this.options.hmr && compiler.options.devServer) {
      compiler.hooks.done.tap(PLUGIN_NAME, (stats: any) => {
        if (stats.hasErrors()) return;

        const changedFiles = Array.from(this.processedFiles);
        if (changedFiles.length > 0) {
          logger.info(
            `SVGER: ${changedFiles.length} component(s) updated with HMR`
          );
        }
        this.processedFiles.clear();
      });
    }
  }

  /** Release debounce work and HMR bookkeeping when the compiler closes. */
  dispose(): void {
    if (this.watchDebounceTimer) clearTimeout(this.watchDebounceTimer);
    this.watchDebounceTimer = undefined;
    this.pendingChangedFiles.clear();
    for (const waiter of this.watchDebounceWaiters.splice(0)) waiter.resolve();
    this.processedFiles.clear();
  }

  /**
   * Process all SVG files in the source directory
   */
  private async processAllSVGs(): Promise<void> {
    const sourceDir = path.resolve(this.options.source);
    const outputDir = path.resolve(this.options.output);

    if (!(await FileSystem.exists(sourceDir))) {
      logger.warn(`Source directory not found: ${sourceDir}`);
      return;
    }

    const files = await FileSystem.readDir(sourceDir);
    const svgFiles = files.filter((file: string) => file.endsWith('.svg'));

    if (svgFiles.length === 0) {
      logger.warn('No SVG files found in source directory');
      return;
    }

    const results: ProcessingResult[] = [];

    await runStagedOutputBuild(outputDir, async stageDir => {
      await FileSystem.ensureDir(stageDir);
      for (const file of svgFiles) {
        const svgPath = path.join(sourceDir, file);
        results.push(await this.processSVGFile(svgPath, stageDir));
      }
      const failed = results.find(result => !result.success);
      if (failed)
        throw failed.error ?? new Error('Webpack SVG generation failed.');
      if (this.options.generateIndex) await this.generateIndexFile(stageDir);
    });

    for (const result of results) {
      if (result.success && result.outputPath) {
        if (this.trackHmrFiles) {
          this.processedFiles.add(
            path.join(outputDir, path.basename(result.outputPath))
          );
        }
      }
    }

    const successful = results.filter(r => r.success).length;
    logger.info(`SVGER: Processed ${successful}/${svgFiles.length} SVG files`);
  }

  /**
   * Process changed files in watch mode
   */
  private async processChangedFiles(files: Set<string>): Promise<void> {
    const outputDir = path.resolve(this.options.output);
    for (const file of files) this.pendingChangedFiles.add(file);
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
    }

    await new Promise<void>((resolve, reject) => {
      this.watchDebounceWaiters.push({ resolve, reject });
      this.watchDebounceTimer = setTimeout(() => {
        this.watchDebounceTimer = undefined;
        const changedFiles = [...this.pendingChangedFiles];
        this.pendingChangedFiles.clear();
        const waiters = this.watchDebounceWaiters.splice(0);
        void (async () => {
          for (const file of changedFiles) {
            if (file.endsWith('.svg')) {
              const result = await this.processSVGFile(file, outputDir);
              if (!result.success) {
                throw result.error ?? new Error('Webpack SVG update failed.');
              }
              if (result.outputPath) {
                if (this.trackHmrFiles)
                  this.processedFiles.add(result.outputPath);
                logger.info(`SVGER: Updated ${result.componentName}`);
              }
            }
          }
        })().then(
          () => waiters.forEach(waiter => waiter.resolve()),
          error => waiters.forEach(waiter => waiter.reject(error))
        );
      }, this.options.watch.debounce);
    });
  }

  /**
   * Process a single SVG file
   */
  private async processSVGFile(
    svgPath: string,
    outputDir: string
  ): Promise<ProcessingResult> {
    try {
      const mergedConfig = {
        ...configService.readConfig(),
        ...this.options.config,
        framework: this.options.framework,
        typescript: this.options.typescript,
      };

      const result = await svgProcessor.processSVGFile(svgPath, outputDir, {
        framework: mergedConfig.framework,
        typescript: mergedConfig.typescript,
        frameworkOptions: mergedConfig.frameworkOptions,
        defaultWidth: mergedConfig.defaultWidth,
        defaultHeight: mergedConfig.defaultHeight,
        defaultFill: mergedConfig.defaultFill,
        styleRules: mergedConfig.styleRules || {},
        maxInputSizeBytes: this.options.maxInputSizeBytes,
        unsafeInputPolicy: this.options.unsafeInputPolicy,
      });

      return {
        success: result.success,
        outputPath: result.filePath || undefined,
        componentName: result.componentName,
        error: result.error,
      };
    } catch (error) {
      logger.error(`Failed to process ${path.basename(svgPath)}.`);
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Generate index file with all exports
   * Scans the output directory for all existing component files
   */
  private async generateIndexFile(outputDir: string): Promise<void> {
    try {
      if (
        this.options.framework === 'vue' ||
        this.options.framework === 'svelte' ||
        this.options.framework === 'angular'
      ) {
        return;
      }

      // Scan output directory for all component files
      const files = await FileSystem.readDir(outputDir);
      const extension = svgProcessor.getFileExtension(
        this.options.framework,
        this.options.typescript
      );

      // Filter component files (exclude index files)
      const componentFiles = files.filter(
        file =>
          (file.endsWith(`.${extension}`) ||
            file.endsWith('.ts') ||
            file.endsWith('.js')) &&
          !file.startsWith('index.')
      );

      if (componentFiles.length === 0) {
        logger.warn('No component files found for index generation');
        return;
      }

      // Extract component names
      const componentNames = componentFiles.map(file =>
        path.basename(file, path.extname(file))
      );

      const indexExtension = this.options.typescript ? 'ts' : 'js';
      const exports = componentNames
        .map(name => `export { default as ${name} } from './${name}';`)
        .join('\n');

      const indexPath = resolveOutputArtifactPath(
        outputDir,
        `index.${indexExtension}`
      );
      await FileSystem.writeFile(indexPath, exports, 'utf-8');
      logger.debug(`Generated index file: ${indexPath}`);
    } catch (error) {
      logger.error('Failed to generate index file.');
      throw error;
    }
  }

  /**
   * Get changed files from webpack
   */
  private getChangedFiles(compiler: any): Set<string> {
    const changedFiles = new Set<string>();
    const watchFileSystem = compiler.watchFileSystem;

    if (watchFileSystem && watchFileSystem.watcher) {
      const { mtimes } = watchFileSystem.watcher;
      if (mtimes) {
        for (const file of Object.keys(mtimes)) {
          if (file.endsWith('.svg') && file.includes(this.options.source)) {
            changedFiles.add(file);
          }
        }
      }
    }

    return changedFiles;
  }
}

/**
 * Webpack Loader for SVGER-CLI
 *
 * Transforms SVG imports into framework components inline
 *
 * @example
 * ```js
 * // webpack.config.js
 * module.exports = {
 *   module: {
 *     rules: [
 *       {
 *         test: /\.svg$/,
 *         use: [
 *           {
 *             loader: 'svger-cli/webpack-loader',
 *             options: {
 *               framework: 'react',
 *               typescript: true
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * };
 * ```
 */
export async function svgerLoader(this: any, content: string): Promise<string> {
  const callback = this.async();
  const options: WebpackLoaderOptions = this.getOptions() || {};
  const effectiveConfig = configService.resolveEffectiveConfig({
    ...(options.config ?? {}),
    ...(options.framework === undefined
      ? {}
      : { framework: options.framework }),
    ...(options.typescript === undefined
      ? {}
      : { typescript: options.typescript }),
    ...(options.maxInputSizeBytes === undefined
      ? {}
      : { maxInputSizeBytes: options.maxInputSizeBytes }),
    ...(options.unsafeInputPolicy === undefined
      ? {}
      : { unsafeInputPolicy: options.unsafeInputPolicy }),
  });
  const framework = effectiveConfig.framework;
  const typescript = effectiveConfig.typescript;

  const componentName = svgProcessor.generateComponentName(
    this.resourcePath,
    'pascal'
  );

  try {
    const component = await svgProcessor.generateComponent(
      componentName,
      content,
      {
        framework,
        typescript,
        frameworkOptions: effectiveConfig.frameworkOptions,
        defaultWidth: effectiveConfig.defaultWidth,
        defaultHeight: effectiveConfig.defaultHeight,
        defaultFill: effectiveConfig.defaultFill,
        styleRules: effectiveConfig.styleRules,
        maxInputSizeBytes: effectiveConfig.maxInputSizeBytes,
        unsafeInputPolicy: effectiveConfig.unsafeInputPolicy,
      }
    );

    // Enable HMR for the loader
    if (this.hot) {
      const hmrCode = `
if (module.hot) {
  module.hot.accept();
}
      `;
      callback(null, component + '\n' + hmrCode);
    } else {
      callback(null, component);
    }
  } catch (error) {
    callback(error as Error);
  }

  // Return empty string to satisfy TypeScript (callback handles the actual return)
  return '';
}

// Default export for plugin
export default SvgerWebpackPlugin;
