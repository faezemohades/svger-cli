#!/usr/bin/env node
import { CLI, type CLIOptions } from './utils/native.js';
import { svgService } from './services/svg-service.js';
import { configService } from './services/config.js';
import { logger } from './core/logger.js';
import { getPluginManager } from './core/enhanced-plugin-manager.js';
import { svgProcessor } from './processors/svg-processor.js';
import { registerBuiltInPlugins } from './plugins/builtins.js';
import type {
  BuildOptions,
  FrameworkOptions,
  FrameworkType,
  GenerateOptions,
  UnsafeInputPolicy,
} from './types/index.js';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { getPackageInfo } from './utils/package-info.js';
import { createSVGCompiler } from './compiler/create-svg-compiler.js';
import { BuildCommand } from './commands/build-command.js';
import { executeCommand } from './application/command.js';
import {
  DiagnosticError,
  ExitCode,
  diagnosticFromUnknown,
  exitCodeFromUnknown,
} from './contracts/diagnostics.js';
import {
  createBuildReport,
  formatBuildReport,
  type BuildMode,
  type ReportFormat,
} from './contracts/reporting.js';
import type { CollisionPolicy } from './application/build-plan.js';
import type { SymlinkPolicy } from './application/source-discovery.js';
import { RecoverCommand } from './commands/recover-command.js';
import { MigrateCommand } from './commands/migrate-command.js';
import type { MigrationTarget } from './migration/migration-toolkit.js';
import {
  CleanCommand,
  ConfigCommand,
  ConfigExplainCommand,
  GenerateCommand,
  LockCommand,
  OptimizeCommand,
  PluginsCommand,
  UnlockCommand,
  WatchCommand,
} from './commands/operational-commands.js';

type BuildRuntimeOptions = BuildOptions & {
  framework?: FrameworkType;
  frameworkOptions?: FrameworkOptions;
  optimize?: string;
  typescript?: boolean;
};

type GenerateRuntimeOptions = GenerateOptions & {
  framework?: FrameworkType;
  frameworkOptions?: FrameworkOptions;
  optimize?: string;
  typescript?: boolean;
};

interface SafetyCommandOptions {
  'max-input-size'?: string;
  'unsafe-input-policy'?: string;
}

interface BuildCommandOptions extends SafetyCommandOptions {
  'batch-size'?: string;
  check?: boolean;
  collision?: CollisionPolicy;
  composition?: boolean;
  concurrency?: string;
  diff?: boolean;
  'dry-run'?: boolean;
  exclude?: string;
  format?: ReportFormat;
  framework?: FrameworkType;
  hidden?: boolean;
  include?: string;
  'list-plugins'?: boolean;
  listPlugins?: boolean;
  'max-file-count'?: string;
  optimize?: string;
  plugin?: string;
  recursive?: boolean;
  signals?: boolean;
  standalone?: boolean;
  symlinks?: SymlinkPolicy;
  'no-typescript'?: boolean;
  typescript?: boolean;
}

interface GenerateCommandOptions extends SafetyCommandOptions {
  composition?: boolean;
  framework?: FrameworkType;
  optimize?: string;
  standalone?: boolean;
  'no-typescript'?: boolean;
  typescript?: boolean;
}

interface ConfigCommandOptions {
  explain?: boolean;
  format?: string;
  init?: boolean;
  set?: string;
  show?: boolean;
}

interface PluginsCommandOptions {
  load?: string;
}

interface OptimizeCommandOptions extends SafetyCommandOptions {
  'in-place'?: boolean;
  inPlace?: boolean;
  level?: string;
  validate?: boolean;
}

function applySafetyCommandOptions(
  source: SafetyCommandOptions,
  target: {
    maxInputSizeBytes?: number;
    unsafeInputPolicy?: UnsafeInputPolicy;
  }
): void {
  if (source['unsafe-input-policy']) {
    const policy = source['unsafe-input-policy'];
    if (policy !== 'reject' && policy !== 'strip') {
      throw new DiagnosticError(
        'E_INVALID_UNSAFE_INPUT_POLICY',
        `E_INVALID_UNSAFE_INPUT_POLICY: Expected "reject" or "strip", received "${policy}".`,
        { exitCode: ExitCode.UsageError }
      );
    }
    target.unsafeInputPolicy = policy;
  }

  if (source['max-input-size']) {
    const size = Number(source['max-input-size']);
    if (!Number.isSafeInteger(size) || size <= 0) {
      throw new DiagnosticError(
        'E_INVALID_INPUT_SIZE_LIMIT',
        '--max-input-size must be a positive integer.',
        { exitCode: ExitCode.UsageError }
      );
    }
    target.maxInputSizeBytes = size;
  }
}

