import fs from 'fs';
import { promisify } from 'util';

type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'ucs2'
  | 'ucs-2'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'hex';

type JsonObject = Record<string, unknown>;
type CLIOptionValue = string | boolean;
export type CLIOptions = Record<string, CLIOptionValue>;
type CLIAction = (args: string[], options: CLIOptions) => void | Promise<void>;
type CommandOptionConfig = { description: string; hasValue: boolean };
type WatcherCallback = (...args: unknown[]) => void;

class CLIUsageError extends Error {
  public readonly exitCode = 2;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function writeStdout(message: string): void {
  process.stdout.write(`${message}\n`);
}

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * Native Node.js utilities to replace external dependencies
 */

/**
 * Convert a string to PascalCase, preserving existing capital letters.
 *
 * @param {string} str - Input string to convert.
 * @returns {string} PascalCase string.
 *
 * @example
 * toPascalCase('hello-world') => 'HelloWorld'
 * toPascalCase('hello_world') => 'HelloWorld'
 * toPascalCase('hello world') => 'HelloWorld'
 * toPascalCase('ArrowBendDownLeft') => 'ArrowBendDownLeft'
 */
export function toPascalCase(str: string): string {
  // If the string is already in PascalCase format (no separators and starts with capital), preserve it
  if (/^[A-Z]/.test(str) && !/[-_\s]/.test(str)) {
    return str;
  }

  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, char => char.toUpperCase());
}

/**
 * Convert a string to camelCase.
 *
 * @param {string} str - Input string to convert.
 * @returns {string} camelCase string.
 *
 * @example
 * toCamelCase('hello-world') => 'helloWorld'
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert a string to kebab-case.
 *
 * @param {string} str - Input string to convert.
 * @returns {string} kebab-case string.
 *
 * @example
 * toKebabCase('HelloWorld') => 'hello-world'
 * toKebabCase('hello_world') => 'hello-world'
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Native file system utilities (replaces fs-extra package)
 */
export class FileSystem {
  private static _readFile = promisify(fs.readFile);
  private static _writeFile = promisify(fs.writeFile);
  private static _readdir = promisify(fs.readdir);
  private static _stat = promisify(fs.stat);
  private static _mkdir = promisify(fs.mkdir);
  private static _unlink = promisify(fs.unlink);

  static async exists(path: string): Promise<boolean> {
    try {
      await this._stat(path);
      return true;
    } catch {
      return false;
    }
  }

  static async readFile(
    path: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<string> {
    return this._readFile(path, encoding) as unknown as Promise<string>;
  }

  static async writeFile(
    path: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    return this._writeFile(path, content, encoding);
  }

  static async readDir(path: string): Promise<string[]> {
    return this._readdir(path);
  }

  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await this._mkdir(dirPath, { recursive: true });
    } catch (error: unknown) {
      if (!hasErrorCode(error, 'EEXIST')) {
        throw error;
      }
    }
  }

  static async removeDir(dirPath: string): Promise<void> {
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
    } catch (error: unknown) {
      if (!hasErrorCode(error, 'ENOENT')) {
        throw error;
      }
    }
  }

  static async emptyDir(dirPath: string): Promise<void> {
    if (!(await this.exists(dirPath))) {
      return;
    }

    const files = await this._readdir(dirPath);

    for (const file of files) {
      const filePath = `${dirPath}/${file}`;
      const stats = await this._stat(filePath);

      if (stats.isDirectory()) {
        await this.removeDir(filePath);
      } else {
        await this._unlink(filePath);
      }
    }
  }

  static async unlink(filePath: string): Promise<void> {
    return this._unlink(filePath);
  }

  static readJSONSync<T = JsonObject>(path: string): T | JsonObject {
    try {
      const content = fs.readFileSync(path, 'utf8');
      return JSON.parse(content) as T;
    } catch {
      return {};
    }
  }

  static writeJSONSync(
    path: string,
    data: unknown,
    options?: { spaces?: number }
  ): void {
    const content = JSON.stringify(data, null, options?.spaces || 0);
    fs.writeFileSync(path, content, 'utf8');
  }

  static existsSync(path: string): boolean {
    try {
      fs.statSync(path);
      return true;
    } catch {
      return false;
    }
  }

  static ensureDirSync(dirPath: string): void {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error: unknown) {
      if (!hasErrorCode(error, 'EEXIST')) {
        throw error;
      }
    }
  }
}

/**
 * Simple CLI argument parser (replaces commander package)
 */
export class CLI {
  private commands: Map<
    string,
    {
      description: string;
      action: CLIAction;
      options: Map<string, CommandOptionConfig>;
    }
  > = new Map();

  private programName = '';
  private programDescription = '';
  private programVersion = '';

  name(name: string): this {
    this.programName = name;
    return this;
  }

  description(desc: string): this {
    this.programDescription = desc;
    return this;
  }

  version(version: string): this {
    this.programVersion = version;
    return this;
  }

  command(signature: string): CommandBuilder {
    return new CommandBuilder(signature, this);
  }

