import fs from 'fs';
import { promisify } from 'util';

/**
 * Native Node.js utilities to replace external dependencies
 */

/**
 * Convert string to PascalCase (replaces change-case package)
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
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
  private static _rmdir = promisify(fs.rmdir);
  private static _unlink = promisify(fs.unlink);

  static async exists(path: string): Promise<boolean> {
    try {
      await this._stat(path);
      return true;
    } catch {
      return false;
    }
  }

  static async readFile(path: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return this._readFile(path, encoding);
  }

  static async writeFile(path: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    return this._writeFile(path, content, encoding);
  }

  static async readDir(path: string): Promise<string[]> {
    return this._readdir(path);
  }

  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await this._mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  static async removeDir(dirPath: string): Promise<void> {
    try {
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
      
      await this._rmdir(dirPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
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

  static readJSONSync(path: string): any {
    try {
      const content = fs.readFileSync(path, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  static writeJSONSync(path: string, data: any, options?: { spaces?: number }): void {
    const content = JSON.stringify(data, null, options?.spaces || 0);
    fs.writeFileSync(path, content, 'utf8');
  }
}

/**
 * Simple CLI argument parser (replaces commander package)
 */
export class CLI {
  private commands: Map<string, {
    description: string;
    action: (args: string[], options: Record<string, any>) => void | Promise<void>;
    options: Map<string, { description: string; hasValue: boolean }>;
  }> = new Map();

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

  addCommand(signature: string, description: string, action: Function, options: Map<string, any>): void {
    const [command] = signature.split(' ');
    this.commands.set(command, {
      description,
      action: action as any,
      options
    });
  }

  async parse(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      this.showHelp();
      return;
    }

    if (args[0] === '--version' || args[0] === '-v') {
      console.log(this.programVersion);
      return;
    }

    const [commandName, ...remainingArgs] = args;
    const command = this.commands.get(commandName);

    if (!command) {
      console.error(`Unknown command: ${commandName}`);
      this.showHelp();
      process.exit(1);
    }

    const { parsedArgs, options } = this.parseArgs(remainingArgs, command.options);
    
    try {
      await command.action(parsedArgs, options);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  }

  private parseArgs(args: string[], commandOptions: Map<string, any>): {
    parsedArgs: string[];
    options: Record<string, any>;
  } {
    const parsedArgs: string[] = [];
    const options: Record<string, any> = {};
    
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const optionName = arg.slice(2);
        const optionConfig = commandOptions.get(optionName);
        
        if (optionConfig) {
          if (optionConfig.hasValue) {
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
            i++;
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
    console.log(`${this.programName} - ${this.programDescription}`);
    console.log(`Version: ${this.programVersion}\n`);
    console.log('Commands:');
    
    for (const [name, cmd] of this.commands) {
      console.log(`  ${name.padEnd(15)} ${cmd.description}`);
    }
    
    console.log('\nOptions:');
    console.log('  --help, -h      Show help');
    console.log('  --version, -v   Show version');
  }
}

class CommandBuilder {
  private signature: string;
  private desc = '';
  private cli: CLI;
  private options: Map<string, { description: string; hasValue: boolean }> = new Map();

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

  action(fn: Function): void {
    this.cli.addCommand(this.signature, this.desc, fn, this.options);
  }
}

/**
 * File watcher using native fs.watch (replaces chokidar)
 */
export class FileWatcher {
  private watchers: fs.FSWatcher[] = [];
  private callbacks: Map<string, Function[]> = new Map();

  watch(path: string, options?: { recursive?: boolean }): this {
    try {
      const watcher = fs.watch(path, { 
        recursive: options?.recursive || false,
        persistent: true 
      }, (eventType, filename) => {
        if (filename) {
          this.emit(eventType, `${path}/${filename}`);
        }
      });

      this.watchers.push(watcher);
    } catch (error) {
      console.error(`Failed to watch ${path}:`, error);
    }

    return this;
  }

  on(event: string, callback: Function): this {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
    return this;
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error('Watcher callback error:', error);
      }
    });
  }

  close(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    this.callbacks.clear();
  }
}