function asCommandOptions<T>(options: CLIOptions): T {
  return options as unknown as T;
}

// Read version dynamically from package.json
const CLI_VERSION = getPackageInfo().version;

const program = new CLI();
let shouldExitAfterParse = true;
const compilerPromise = createSVGCompiler();

function parsePositiveInteger(
  value: string | undefined,
  flag: string
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new DiagnosticError(
      'E_INVALID_NUMERIC_OPTION',
      `${flag} must be a positive integer.`,
      { exitCode: ExitCode.UsageError }
    );
  }
  return parsed;
}

function parseCSV(value: string | undefined): readonly string[] | undefined {
  if (value === undefined) return undefined;
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function reportOperationalError(label: string, error: unknown): void {
  const diagnostic = diagnosticFromUnknown(error);
  logger.error(`${label}: ${diagnostic.code}: ${diagnostic.message}`);
  process.exitCode = exitCodeFromUnknown(error);
}

function ensureBuiltInPluginsRegistered(): void {
  registerBuiltInPlugins(getPluginManager());
}

/**
 * Load a plugin from npm package or local path
 */
async function loadPlugin(pluginNameOrPath: string): Promise<void> {
  const pluginManager = getPluginManager();
  ensureBuiltInPluginsRegistered();

  try {
    if (pluginManager.hasPlugin(pluginNameOrPath)) {
      pluginManager.activatePlugin(pluginNameOrPath);
      const plugin = pluginManager.getPlugin(pluginNameOrPath);
      logger.info(`Loaded plugin: ${plugin?.name} v${plugin?.version}`);
      return;
    }

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
  ensureBuiltInPluginsRegistered();
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
  .option(
    '--unsafe-input-policy <policy>',
    'Unsafe raw SVG policy: reject (default) or strip'
  )
  .option('--max-input-size <bytes>', 'Maximum raw SVG size in bytes')
  .option('--format <type>', 'Report format: pretty, json, or ndjson')
  .option('--recursive', 'Discover SVG files recursively')
  .option('--include <globs>', 'Comma-separated include globs')
  .option('--exclude <globs>', 'Comma-separated exclude globs')
  .option('--hidden', 'Include hidden files and directories')
  .option('--symlinks <policy>', 'Symlink policy: ignore, follow, or error')
  .option('--max-file-count <count>', 'Maximum discovered SVG file count')
  .option('--collision <policy>', 'Collision policy: error, first, or last')
  .option('--concurrency <count>', 'Maximum concurrent build jobs')
  .option('--batch-size <count>', 'Maximum scheduler batch size')
  .option('--dry-run', 'Plan and generate without filesystem changes')
  .option('--check', 'Fail when generated output is stale')
  .option('--diff', 'Report output changes without writing')
  .action(async (args: string[], opts: CLIOptions) => {
    const buildOptions = asCommandOptions<BuildCommandOptions>(opts);
    const format = buildOptions.format ?? 'pretty';
    try {
      // Handle --list-plugins flag
      if (buildOptions.listPlugins || buildOptions['list-plugins']) {
        listRegisteredPlugins();
        return;
      }

      // Load plugins if specified
      if (buildOptions.plugin) {
        const plugins = buildOptions.plugin.split(',').map(p => p.trim());
        for (const pluginNameOrPath of plugins) {
          await loadPlugin(pluginNameOrPath);
        }
      }

      const [src, out] = args;

      // Build config from CLI options
      const buildConfig: BuildRuntimeOptions & {
        mode?: BuildMode;
        collision?: CollisionPolicy;
        recursive?: boolean;
        include?: readonly string[];
        exclude?: readonly string[];
        includeHidden?: boolean;
        symlinks?: SymlinkPolicy;
        maxFileCount?: number;
        concurrency?: number;
        batchSize?: number;
      } = { src, out };
      applySafetyCommandOptions(buildOptions, buildConfig);

      if (buildOptions.framework) {
        buildConfig.framework = buildOptions.framework;
      }

      if (buildOptions['no-typescript']) {
        buildConfig.typescript = false;
      } else if (buildOptions.typescript !== undefined) {
        buildConfig.typescript = buildOptions.typescript;
      }

      if (buildOptions.optimize) {
        buildConfig.optimize = buildOptions.optimize;
      }

      // Framework-specific options
      const frameworkOptions: FrameworkOptions = {};

      if (buildOptions.composition !== undefined) {
        frameworkOptions.scriptSetup = buildOptions.composition;
      }

      if (buildOptions.standalone !== undefined) {
        frameworkOptions.standalone = buildOptions.standalone;
      }

      if (buildOptions.signals !== undefined) {
        frameworkOptions.signals = buildOptions.signals;
      }

      if (Object.keys(frameworkOptions).length > 0) {
        buildConfig.frameworkOptions = frameworkOptions;
      }
      buildConfig.recursive = buildOptions.recursive;
      buildConfig.include = parseCSV(buildOptions.include);
      buildConfig.exclude = parseCSV(buildOptions.exclude);
      buildConfig.includeHidden = buildOptions.hidden;
      buildConfig.symlinks = buildOptions.symlinks;
      buildConfig.collision = buildOptions.collision;
      buildConfig.maxFileCount = parsePositiveInteger(
        buildOptions['max-file-count'],
        '--max-file-count'
      );
      buildConfig.concurrency = parsePositiveInteger(
        buildOptions.concurrency,
        '--concurrency'
      );
      buildConfig.batchSize = parsePositiveInteger(
        buildOptions['batch-size'],
        '--batch-size'
      );
      const selectedModes = [
        buildOptions['dry-run'] ? 'dry-run' : undefined,
        buildOptions.check ? 'check' : undefined,
        buildOptions.diff ? 'diff' : undefined,
      ].filter((mode): mode is BuildMode => mode !== undefined);
      if (selectedModes.length > 1) {
        throw new DiagnosticError(
          'E_CONFLICTING_BUILD_MODES',
          '--dry-run, --check, and --diff are mutually exclusive.',
          { exitCode: ExitCode.UsageError }
        );
      }
      buildConfig.mode = selectedModes[0] ?? 'write';

      const command = new BuildCommand(await compilerPromise);
      const report = await executeCommand(command, {
        ...buildConfig,
        format,
      });
      process.stdout.write(`${formatBuildReport(report, format)}\n`);
      process.exitCode = report.exitCode;
    } catch (error) {
      const report = createBuildReport({
        exitCode: exitCodeFromUnknown(error),
        diagnostics: [diagnosticFromUnknown(error)],
      });
      process.stdout.write(`${formatBuildReport(report, format)}\n`);
      process.exitCode = report.exitCode;
    }
  });

// -------- Watch Command --------
/**
 * Watch a source folder and rebuild SVGs automatically on changes.
 */
program
  .command('watch <src> <out>')
  .description('Watch source folder and rebuild SVGs automatically')
  .option(
    '--unsafe-input-policy <policy>',
    'Unsafe raw SVG policy: reject (default) or strip'
  )
  .option('--max-input-size <bytes>', 'Maximum raw SVG size in bytes')
  .action(async (args: string[], opts: CLIOptions) => {
    try {
      shouldExitAfterParse = false;
      const [src, out] = args;
      const watchOptions: BuildRuntimeOptions = { src, out };
      applySafetyCommandOptions(
        asCommandOptions<SafetyCommandOptions>(opts),
        watchOptions
      );
      await executeCommand(new WatchCommand(svgService), watchOptions);

      // Keep the process running
      process.on('SIGINT', () => {
        logger.info('Shutting down watch mode...');
        svgService.shutdown();
        process.exit(0);
      });
    } catch (error) {
      shouldExitAfterParse = true;
      reportOperationalError('Watch mode failed', error);
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
  .option(
    '--unsafe-input-policy <policy>',
    'Unsafe raw SVG policy: reject (default) or strip'
  )
  .option('--max-input-size <bytes>', 'Maximum raw SVG size in bytes')
  .action(async (args: string[], opts: CLIOptions) => {
    try {
      const generateOptions = asCommandOptions<GenerateCommandOptions>(opts);
      const [svgFile, out] = args;

      const generateConfig: GenerateRuntimeOptions = { svgFile, outDir: out };
      applySafetyCommandOptions(generateOptions, generateConfig);

      if (generateOptions.framework) {
        generateConfig.framework = generateOptions.framework;
      }

      if (generateOptions['no-typescript']) {
        generateConfig.typescript = false;
      } else if (generateOptions.typescript !== undefined) {
        generateConfig.typescript = generateOptions.typescript;
      }

      if (generateOptions.optimize) {
        generateConfig.optimize = generateOptions.optimize;
      }

      const frameworkOptions: FrameworkOptions = {};

      if (generateOptions.composition !== undefined) {
        frameworkOptions.scriptSetup = generateOptions.composition;
      }

      if (generateOptions.standalone !== undefined) {
        frameworkOptions.standalone = generateOptions.standalone;
      }

      if (Object.keys(frameworkOptions).length > 0) {
        generateConfig.frameworkOptions = frameworkOptions;
      }

      await executeCommand(new GenerateCommand(svgService), generateConfig);
    } catch (error) {
      reportOperationalError('Generation failed', error);
    }
  });

// -------- Lock / Unlock --------
/**
 * Lock one or more SVG files to prevent accidental overwrites.
 */
program
  .command('lock <files...>')
  .description('Lock one or more SVG files')
  .action(async (args: string[]) => {
    try {
      await executeCommand(new LockCommand(svgService), { files: args });
    } catch (error) {
      reportOperationalError('Lock operation failed', error);
    }
  });

/**
 * Unlock one or more SVG files to allow modifications.
 */
program
  .command('unlock <files...>')
  .description('Unlock one or more SVG files')
  .action(async (args: string[]) => {
    try {
      await executeCommand(new UnlockCommand(svgService), { files: args });
    } catch (error) {
      reportOperationalError('Unlock operation failed', error);
    }
  });

// -------- Config --------
/**
 * Manage svger-cli configuration.
 */
program
  .command('config [action] [path]')
  .description('Manage svger-cli configuration')
  .option('--init', 'Create default .svgconfig.json')
  .option('--set <keyValue>', 'Set config key=value')
  .option('--show', 'Show current config')
  .option('--explain', 'Explain resolved configuration value origins')
  .option('--format <type>', 'Explain report format: pretty or json')
  .action(async (args: string[], opts: CLIOptions) => {
    try {
      const configOptions = asCommandOptions<ConfigCommandOptions>(opts);
      if (configOptions.explain || args[0] === 'explain') {
        const entries = await executeCommand(
          new ConfigExplainCommand(await compilerPromise),
          { path: args[1] }
        );
        if (configOptions.format === 'json') {
          process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
        } else {
          entries.forEach(entry =>
            process.stdout.write(
              `${entry.path} = ${JSON.stringify(entry.value)} (${entry.origin})\n`
            )
          );
        }
        return;
      }
      const command = new ConfigCommand(configService);
      if (configOptions.init) {
        await executeCommand(command, { action: 'init' });
        return;
      }
      if (configOptions.set) {
        await executeCommand(command, {
          action: 'set',
          keyValue: configOptions.set,
        });
        return;
      }
      if (configOptions.show) {
        const value = await executeCommand(command, { action: 'show' });
        process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
        return;
      }
      throw new DiagnosticError(
        'E_CONFIG_ACTION',
        'Use --init, --set, or --show.',
        { exitCode: ExitCode.UsageError }
      );
    } catch (error) {
      reportOperationalError('Config operation failed', error);
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
  .action(async (_args: string[], opts: CLIOptions) => {
    try {
      const pluginOptions = asCommandOptions<PluginsCommandOptions>(opts);

      await executeCommand(
        new PluginsCommand({
          load: loadPlugin,
          list: listRegisteredPlugins,
        }),
        { load: parseCSV(pluginOptions.load) }
      );
    } catch (error) {
      reportOperationalError('Plugin operation failed', error);
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
  .option(
    '--unsafe-input-policy <policy>',
    'Unsafe raw SVG policy: reject (default) or strip'
  )
  .option('--max-input-size <bytes>', 'Maximum raw SVG size in bytes')
  .action(async (args: string[], opts: CLIOptions) => {
    try {
      const optimizeOptions = asCommandOptions<OptimizeCommandOptions>(opts);
      const safetyOptions: {
        maxInputSizeBytes?: number;
        unsafeInputPolicy?: UnsafeInputPolicy;
      } = {};
      applySafetyCommandOptions(optimizeOptions, safetyOptions);
      const input = args[0];
      const inPlace = optimizeOptions.inPlace || optimizeOptions['in-place'];
      const output = inPlace ? input : args[1] || input;
      const level = optimizeOptions.level || 'balanced';
      const result = await executeCommand(
        new OptimizeCommand(svgService, svgProcessor, logger),
        {
          input,
          output,
          level,
          inPlace,
          validate: optimizeOptions.validate,
          ...safetyOptions,
        }
      );
      logger.success(
        `Optimization complete! ${result.optimized} optimized, ${result.failed} failed`
      );
      process.exitCode = result.exitCode;
    } catch (error) {
      reportOperationalError('Optimization failed', error);
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
      await executeCommand(new CleanCommand(svgService), { output: out });
    } catch (error) {
      reportOperationalError('Clean operation failed', error);
    }
  });

// -------- Recover Command --------
program
  .command('recover <directory>')
  .description('Inspect and roll back incomplete output transactions')
  .option('--format <type>', 'Report format: pretty or json')
  .action(async (args: string[], opts: CLIOptions) => {
    const format = opts.format === 'json' ? 'json' : 'pretty';
    try {
      const command = new RecoverCommand();
      const report = await executeCommand(command, { directory: args[0] });
      if (format === 'json') {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        process.stdout.write(
          `Inspected ${report.inspected} transaction journal(s); recovered ${report.recovered}.\n`
        );
        report.diagnostics.forEach(diagnostic =>
          process.stderr.write(`${diagnostic}\n`)
        );
      }
      process.exitCode = report.diagnostics.length
        ? ExitCode.FilesystemFailure
        : ExitCode.Success;
    } catch (error) {
      const report = createBuildReport({
        exitCode: exitCodeFromUnknown(error),
        diagnostics: [diagnosticFromUnknown(error)],
      });
      process.stdout.write(`${formatBuildReport(report, format)}\n`);
      process.exitCode = report.exitCode;
    }
  });

// -------- Migration Command --------
program
  .command('migrate <target> [path]')
  .description('Migrate v4 config, imports, or plugin declarations')
  .option('--dry-run', 'Preview the migration without writing')
  .option('--no-backup', 'Do not create a backup before writing')
  .option('--format <type>', 'Report format: pretty or json')
  .action(async (args: string[], opts: CLIOptions) => {
    const format = opts.format === 'json' ? 'json' : 'pretty';
    try {
      const target = args[0] as MigrationTarget;
      const inputPath =
        args[1] ?? (target === 'imports' ? process.cwd() : '.svgconfig.json');
      const command = new MigrateCommand();
      const report = await executeCommand(command, {
        target,
        inputPath,
        dryRun: opts['dry-run'] === true,
        backup: opts['no-backup'] !== true,
      });
      if (format === 'json') {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else if (report.changes.length === 0) {
        process.stdout.write('No migration changes are required.\n');
      } else {
        report.changes.forEach(change =>
          process.stdout.write(
            `${report.mode === 'dry-run' ? 'Would migrate' : 'Migrated'} ${change.file}\n`
          )
        );
      }
      process.exitCode = ExitCode.Success;
    } catch (error) {
      const report = createBuildReport({
        exitCode: exitCodeFromUnknown(error),
        diagnostics: [diagnosticFromUnknown(error)],
      });
      process.stdout.write(`${formatBuildReport(report, format)}\n`);
      process.exitCode = report.exitCode;
    }
  });

await program.parse();

// Ensure the process exits after CLI execution completes
// (imported singletons may keep the event loop alive)
if (shouldExitAfterParse) {
  process.exit(process.exitCode ?? 0);
}