  addCommand(
    signature: string,
    description: string,
    action: CLIAction,
    options: Map<string, CommandOptionConfig>
  ): void {
    const [command] = signature.split(' ');
    this.commands.set(command, {
      description,
      action,
      options,
    });
  }

  async parse(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      this.showHelp();
      return;
    }

    if (args[0] === '--version' || args[0] === '-v') {
      writeStdout(this.programVersion);
      return;
    }

    const [commandName, ...remainingArgs] = args;
    const command = this.commands.get(commandName);

    if (!command) {
      writeStderr(`Unknown command: ${commandName}`);
      this.showHelp();
      process.exit(2);
    }

    // Check for subcommand help before parsing args
    if (remainingArgs.includes('--help') || remainingArgs.includes('-h')) {
      this.showCommandHelp(commandName, command);
      return;
    }

    try {
      const { parsedArgs, options } = this.parseArgs(
        remainingArgs,
        command.options
      );
      await command.action(parsedArgs, options);
    } catch (error) {
      writeStderr(`Command failed: ${formatUnknownError(error)}`);
      const exitCode =
        typeof error === 'object' &&
        error !== null &&
        'exitCode' in error &&
        typeof (error as { exitCode?: unknown }).exitCode === 'number'
          ? (error as { exitCode: number }).exitCode
          : 1;
      process.exit(exitCode);
    }
  }

  private parseArgs(
    args: string[],
    commandOptions: Map<string, CommandOptionConfig>
  ): {
    parsedArgs: string[];
    options: CLIOptions;
  } {
    const parsedArgs: string[] = [];
    const options: CLIOptions = {};

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const optionName = arg.slice(2);
        const optionConfig = commandOptions.get(optionName);

        if (optionConfig) {
          if (optionConfig.hasValue) {
            if (args[i + 1] === undefined || args[i + 1].startsWith('--')) {
              throw new CLIUsageError(
                `Option --${optionName} requires a value.`
              );
            }
            options[optionName] = args[i + 1];
            i += 2;
          } else {
            options[optionName] = true;
            i++;
          }
        } else {
          // Handle key=value format
          if (arg.includes('=')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value;
            i++;
          } else {
            throw new CLIUsageError(`Unknown option: ${arg}`);
          }
        }
      } else {
        parsedArgs.push(arg);
        i++;
      }
    }

    return { parsedArgs, options };
  }

  private showHelp(): void {
    writeStdout(`${this.programName} - ${this.programDescription}`);
    writeStdout(`Version: ${this.programVersion}\n`);
    writeStdout('Commands:');

    for (const [name, cmd] of this.commands) {
      writeStdout(`  ${name.padEnd(15)} ${cmd.description}`);
    }

    writeStdout('\nOptions:');
    writeStdout('  --help, -h      Show help');
    writeStdout('  --version, -v   Show version');
  }

  private showCommandHelp(
    commandName: string,
    command: {
      description: string;
      action: CLIAction;
      options: Map<string, CommandOptionConfig>;
    }
  ): void {
    writeStdout(`${this.programName} ${commandName}`);
    writeStdout(`\n${command.description}\n`);

    if (command.options.size > 0) {
      writeStdout('Options:');
      for (const [name, opt] of command.options) {
        const flag = opt.hasValue ? `--${name} <value>` : `--${name}`;
        writeStdout(`  ${flag.padEnd(25)} ${opt.description}`);
      }
    }

    writeStdout('\nGlobal Options:');
    writeStdout('  --help, -h                Show help');
  }
}

class CommandBuilder {
  private signature: string;
  private desc = '';
  private cli: CLI;
  private options: Map<string, CommandOptionConfig> = new Map();

  constructor(signature: string, cli: CLI) {
    this.signature = signature;
    this.cli = cli;
  }

  description(desc: string): this {
    this.desc = desc;
    return this;
  }

  option(flag: string, description: string): this {
    const hasValue = flag.includes('<') || flag.includes('[');
    const optionName = flag.split(' ')[0].replace(/^--/, '');
    this.options.set(optionName, { description, hasValue });
    return this;
  }

  action(fn: CLIAction): void {
    this.cli.addCommand(this.signature, this.desc, fn, this.options);
  }
}

/**
 * File watcher using native fs.watch (replaces chokidar)
 */
export class FileWatcher {
  private watchers: fs.FSWatcher[] = [];
  private callbacks: Map<string, WatcherCallback[]> = new Map();

  watch(path: string, options?: { recursive?: boolean }): this {
    try {
      const watcher = fs.watch(
        path,
        {
          recursive: options?.recursive || false,
          persistent: true,
        },
        (eventType, filename) => {
          if (filename) {
            this.emit(eventType, `${path}/${filename}`);
          }
        }
      );

      watcher.on('error', error => {
        this.emit('error', error);
      });

      this.watchers.push(watcher);
    } catch (error) {
      // Emit error event so consumers can handle it
      this.emit('error', error);
    }

    return this;
  }

  on(event: string, callback: WatcherCallback): this {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
    return this;
  }

  private emit(event: string, ...args: unknown[]): void {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        writeStderr(`Watcher callback error: ${formatUnknownError(error)}`);
      }
    });
  }

  close(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    this.callbacks.clear();
  }
}
