/**
 * Official Babel Plugin for SVGER-CLI
 *
 * Transforms SVG imports into framework components during Babel transpilation.
 * Works with any Babel-based build process including standalone Babel, Create React App,
 * and other tools that use Babel under the hood.
 *
 * @example
 * ```js
 * // babel.config.js
 * const { svgerBabelPlugin } = require('svger-cli/babel');
 *
 * module.exports = {
 *   plugins: [
 *     [svgerBabelPlugin, {
 *       source: './src/icons',
 *       output: './src/components/icons',
 *       framework: 'react',
 *       typescript: true
 *     }]
 *   ]
 * };
 * ```
 *
 * @example
 * ```js
 * // Direct SVG import transformation
 * import Icon from './icon.svg';
 * // Transforms to:
 * import Icon from './components/icons/Icon';
 * ```
 */

import path from 'path';
import { FileSystem } from '../utils/native.js';
import { svgProcessor } from '../processors/svg-processor.js';
import { configService } from '../services/config.js';
import { logger } from '../core/logger.js';
import type {
  BabelPluginOptions,
  ProcessingResult,
} from '../types/integrations.js';

const PLUGIN_NAME = 'svger-babel-plugin';

/**
 * Process all SVG files in the source directory
 */
async function processAllSVGs(
  options: Required<BabelPluginOptions>,
  processedFiles: Set<string>
): Promise<ProcessingResult[]> {
  const sourcePath = path.resolve(options.source);
  const outputPath = path.resolve(options.output);

  if (!(await FileSystem.exists(sourcePath))) {
    logger.warn(`Source directory not found: ${sourcePath}`);
    return [];
  }

  const files = await FileSystem.readDir(sourcePath);
  const svgFiles = files.filter(file => file.endsWith('.svg'));
  const results: ProcessingResult[] = [];

  for (const file of svgFiles) {
    const filePath = path.join(sourcePath, file);

    if (processedFiles.has(filePath)) continue;

    try {
      const svgContent = await FileSystem.readFile(filePath, 'utf-8');
      const componentName = svgProcessor.generateComponentName(file, 'pascal');

      const config = configService.readConfig();
      const component = await svgProcessor.generateComponent(
        componentName,
        svgContent,
        {
          framework: options.framework,
          typescript: options.typescript,
          defaultWidth: config.defaultWidth,
          defaultHeight: config.defaultHeight,
          defaultFill: config.defaultFill,
          styleRules: config.styleRules || {},
        }
      );

      const ext = options.typescript ? 'tsx' : 'jsx';
      const outputFile = path.join(outputPath, `${componentName}.${ext}`);

      await FileSystem.ensureDir(path.dirname(outputFile));
      await FileSystem.writeFile(outputFile, component);

      processedFiles.add(filePath);
      results.push({
        success: true,
        outputPath: outputFile,
        componentName,
      });
    } catch (error) {
      logger.error(`Failed to process ${file}:`, error);
      results.push({
        success: false,
        error: error as Error,
      });
    }
  }

  // Generate index file if enabled
  if (options.generateIndex && results.length > 0) {
    try {
      await generateIndexFile(outputPath, results, options);
    } catch (error) {
      logger.error('Failed to generate index file:', error);
    }
  }

  return results;
}

/**
 * Generate index file with all exports
 */
async function generateIndexFile(
  outputDir: string,
  results: ProcessingResult[],
  options: Required<BabelPluginOptions>
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

/**
 * Transform SVG import path to component path
 */
function transformSVGImport(
  sourcePath: string,
  options: Required<BabelPluginOptions>
): string | null {
  if (!sourcePath.endsWith('.svg')) return null;

  const absoluteOutput = path.resolve(options.output);

  // Extract filename without extension
  const fileName = path.basename(sourcePath, '.svg');
  const componentName = svgProcessor.generateComponentName(fileName, 'pascal');

  // Calculate relative path from output to component
  const ext = options.typescript ? 'tsx' : 'jsx';
  return path.join(absoluteOutput, `${componentName}.${ext}`);
}

/**
 * Babel Plugin for SVGER-CLI
 *
 * This plugin processes SVG files and transforms SVG imports to component imports.
 * It can run in two modes:
 * - Pre-build: Process all SVGs before Babel transformation
 * - On-demand: Transform SVG imports as they're encountered
 */
export function svgerBabelPlugin(
  api: any,
  options: BabelPluginOptions = {}
): any {
  const config = configService.readConfig();

  const pluginOptions: Required<BabelPluginOptions> = {
    source: options.source || config.source || './src/icons',
    output: options.output || config.output || './src/components/icons',
    framework: options.framework || config.framework || 'react',
    typescript:
      options.typescript !== undefined ? options.typescript : config.typescript,
    config: options.config || {},
    include: options.include || ['**/*.svg'],
    exclude: options.exclude || ['node_modules/**'],
    transformImports:
      options.transformImports !== undefined ? options.transformImports : true,
    processOnInit:
      options.processOnInit !== undefined ? options.processOnInit : true,
    generateIndex:
      options.generateIndex !== undefined ? options.generateIndex : true,
  };

  const processedFiles = new Set<string>();
  let initialized = false;

  return {
    name: PLUGIN_NAME,

    // Babel visitor pattern
    visitor: {
      // Process before any transformations if enabled
      Program: {
        enter: async () => {
          if (!initialized && pluginOptions.processOnInit) {
            initialized = true;
            logger.info('SVGER Babel Plugin: Processing SVG files...');
            const results = await processAllSVGs(pluginOptions, processedFiles);
            const successCount = results.filter(r => r.success).length;
            if (successCount > 0) {
              logger.info(
                `SVGER Babel Plugin: Processed ${successCount} SVG files`
              );
            }
          }
        },
      },

      // Transform import declarations
      ImportDeclaration(nodePath: any) {
        if (!pluginOptions.transformImports) return;

        const source = nodePath.node.source.value;

        if (typeof source === 'string' && source.endsWith('.svg')) {
          const newPath = transformSVGImport(source, pluginOptions);

          if (newPath) {
            // Replace the import source
            nodePath.node.source.value = newPath.replace(/\.(tsx|jsx)$/, '');

            logger.debug(
              `SVGER Babel Plugin: Transformed ${source} -> ${newPath}`
            );
          }
        }
      },

      // Handle dynamic imports
      CallExpression(nodePath: any) {
        if (!pluginOptions.transformImports) return;

        const callee = nodePath.node.callee;

        // Check for import() calls
        if (callee.type === 'Import') {
          const args = nodePath.node.arguments;
          if (args.length > 0 && args[0].type === 'StringLiteral') {
            const source = args[0].value;

            if (source.endsWith('.svg')) {
              const newPath = transformSVGImport(source, pluginOptions);

              if (newPath) {
                args[0].value = newPath.replace(/\.(tsx|jsx)$/, '');

                logger.debug(
                  `SVGER Babel Plugin: Transformed dynamic import ${source} -> ${newPath}`
                );
              }
            }
          }
        }
      },
    },
  };
}

/**
 * Create a Babel plugin instance with preset options
 *
 * @example
 * ```js
 * const plugin = createBabelPlugin({
 *   source: './icons',
 *   framework: 'react'
 * });
 * ```
 */
export function createBabelPlugin(options: BabelPluginOptions = {}) {
  return (api: any) => svgerBabelPlugin(api, options);
}

/**
 * Default export for convenient usage
 */
export default svgerBabelPlugin;
