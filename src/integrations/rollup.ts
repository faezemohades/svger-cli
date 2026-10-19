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
import { runStagedOutputBuild } from '../application/output-transaction.js';
import { readSVGInputFile } from '../security/input-safety.js';
import { logger } from '../core/logger.js';
import type {
  RollupPluginOptions,
  ProcessingResult,
} from '../types/integrations.js';
import {
  DEFAULT_MAX_SVG_INPUT_SIZE_BYTES,
  resolveOutputArtifactPath,
} from '../security/input-safety.js';

const PLUGIN_NAME = 'svger-rollup-plugin';

/**
 * Rollup Plugin for SVGER-CLI
 */
export function svgerRollupPlugin(options: RollupPluginOptions = {}): any {
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

  const pluginOptions: Required<RollupPluginOptions> = {
    source: options.source ?? effectiveConfig.source ?? './src/icons',
    output:
      options.output ?? effectiveConfig.output ?? './src/components/icons',
    framework: effectiveConfig.framework,
    typescript: effectiveConfig.typescript,
    config: effectiveConfig,
    include: options.include ?? ['**/*.svg'],
    exclude: options.exclude ?? ['node_modules/**'],
    exportType: options.exportType ?? 'default',
    svgo: options.svgo !== undefined ? options.svgo : false,
    generateIndex:
      options.generateIndex !== undefined ? options.generateIndex : true,
    sourcemap: options.sourcemap !== undefined ? options.sourcemap : false,
    maxInputSizeBytes:
      effectiveConfig.maxInputSizeBytes ?? DEFAULT_MAX_SVG_INPUT_SIZE_BYTES,
    unsafeInputPolicy: effectiveConfig.unsafeInputPolicy ?? 'reject',
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
          const svgContent = await readSVGInputFile(
            id,
            pluginOptions.maxInputSizeBytes ??
              pluginOptions.config.maxInputSizeBytes,
            id
          );
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
              frameworkOptions: pluginOptions.config.frameworkOptions,
              defaultWidth: pluginOptions.config.defaultWidth,
              defaultHeight: pluginOptions.config.defaultHeight,
              defaultFill: pluginOptions.config.defaultFill,
              styleRules: pluginOptions.config.styleRules,
              maxInputSizeBytes: pluginOptions.maxInputSizeBytes,
              unsafeInputPolicy: pluginOptions.unsafeInputPolicy,
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
            frameworkOptions: pluginOptions.config.frameworkOptions,
            defaultWidth: pluginOptions.config.defaultWidth,
            defaultHeight: pluginOptions.config.defaultHeight,
            defaultFill: pluginOptions.config.defaultFill,
            styleRules: pluginOptions.config.styleRules,
            maxInputSizeBytes: pluginOptions.maxInputSizeBytes,
            unsafeInputPolicy: pluginOptions.unsafeInputPolicy,
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
      results.push(await processSVGFile(svgPath, stageDir, options));
    }
    const failed = results.find(result => !result.success);
    if (failed)
      throw failed.error ?? new Error('Rollup SVG generation failed.');
    if (options.generateIndex) await generateIndexFile(stageDir, options);
  });

  for (const result of results) {
    if (result.success && result.outputPath) {
      processedFiles.add(
        path.join(outputDir, path.basename(result.outputPath))
      );
    }
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
      frameworkOptions: mergedConfig.frameworkOptions,
      defaultWidth: mergedConfig.defaultWidth,
      defaultHeight: mergedConfig.defaultHeight,
      defaultFill: mergedConfig.defaultFill,
      styleRules: mergedConfig.styleRules,
      maxInputSizeBytes: options.maxInputSizeBytes,
      unsafeInputPolicy: options.unsafeInputPolicy,
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
async function generateIndexFile(
  outputDir: string,
  options: Required<RollupPluginOptions>
): Promise<void> {
  try {
    if (
      options.framework === 'vue' ||
      options.framework === 'svelte' ||
      options.framework === 'angular'
    ) {
      return;
    }

    // Scan output directory for all component files
    const files = await FileSystem.readDir(outputDir);
    const extension = svgProcessor.getFileExtension(
      options.framework,
      options.typescript
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

    const indexExtension = options.typescript ? 'ts' : 'js';
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

// Default export
export default svgerRollupPlugin;
