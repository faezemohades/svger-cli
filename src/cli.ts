#!/usr/bin/env node
import { CLI, FileSystem } from './utils/native.js';
import { svgService } from './services/svg-service.js';
import { configService } from './services/config.js';
import { logger } from './core/logger.js';
import { getPluginManager } from './core/enhanced-plugin-manager.js';
import { svgProcessor } from './processors/svg-processor.js';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import path from 'path';
import { readFileSync } from 'fs';


// Read version dynamically from package.json
const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
const CLI_VERSION = packageJson.version;

const program = new CLI();

/**
 * Load a plugin from npm package or local path
 */
async function loadPlugin(pluginNameOrPath: string): Promise<void> {
  const pluginManager = getPluginManager();

  try {
    let pluginModule;

    // Check if it's a local path (starts with ./ or ../ or /)
    if (
      pluginNameOrPath.startsWith('./') ||
      pluginNameOrPath.startsWith('../') ||
      pluginNameOrPath.startsWith('/')
    ) {
      const pluginPath = resolve(process.cwd(), pluginNameOrPath);
      const pluginUrl = pathToFileURL(pluginPath).href;
      pluginModule = await import(pluginUrl);
    } else {
      // Try to load from node_modules as svger-plugin-{name} or just {name}
      let moduleName = pluginNameOrPath;
      if (!moduleName.startsWith('svger-plugin-')) {
        moduleName = `svger-plugin-${moduleName}`;
      }

      try {
        pluginModule = await import(moduleName);
      } catch {
        // If svger-plugin- prefix didn't work, try original name
        pluginModule = await import(pluginNameOrPath);
      }
    }

    // Plugin module should export a default plugin or named plugin
    const plugin = pluginModule.default || pluginModule;

    if (!plugin || typeof plugin !== 'object') {
      throw new Error(
        `Plugin "${pluginNameOrPath}" did not export a valid plugin object`
      );
    }

    pluginManager.registerPlugin(plugin);
    logger.info(`Loaded plugin: ${plugin.name} v${plugin.version}`);
  } catch (error) {
    logger.error(`Failed to load plugin "${pluginNameOrPath}":`, error);
    throw error;
  }
}

/**
 * List all registered plugins
 */
function listRegisteredPlugins(): void {
  const pluginManager = getPluginManager();
  const plugins = pluginManager.listPlugins();

  if (plugins.length === 0) {
    logger.info('No plugins registered');
    return;
  }

  logger.info('Registered plugins:');
  plugins.forEach(plugin => {
    logger.info(`  - ${plugin.name} v${plugin.version}: ${plugin.description}`);
    logger.info(`    Hooks: ${plugin.hooks.join(', ')}`);
  });

  const metrics = pluginManager.getMetricsSummary();
  if (metrics.totalExecutions > 0) {
    logger.info('\nPlugin Metrics:');
    logger.info(`  Total executions: ${metrics.totalExecutions}`);
    logger.info(
      `  Average execution time: ${metrics.averageExecutionTime.toFixed(2)}ms`
    );
    logger.info(`  Validations passed: ${metrics.validationsPassed}`);
    logger.info(`  Validations failed: ${metrics.validationsFailed}`);
  }
}

/**
 * svger-cli CLI
 * Custom SVG to Angular, React, Vue, Svelte, Solid, and other component converter.
 */
program
  .name('svger-cli')
  .description(
    'Custom SVG to Angular, React, Vue, Svelte, Solid, and other component converter'
  )
  .version(CLI_VERSION);

// -------- Build Command --------
/**
 * Build all SVGs from a source folder to an output folder.
 */
