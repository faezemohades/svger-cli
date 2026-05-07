import { format } from 'util';
import { Logger, LogLevel } from '../types/index.js';

type WritableLogStream = Pick<typeof process.stdout, 'write'>;

/**
 * Professional logging service with configurable levels and formatted output
 */
export class LoggerService implements Logger {
  private static instance: LoggerService;
  private logLevel: LogLevel = 'info';
  private enableColors: boolean = true;

  private constructor() {}

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public setColors(enabled: boolean): void {
    this.enableColors = enabled;
  }

  private shouldLog(level: LogLevel): boolean {
    // O(1) Map lookup instead of O(n) indexOf on array
    const levelPriority: Record<string, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return (levelPriority[level] ?? 0) >= (levelPriority[this.logLevel] ?? 0);
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.getPrefix(level);
    return `${timestamp} ${prefix} ${message}`;
  }

  private write(
    stream: WritableLogStream,
    level: LogLevel,
    message: string,
    args: unknown[]
  ): void {
    stream.write(`${format(this.formatMessage(level, message), ...args)}\n`);
  }

  private getPrefix(level: LogLevel): string {
    if (!this.enableColors) {
      return `[${level.toUpperCase()}]`;
    }

    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[34m', // Blue
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      success: '\x1b[32m', // Green
    };

    const reset = '\x1b[0m';
    const color = colors[level as keyof typeof colors] || colors.info;

    const icons = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      success: '✅',
    };

    const icon = icons[level as keyof typeof icons] || icons.info;
    return `${color}${icon} [${level.toUpperCase()}]${reset}`;
  }

  public debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      this.write(process.stdout, 'debug', message, args);
    }
  }

  public info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      this.write(process.stdout, 'info', message, args);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      this.write(process.stderr, 'warn', message, args);
    }
  }

  public error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      this.write(process.stderr, 'error', message, args);
    }
  }

  public success(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      const timestamp = new Date().toISOString();
      const successPrefix = this.enableColors ? '✅ [SUCCESS]' : '[SUCCESS]';
      process.stdout.write(
        `${format(`${timestamp} ${successPrefix} ${message}`, ...args)}\n`
      );
    }
  }
}

// Export singleton instance
export const logger = LoggerService.getInstance();
