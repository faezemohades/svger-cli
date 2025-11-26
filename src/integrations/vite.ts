/**
 * Official Vite Plugin for SVGER-CLI
 *
 * Automatically converts SVG files to framework components during Vite builds
 * with full HMR support and virtual module integration.
 *
 * @example
 * ```js
 * // vite.config.js
 * import { svgerVitePlugin } from 'svger-cli/vite';
 *
 * export default {
 *   plugins: [
 *     svgerVitePlugin({
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
  VitePluginOptions,
  ProcessingResult,
} from '../types/integrations.js';

const PLUGIN_NAME = 'svger-vite-plugin';
const VIRTUAL_MODULE_PREFIX = 'virtual:svger/';

/**
 * Vite Plugin for SVGER-CLI
 */
export function svgerVitePlugin(options: VitePluginOptions = {}): any {
  const config = configService.readConfig();

  const pluginOptions: Required<VitePluginOptions> = {
    source: options.source || config.source || './src/icons',
    output: options.output || config.output || './src/components/icons',
    framework: options.framework || config.framework || 'react',
    typescript:
      options.typescript !== undefined ? options.typescript : config.typescript,
    config: options.config || {},
    include: options.include || ['**/*.svg'],
    exclude: options.exclude || ['node_modules/**'],
    hmr: options.hmr !== undefined ? options.hmr : true,
    virtual: options.virtual !== undefined ? options.virtual : false,
    exportType: options.exportType || 'default',
    svgo: options.svgo !== undefined ? options.svgo : false,
    generateIndex:
      options.generateIndex !== undefined ? options.generateIndex : true,
  };

  let viteConfig: any;
  const processedFiles = new Set<string>();

  return {
    name: PLUGIN_NAME,

    configResolved(resolvedConfig: any) {
      viteConfig = resolvedConfig;
    },

    async buildStart() {
      logger.info('SVGER Vite Plugin: Processing SVG files...');
      await processAllSVGs(pluginOptions, processedFiles);
    },

    async handleHotUpdate(ctx: any) {
      if (!pluginOptions.hmr) return;

      const { file, server } = ctx;

      if (file.endsWith('.svg') && file.includes(pluginOptions.source)) {
        logger.info(`SVGER: Hot reloading ${path.basename(file)}`);

        const outputDir = path.resolve(pluginOptions.output);
        const result = await processSVGFile(file, outputDir, pluginOptions);

        if (result.success) {
          // Trigger HMR for the generated component
          const modules = server.moduleGraph.getModulesByFile(file);
          if (modules) {
            return Array.from(modules);
          }
        }
      }
    },

    resolveId(id: string) {
      // Handle virtual modules
      if (pluginOptions.virtual && id.startsWith(VIRTUAL_MODULE_PREFIX)) {
        return '\0' + id;
      }

      // Handle direct SVG imports
      if (id.endsWith('.svg')) {
        return null; // Let Vite handle it with our transform hook
      }
    },

    async load(id: string) {
      // Handle virtual modules
      if (
        pluginOptions.virtual &&
        id.startsWith('\0' + VIRTUAL_MODULE_PREFIX)
      ) {
        const svgName = id.slice(('\0' + VIRTUAL_MODULE_PREFIX).length);
        const sourceDir = path.resolve(pluginOptions.source);
        const svgPath = path.join(sourceDir, svgName + '.svg');

        if (await FileSystem.exists(svgPath)) {
          const svgContent = await FileSystem.readFile(svgPath, 'utf-8');
          const componentName = svgProcessor.generateComponentName(
            svgPath,
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

          return {
            code: component,
            map: null,
          };
        }
      }
    },

    async transform(code: string, id: string) {
      // Transform direct SVG imports
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
            map: null,
          };
        }

        return {
          code: component,
          map: null,
        };
      }
    },
  };
}

/**
 * Process all SVG files in the source directory
 */
async function processAllSVGs(
  options: Required<VitePluginOptions>,
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
  options: Required<VitePluginOptions>
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
  options: Required<VitePluginOptions>
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
export default svgerVitePlugin;