program
  .command('build <src> <out>')
  .description('Build all SVGs from source to output')
  .option(
    '--framework <type>',
    'Target framework (react|vue|svelte|angular|solid|preact|lit|vanilla)'
  )
  .option('--typescript', 'Generate TypeScript components (default: true)')
  .option('--no-typescript', 'Generate JavaScript components')
  .option('--composition', 'Use Vue Composition API with <script setup>')
  .option('--standalone', 'Generate Angular standalone components')
  .option('--signals', 'Use Angular signals for reactive state')
  .option(
    '--optimize <level>',
    'Optimization level: none, basic, balanced, aggressive, maximum (default: basic)'
  )
  .option('--validate', 'Run visual diff validation after build')
  .option(
    '--plugin <names>',
    'Load plugin(s) by name or path (comma-separated for multiple)'
  )
  .option('--list-plugins', 'List all registered plugins and exit')
  .action(async (args: string[], opts: Record<string, any>) => {
    try {
      // Handle --list-plugins flag
      if (opts.listPlugins) {
        listRegisteredPlugins();
        return;
      }

      // Load plugins if specified
      if (opts.plugin) {
        const plugins = opts.plugin.split(',').map((p: string) => p.trim());
        for (const pluginNameOrPath of plugins) {
          await loadPlugin(pluginNameOrPath);
        }
      }

      const [src, out] = args;

      // Validate required arguments
      if (!src || !out) {
        logger.error('Error: Both <src> and <out> paths are required');
        process.exit(1);
      }

      // Validate framework type if provided — O(1) Set.has() instead of O(n) Array.includes()
      const validFrameworks = new Set([
        'react',
        'react-native',
        'vue',
        'svelte',
        'angular',
        'solid',
        'preact',
        'lit',
        'vanilla',
      ]);
      if (opts.framework && !validFrameworks.has(opts.framework)) {
        logger.error(
          `Error: Invalid framework "${opts.framework}". Valid options: ${[...validFrameworks].join(', ')}`
        );
        process.exit(1);
      }

      // Validate optimization level if provided — O(1) Set.has()
      const validOptLevels = new Set([
        'none',
        'basic',
        'balanced',
        'aggressive',
        'maximum',
      ]);
      if (opts.optimize && !validOptLevels.has(opts.optimize)) {
        logger.error(
          `Error: Invalid optimization level "${opts.optimize}". Valid options: ${[...validOptLevels].join(', ')}`
        );
        process.exit(1);
      }

      // Build config from CLI options
      const buildConfig: any = { src, out };

      if (opts.framework) {
        buildConfig.framework = opts.framework;
      }

      if (opts.typescript !== undefined) {
        buildConfig.typescript = opts.typescript;
      }

      if (opts.optimize) {
        buildConfig.optimize = opts.optimize;
      }

      // Framework-specific options
      const frameworkOptions: any = {};

      if (opts.composition !== undefined) {
        frameworkOptions.scriptSetup = opts.composition;
      }

      if (opts.standalone !== undefined) {
        frameworkOptions.standalone = opts.standalone;
      }

      if (opts.signals !== undefined) {
        frameworkOptions.signals = opts.signals;
      }

      if (Object.keys(frameworkOptions).length > 0) {
        buildConfig.frameworkOptions = frameworkOptions;
      }

      await svgService.buildAll(buildConfig);
    } catch (error) {
      logger.error('Build failed:', error);
      process.exit(1);
    }
  });

// -------- Watch Command --------
/**
 * Watch a source folder and rebuild SVGs automatically on changes.
 */
program
  .command('watch <src> <out>')
  .description('Watch source folder and rebuild SVGs automatically')
  .action(async (args: string[]) => {
    try {
      const [src, out] = args;

      // Validate required arguments
      if (!src || !out) {
        logger.error('Error: Both <src> and <out> paths are required');
        process.exit(1);
      }
      await svgService.startWatching({ src, out });

      // Keep the process running
      process.on('SIGINT', () => {
        logger.info('Shutting down watch mode...');
        svgService.shutdown();
        process.exit(0);
      });
    } catch (error) {
      logger.error('Watch mode failed:', error);
      process.exit(1);
    }
  });

