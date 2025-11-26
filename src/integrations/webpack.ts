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
import { logger } from '../core/logger.js';
import type {
  WebpackPluginOptions,
  WebpackLoaderOptions,
  ProcessingResult,
} from '../types/integrations.js';

const PLUGIN_NAME = 'SvgerWebpackPlugin';

/**
 * Webpack Plugin for SVGER-CLI
 */
export class SvgerWebpackPlugin {
  private options: Required<WebpackPluginOptions>;
  private processedFiles: Set<string> = new Set();
  private watchDebounceTimer?: ReturnType<typeof setTimeout>;

  constructor(options: WebpackPluginOptions = {}) {
    const config = configService.readConfig();

    this.options = {
      source: options.source || config.source || './src/icons',
      output: options.output || config.output || './src/components/icons',
      framework: options.framework || config.framework || 'react',
      typescript:
        options.typescript !== undefined
          ? options.typescript
          : config.typescript,
      config: options.config || {},
      include: options.include || ['**/*.svg'],
      exclude: options.exclude || ['node_modules/**'],
      hmr: options.hmr !== undefined ? options.hmr : true,
      emitFile: options.emitFile !== undefined ? options.emitFile : true,
      generateIndex:
        options.generateIndex !== undefined ? options.generateIndex : true,
      watch: {
        debounce: options.watch?.debounce || 300,
        ignored: options.watch?.ignored || ['node_modules/**'],
      },
    };
  }

  apply(compiler: any): void {
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

    await FileSystem.ensureDir(outputDir);

    const files = await FileSystem.readDir(sourceDir);
    const svgFiles = files.filter((file: string) => file.endsWith('.svg'));

    if (svgFiles.length === 0) {
      logger.warn('No SVG files found in source directory');
      return;
    }

    const results: ProcessingResult[] = [];

    for (const file of svgFiles) {
      const svgPath = path.join(sourceDir, file);
      const result = await this.processSVGFile(svgPath, outputDir);
      results.push(result);

      if (result.success && result.outputPath) {
        this.processedFiles.add(result.outputPath);
      }
    }

    // Generate index file
    if (this.options.generateIndex) {
      await this.generateIndexFile(
        outputDir,
        results.filter(r => r.success)
      );
    }

    const successful = results.filter(r => r.success).length;
    logger.info(`SVGER: Processed ${successful}/${svgFiles.length} SVG files`);
  }

  /**
   * Process changed files in watch mode
   */
  private async processChangedFiles(files: Set<string>): Promise<void> {
    const outputDir = path.resolve(this.options.output);

    // Debounce processing
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
    }

    await new Promise<void>(resolve => {
      this.watchDebounceTimer = setTimeout(async () => {
        for (const file of files) {
          if (file.endsWith('.svg')) {
            const result = await this.processSVGFile(file, outputDir);
            if (result.success && result.outputPath) {
              this.processedFiles.add(result.outputPath);
              logger.info(`SVGER: Updated ${result.componentName}`);
            }
          }
        }
        resolve();
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
        defaultWidth: mergedConfig.defaultWidth,
        defaultHeight: mergedConfig.defaultHeight,
        defaultFill: mergedConfig.defaultFill,
        styleRules: mergedConfig.styleRules || {},
      });

      return {
        success: result.success,
        outputPath: result.filePath || undefined,
        componentName: result.componentName,
        error: result.error,
      };
    } catch (error) {
      logger.error(`Failed to process ${svgPath}:`, error);
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Generate index file with all exports
   */
  private async generateIndexFile(
    outputDir: string,
    results: ProcessingResult[]
  ): Promise<void> {
    const extension = this.options.typescript ? 'ts' : 'js';
    const exports = results
      .filter(r => r.componentName)
      .map(
        r =>
          `export { default as ${r.componentName} } from './${r.componentName}';`
      )
      .join('\n');

    const indexPath = path.join(outputDir, `index.${extension}`);
    await FileSystem.writeFile(indexPath, exports, 'utf-8');
    logger.debug(`Generated index file: ${indexPath}`);
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
  const config = configService.readConfig();

  const framework = options.framework || config.framework || 'react';
  const typescript =
    options.typescript !== undefined ? options.typescript : config.typescript;

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
        defaultWidth: config.defaultWidth,
        defaultHeight: config.defaultHeight,
        defaultFill: config.defaultFill,
        styleRules: config.styleRules || {},
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
