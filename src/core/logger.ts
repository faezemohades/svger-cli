import { Logger, LogLevel } from '../types/index.js';

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
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.getPrefix(level);
    return `${timestamp} ${prefix} ${message}`;
  }

  private getPrefix(level: LogLevel): string {
    if (!this.enableColors) {
      return `[${level.toUpperCase()}]`;
    }

    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[34m',  // Blue
      warn: '\x1b[33m',  // Yellow
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

  public debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  public success(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      const timestamp = new Date().toISOString();
      const prefix = this.getPrefix('info');
      const successPrefix = this.enableColors ? '✅ [SUCCESS]' : '[SUCCESS]';
      console.log(`${timestamp} ${successPrefix} ${message}`, ...args);
    }
  }
}

// Export singleton instance
export const logger = LoggerService.getInstance();