// -------- Generate Single SVG --------
/**
 * Generate a component from a single SVG file.
 */
program
  .command('generate <svgFile> <out>')
  .description('Convert a single SVG file into a component')
  .option(
    '--framework <type>',
    'Target framework (react|vue|svelte|angular|solid|preact|lit|vanilla)'
  )
  .option('--typescript', 'Generate TypeScript component (default: true)')
  .option('--no-typescript', 'Generate JavaScript component')
  .option('--composition', 'Use Vue Composition API with <script setup>')
  .option('--standalone', 'Generate Angular standalone component')
  .option(
    '--optimize <level>',
    'Optimization level: none, basic, balanced, aggressive, maximum (default: basic)'
  )
  .action(async (args: string[], opts: Record<string, any>) => {
    try {
      const [svgFile, out] = args;

      const generateConfig: any = { svgFile, outDir: out };

      if (opts.framework) {
        generateConfig.framework = opts.framework;
      }

      if (opts.typescript !== undefined) {
        generateConfig.typescript = opts.typescript;
      }

      if (opts.optimize) {
        generateConfig.optimize = opts.optimize;
      }

      const frameworkOptions: any = {};

      if (opts.composition !== undefined) {
        frameworkOptions.scriptSetup = opts.composition;
      }

      if (opts.standalone !== undefined) {
        frameworkOptions.standalone = opts.standalone;
      }

      if (Object.keys(frameworkOptions).length > 0) {
        generateConfig.frameworkOptions = frameworkOptions;
      }

      await svgService.generateSingle(generateConfig);
    } catch (error) {
      logger.error('Generation failed:', error);
      process.exit(1);
    }
  });

// -------- Lock / Unlock --------
/**
 * Lock one or more SVG files to prevent accidental overwrites.
 */
program
  .command('lock <files...>')
  .description('Lock one or more SVG files')
  .action((args: string[]) => {
    try {
      svgService.lockService.lockFiles(args);
    } catch (error) {
      logger.error('Lock operation failed:', error);
      process.exit(1);
    }
  });

/**
 * Unlock one or more SVG files to allow modifications.
 */
program
  .command('unlock <files...>')
  .description('Unlock one or more SVG files')
  .action((args: string[]) => {
    try {
      svgService.lockService.unlockFiles(args);
    } catch (error) {
      logger.error('Unlock operation failed:', error);
      process.exit(1);
    }
  });

// -------- Config --------
/**
 * Manage svger-cli configuration.
 */
program
  .command('config')
  .description('Manage svger-cli configuration')
  .option('--init', 'Create default .svgconfig.json')
  .option('--set <keyValue>', 'Set config key=value')
  .option('--show', 'Show current config')
  .action(async (_args: string[], opts: Record<string, any>) => {
    try {
      if (opts.init) return await configService.initConfig();
      if (opts.set) {
        const [key, value] = opts.set.split('=');
        if (!key || value === undefined) {
          logger.error('Invalid format. Use key=value');
          process.exit(1);
        }

        // Parse value with O(1) lookup for known literals, then type detection
        const literalValues: Record<string, any> = {
          true: true,
          false: false,
        };
        let parsedValue: any;

        if (value in literalValues) {
          parsedValue = literalValues[value];
        } else if (!isNaN(Number(value)) && value.trim() !== '') {
          parsedValue = Number(value);
        } else {
          parsedValue = value;
        }

        return configService.setConfig(key, parsedValue);
      }
      if (opts.show) return configService.showConfig();
      logger.error('No option provided. Use --init, --set, or --show');
      process.exit(1);
    } catch (error) {
      logger.error('Config operation failed:', error);
      process.exit(1);
    }
  });

// -------- Plugins Command --------
/**
 * Manage and list plugins
 */
