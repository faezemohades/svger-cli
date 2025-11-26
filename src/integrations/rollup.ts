/**
 * Official Rollup Plugin for SVGER-CLI
 *
 * Automatically converts SVG files to framework components during Rollup builds
 * with full bundle optimization and tree-shaking support.
 *
 * @example
 * ```js
 * // rollup.config.js
 * import { svgerRollupPlugin } from 'svger-cli/rollup';
 *
 * export default {
 *   plugins: [
 *     svgerRollupPlugin({
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
  RollupPluginOptions,
  ProcessingResult,
} from '../types/integrations.js';

const PLUGIN_NAME = 'svger-rollup-plugin';

/**
 * Rollup Plugin for SVGER-CLI
 */
export function svgerRollupPlugin(options: RollupPluginOptions = {}): any {
  const config = configService.readConfig();

  const pluginOptions: Required<RollupPluginOptions> = {
    source: options.source || config.source || './src/icons',
    output: options.output || config.output || './src/components/icons',
    framework: options.framework || config.framework || 'react',
    typescript:
      options.typescript !== undefined ? options.typescript : config.typescript,
    config: options.config || {},
    include: options.include || ['**/*.svg'],
    exclude: options.exclude || ['node_modules/**'],
    exportType: options.exportType || 'default',
    svgo: options.svgo !== undefined ? options.svgo : false,
    generateIndex:
      options.generateIndex !== undefined ? options.generateIndex : true,
    sourcemap: options.sourcemap !== undefined ? options.sourcemap : false,
  };

  const processedFiles = new Set<string>();

  return {
    name: PLUGIN_NAME,

    async buildStart() {
      logger.info('SVGER Rollup Plugin: Processing SVG files...');
      await processAllSVGs(pluginOptions, processedFiles);
    },

    resolveId(id: string) {
      // Handle SVG imports
      if (id.endsWith('.svg')) {
        // Let Rollup handle it naturally, we'll transform it
        return null;
      }
    },

    async load(id: string) {
      // Load and transform SVG files
      if (id.endsWith('.svg')) {
        if (await FileSystem.exists(id)) {
          const svgContent = await FileSystem.readFile(id, 'utf-8');
          const componentName = svgProcessor.generateComponentName(
            id,
            'pascal'
          );

          const component = await svgProcessor.generateComponent(
            componentName,
            svgContent,
            {
              framework: pluginOptions.framework,
              typescript: pluginOptions.typescript,
              defaultWidth: config.defaultWidth,
              defaultHeight: config.defaultHeight,
              defaultFill: config.defaultFill,
              styleRules: config.styleRules || {},
            }
          );

          if (pluginOptions.exportType === 'named') {
            return {
              code: `${component}\nexport { ${componentName} };`,
              map: pluginOptions.sourcemap ? { mappings: '' } : null,
            };
          }

          return {
            code: component,
            map: pluginOptions.sourcemap ? { mappings: '' } : null,
          };
        }
      }
    },

    async transform(code: string, id: string) {
      // Transform SVG content if loaded by another plugin
      if (id.endsWith('.svg')) {
        const componentName = svgProcessor.generateComponentName(id, 'pascal');

        const component = await svgProcessor.generateComponent(
          componentName,
          code,
          {
            framework: pluginOptions.framework,
            typescript: pluginOptions.typescript,
            defaultWidth: config.defaultWidth,
            defaultHeight: config.defaultHeight,
            defaultFill: config.defaultFill,
            styleRules: config.styleRules || {},
          }
        );

        if (pluginOptions.exportType === 'named') {
          return {
            code: `${component}\nexport { ${componentName} };`,
            map: pluginOptions.sourcemap ? { mappings: '' } : null,
          };
        }

        return {
          code: component,
          map: pluginOptions.sourcemap ? { mappings: '' } : null,
        };
      }
    },
  };
}

/**
 * Process all SVG files in the source directory
 */
async function processAllSVGs(
  options: Required<RollupPluginOptions>,
  processedFiles: Set<string>
): Promise<void> {
  const sourceDir = path.resolve(options.source);
  const outputDir = path.resolve(options.output);

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
    const result = await processSVGFile(svgPath, outputDir, options);
    results.push(result);

    if (result.success && result.outputPath) {
      processedFiles.add(result.outputPath);
    }
  }

  // Generate index file
  if (options.generateIndex) {
    await generateIndexFile(outputDir, results, options);
  }

  const successful = results.filter(r => r.success).length;
  logger.info(`SVGER: Processed ${successful}/${svgFiles.length} SVG files`);
}

/**
 * Process a single SVG file
 */
async function processSVGFile(
  svgPath: string,
  outputDir: string,
  options: Required<RollupPluginOptions>
): Promise<ProcessingResult> {
  try {
    const config = configService.readConfig();
    const mergedConfig = {
      ...config,
      ...options.config,
      framework: options.framework,
      typescript: options.typescript,
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
async function generateIndexFile(
  outputDir: string,
  results: ProcessingResult[],
  options: Required<RollupPluginOptions>
): Promise<void> {
  const extension = options.typescript ? 'ts' : 'js';
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

// Default export
export default svgerRollupPlugin;
