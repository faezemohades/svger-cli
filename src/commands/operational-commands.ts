import path from 'path';
import type { Command } from '../application/command.js';
import {
  DiagnosticError,
  ExitCode,
  exitCodeFromUnknown,
} from '../contracts/diagnostics.js';
import type { SVGService } from '../services/svg-service.js';
import type { ConfigService } from '../services/config.js';
import type { SVGProcessor } from '../processors/svg-processor.js';
import type {
  FrameworkOptions,
  FrameworkType,
  Logger,
  SVGConfig,
  UnsafeInputPolicy,
} from '../types/index.js';
import { FileSystem } from '../utils/native.js';
import { resolveOutputArtifactPath } from '../security/input-safety.js';
import type { SVGCompiler } from '../compiler/create-svg-compiler.js';

const FRAMEWORKS = new Set<FrameworkType>([
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
const OPTIMIZATION_LEVELS = new Set([
  'basic',
  'balanced',
  'aggressive',
  'maximum',
]);

export interface GenerateCommandOptions {
  svgFile: string;
  outDir: string;
  framework?: FrameworkType;
  frameworkOptions?: FrameworkOptions;
  optimize?: string;
  typescript?: boolean;
  maxInputSizeBytes?: number;
  unsafeInputPolicy?: UnsafeInputPolicy;
  signal?: AbortSignal;
}

export class GenerateCommand implements Command<GenerateCommandOptions, void> {
  public constructor(private readonly service: SVGService) {}

  public validate(options: GenerateCommandOptions): void {
    if (!options.svgFile || !options.outDir) {
      throw new DiagnosticError(
        'E_USAGE_GENERATE_PATHS',
        'Both SVG input and output paths are required.',
        { exitCode: ExitCode.UsageError }
      );
    }
    if (options.framework && !FRAMEWORKS.has(options.framework)) {
      throw new DiagnosticError(
        'E_INVALID_FRAMEWORK',
        `Unknown framework: ${options.framework}`,
        { exitCode: ExitCode.InvalidConfiguration }
      );
    }
  }

  public execute(options: GenerateCommandOptions): Promise<void> {
    return this.service.generateSingle(options);
  }
}

export interface WatchCommandOptions {
  src: string;
  out: string;
  config?: Partial<SVGConfig>;
  maxInputSizeBytes?: number;
  unsafeInputPolicy?: UnsafeInputPolicy;
  signal?: AbortSignal;
}

export class WatchCommand implements Command<WatchCommandOptions, string> {
  public constructor(private readonly service: SVGService) {}

  public validate(options: WatchCommandOptions): void {
    if (!options.src || !options.out) {
      throw new DiagnosticError(
        'E_USAGE_WATCH_PATHS',
        'Both source and output paths are required.',
        { exitCode: ExitCode.UsageError }
      );
    }
  }

  public execute(options: WatchCommandOptions): Promise<string> {
    return this.service.startWatching(options);
  }
}

export interface FileLockCommandOptions {
  files: string[];
}

export class LockCommand implements Command<FileLockCommandOptions, void> {
  public constructor(private readonly service: SVGService) {}

  public validate(options: FileLockCommandOptions): void {
    if (options.files.length === 0) {
      throw new DiagnosticError('E_USAGE_LOCK_FILES', 'Files are required.', {
        exitCode: ExitCode.UsageError,
      });
    }
  }

  public async execute(options: FileLockCommandOptions): Promise<void> {
    this.service.lockService.lockFiles(options.files);
  }
}

export class UnlockCommand implements Command<FileLockCommandOptions, void> {
  public constructor(private readonly service: SVGService) {}

  public validate(options: FileLockCommandOptions): void {
    if (options.files.length === 0) {
      throw new DiagnosticError('E_USAGE_UNLOCK_FILES', 'Files are required.', {
        exitCode: ExitCode.UsageError,
      });
    }
  }

  public async execute(options: FileLockCommandOptions): Promise<void> {
    this.service.lockService.unlockFiles(options.files);
  }
}

export type ConfigCommandOptions =
  | { action: 'init' }
  | { action: 'show' }
  | { action: 'set'; keyValue: string };

export class ConfigCommand implements Command<ConfigCommandOptions, unknown> {
  public constructor(private readonly service: ConfigService) {}

  public validate(options: ConfigCommandOptions): void {
    if (options.action === 'set' && !options.keyValue.includes('=')) {
      throw new DiagnosticError(
        'E_CONFIG_SET_FORMAT',
        'Configuration assignment must use key=value.',
        { exitCode: ExitCode.UsageError }
      );
    }
  }

  public async execute(options: ConfigCommandOptions): Promise<unknown> {
    if (options.action === 'init') return this.service.initConfig();
    if (options.action === 'show') return this.service.readConfig();

    const separator = options.keyValue.indexOf('=');
    const key = options.keyValue.slice(0, separator);
    const rawValue = options.keyValue.slice(separator + 1);
    let value: string | number | boolean = rawValue;
    if (rawValue === 'true' || rawValue === 'false') {
      value = rawValue === 'true';
    } else if (rawValue.trim() !== '' && Number.isFinite(Number(rawValue))) {
      value = Number(rawValue);
    }
    this.service.setConfig(key, value);
    return { key, value };
  }
}

export interface ConfigExplainCommandOptions {
  path?: string;
}

export class ConfigExplainCommand
  implements
    Command<
      ConfigExplainCommandOptions,
      readonly { path: string; origin: string; value: unknown }[]
    >
{
  public constructor(private readonly compiler: SVGCompiler) {}

  public validate(_options: ConfigExplainCommandOptions): void {}

  public async execute(
    options: ConfigExplainCommandOptions
  ): Promise<readonly { path: string; origin: string; value: unknown }[]> {
    const entries = this.compiler.config.explain();
    return options.path
      ? entries.filter(entry => entry.path === options.path)
      : entries;
  }
}

export interface PluginsCommandOptions {
  load?: readonly string[];
}

export interface PluginCommandOperations {
  load(name: string): Promise<void>;
  list(): unknown;
}

export class PluginsCommand implements Command<PluginsCommandOptions, unknown> {
  public constructor(private readonly operations: PluginCommandOperations) {}

  public validate(options: PluginsCommandOptions): void {
    if (options.load?.some(name => name.length === 0)) {
      throw new DiagnosticError('E_PLUGIN_NAME', 'Plugin name is empty.', {
        exitCode: ExitCode.UsageError,
      });
    }
  }

  public async execute(options: PluginsCommandOptions): Promise<unknown> {
    for (const plugin of options.load ?? []) await this.operations.load(plugin);
    return this.operations.list();
  }
}

export interface OptimizeCommandOptions {
  input: string;
  output: string;
  level: string;
  inPlace?: boolean;
  validate?: boolean;
  maxInputSizeBytes?: number;
  unsafeInputPolicy?: UnsafeInputPolicy;
  signal?: AbortSignal;
}

export interface OptimizeCommandResult {
  optimized: number;
  failed: number;
  exitCode: ExitCode;
}

export class OptimizeCommand
  implements Command<OptimizeCommandOptions, OptimizeCommandResult>
{
  public constructor(
    private readonly service: SVGService,
    private readonly processor: SVGProcessor,
    private readonly logger: Logger
  ) {}

  public validate(options: OptimizeCommandOptions): void {
    if (!options.input) {
      throw new DiagnosticError(
        'E_USAGE_OPTIMIZE_INPUT',
        'Input is required.',
        {
          exitCode: ExitCode.UsageError,
        }
      );
    }
    if (!OPTIMIZATION_LEVELS.has(options.level)) {
      throw new DiagnosticError(
        'E_INVALID_OPTIMIZATION_LEVEL',
        `Unknown optimization level: ${options.level}`,
        { exitCode: ExitCode.InvalidConfiguration }
      );
    }
  }

  public async execute(
    options: OptimizeCommandOptions
  ): Promise<OptimizeCommandResult> {
    const inputDir = path.resolve(options.input);
    const outputDir = path.resolve(
      options.inPlace ? options.input : options.output
    );
    if (!(await FileSystem.exists(inputDir))) {
      throw new DiagnosticError(
        'E_OPTIMIZE_INPUT_NOT_FOUND',
        `Input directory not found: ${inputDir}`,
        { exitCode: ExitCode.FilesystemFailure, file: inputDir }
      );
    }
    this.service.setOptimizerLevel(options.level);
    await FileSystem.ensureDir(outputDir);
    const files = (await FileSystem.readDir(inputDir))
      .filter(file => /\.svg$/iu.test(file))
      .sort((left, right) => left.localeCompare(right, 'en'));
    let optimized = 0;
    let failed = 0;
    let exitCode = ExitCode.Success;
    for (const file of files) {
      try {
        if (options.signal?.aborted) {
          throw Object.assign(new Error('Optimization was cancelled.'), {
            code: 'ABORT_ERR',
            cause: options.signal.reason,
          });
        }
        const inputPath = path.join(inputDir, file);
        const outputPath = resolveOutputArtifactPath(outputDir, file);
        const content = await FileSystem.readFile(inputPath, 'utf8');
        const result = await this.processor.cleanSVGContent(content, {
          source: inputPath,
          maxInputSizeBytes: options.maxInputSizeBytes,
          unsafeInputPolicy: options.unsafeInputPolicy,
        });
        await FileSystem.writeFile(outputPath, result, 'utf8');
        optimized++;
      } catch (error) {
        failed++;
        if (exitCode === ExitCode.Success)
          exitCode = exitCodeFromUnknown(error);
        this.logger.error(`Failed to optimize ${file}:`, error);
      }
    }
    return { optimized, failed, exitCode };
  }
}

export interface CleanCommandOptions {
  output: string;
}

export class CleanCommand implements Command<CleanCommandOptions, void> {
  public constructor(private readonly service: SVGService) {}

  public validate(options: CleanCommandOptions): void {
    if (!options.output) {
      throw new DiagnosticError('E_USAGE_CLEAN_OUTPUT', 'Output is required.', {
        exitCode: ExitCode.UsageError,
      });
    }
  }

  public execute(options: CleanCommandOptions): Promise<void> {
    return this.service.clean(options.output);
  }
}