program
  .command('plugins')
  .description('List all registered plugins and their metrics')
  .option('--load <names>', 'Load plugin(s) by name or path (comma-separated)')
  .action(async (_args: string[], opts: Record<string, any>) => {
    try {
      // Load plugins if specified
      if (opts.load) {
        const plugins = opts.load.split(',').map((p: string) => p.trim());
        for (const pluginNameOrPath of plugins) {
          await loadPlugin(pluginNameOrPath);
        }
      }

      // List all registered plugins
      listRegisteredPlugins();
    } catch (error) {
      logger.error('Plugin operation failed:', error);
      process.exit(1);
    }
  });

// -------- Optimize Command --------
/**
 * Optimize SVG files without converting to components
 */
program
  .command('optimize <input> [output]')
  .description('Optimize SVG files without converting to components')
  .option(
    '--level <type>',
    'Optimization level: basic, balanced, aggressive, maximum (default: balanced)'
  )
  .option('--validate', 'Run visual diff validation')
  .option('--in-place', 'Optimize files in-place (overwrite originals)')
  .action(async (args: string[], opts: Record<string, any>) => {
    try {
      const [input, output = opts.inPlace ? input : args[1] || input] = args;

      if (!input) {
        logger.error('Error: Input path is required');
        process.exit(1);
      }

      // Validate optimization level if provided — O(1) Set.has()
      const validOptLevels = new Set([
        'basic',
        'balanced',
        'aggressive',
        'maximum',
      ]);
      const level = opts.level || 'balanced';

      if (!validOptLevels.has(level)) {
        logger.error(
          `Error: Invalid optimization level "${level}". Valid options: ${[...validOptLevels].join(', ')}`
        );
        process.exit(1);
      }

      const inputDir = path.resolve(input);
      const outputDir = opts.inPlace ? inputDir : path.resolve(output);

      // Validate input directory
      if (!(await FileSystem.exists(inputDir))) {
        logger.error(`Error: Input directory not found: ${inputDir}`);
        process.exit(1);
      }

      // Set optimization level
      svgService.setOptimizerLevel(level);

      logger.info(`Optimizing SVG files at ${level.toUpperCase()} level...`);
      logger.info(`Input: ${inputDir}`);
      logger.info(`Output: ${outputDir}`);

      // Ensure output directory exists
      await FileSystem.ensureDir(outputDir);

      // Read all SVG files
      const files = await FileSystem.readDir(inputDir);
      const svgFiles = files.filter((file: string) => file.endsWith('.svg'));

      if (svgFiles.length === 0) {
        logger.warn('No SVG files found in input directory');
        return;
      }

      let optimized = 0;
      let failed = 0;

      // Process each SVG file
      for (const file of svgFiles) {
        try {
          const inputPath = path.join(inputDir, file);
          const outputPath = path.join(outputDir, file);

          const content = await FileSystem.readFile(inputPath, 'utf-8');
          const optimizedContent = await svgProcessor.cleanSVGContent(content);

          await FileSystem.writeFile(outputPath, optimizedContent, 'utf-8');
          optimized++;

          logger.info(`✓ Optimized: ${file}`);
        } catch (error) {
          failed++;
          logger.error(
            `✗ Failed: ${file} - ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      logger.success(
        `Optimization complete! ${optimized} optimized, ${failed} failed`
      );

      if (opts.validate) {
        logger.warn(
          'Visual validation not yet implemented for optimize command'
        );
      }
    } catch (error) {
      logger.error('Optimization failed:', error);
      process.exit(1);
    }
  });

// -------- Clean Command --------
/**
 * Remove all generated SVG React components from an output folder.
 */
program
  .command('clean <out>')
  .description('Remove all generated SVG React components from output folder')
  .action(async (args: string[]) => {
    try {
      const [out] = args;
      await svgService.clean(out);
    } catch (error) {
      logger.error('Clean operation failed:', error);
      process.exit(1);
    }
  });

await program.parse();

// Ensure the process exits after CLI execution completes
// (imported singletons may keep the event loop alive)
process.exit(0);
