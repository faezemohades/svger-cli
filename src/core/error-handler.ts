import { logger } from '../core/logger.js';

type ErrorContext = Record<string, unknown>;
type RecoveryResult = unknown;

function isSVGError(error: Error | SVGError): error is SVGError {
  return 'code' in error && 'severity' in error;
}

function hasSeverity(
  value: unknown
): value is { severity: SVGError['severity'] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'severity' in value &&
    typeof (value as { severity?: unknown }).severity === 'string'
  );
}

function getContextString(
  context: ErrorContext | undefined,
  key: string
): string | undefined {
  const value = context?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getContextBoolean(
  context: ErrorContext | undefined,
  key: string
): boolean | undefined {
  const value = context?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Enhanced error handling system with detailed error tracking and recovery
 */

export interface SVGError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: ErrorContext;
  timestamp: number;
  stack?: string;
}

export interface ErrorRecoveryStrategy {
  canRecover(error: SVGError): boolean;
  recover(error: SVGError, context?: unknown): Promise<RecoveryResult>;
}

export class SVGErrorHandler {
  private static instance: SVGErrorHandler;
  private errorHistory: SVGError[] = [];
  private recoveryStrategies: Map<string, ErrorRecoveryStrategy> = new Map();
  private readonly maxHistorySize = 100;

  private constructor() {
    this.setupDefaultStrategies();
  }

  public static getInstance(): SVGErrorHandler {
    if (!SVGErrorHandler.instance) {
      SVGErrorHandler.instance = new SVGErrorHandler();
    }
    return SVGErrorHandler.instance;
  }

  /**
   * Handle an error with context and attempted recovery
   */
  public async handleError(
    error: Error | SVGError,
    context?: ErrorContext
  ): Promise<{ recovered: boolean; result?: RecoveryResult }> {
    const svgError = this.normalizeError(error, context);

    // Log error based on severity
    this.logError(svgError);

    // Add to history
    this.addToHistory(svgError);

    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(svgError, context);

    return recoveryResult;
  }

  /**
   * Register a custom error recovery strategy
   */
  public registerRecoveryStrategy(
    errorCode: string,
    strategy: ErrorRecoveryStrategy
  ): void {
    this.recoveryStrategies.set(errorCode, strategy);
    logger.debug(`Recovery strategy registered for error code: ${errorCode}`);
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byCode: Record<string, number>;
    recentErrors: SVGError[];
  } {
    const bySeverity: Record<string, number> = {};
    const byCode: Record<string, number> = {};

    this.errorHistory.forEach(error => {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      byCode[error.code] = (byCode[error.code] || 0) + 1;
    });

    return {
      total: this.errorHistory.length,
      bySeverity,
      byCode,
      recentErrors: this.errorHistory.slice(-10),
    };
  }

  /**
   * Clear error history
   */
  public clearHistory(): void {
    this.errorHistory = [];
    logger.debug('Error history cleared');
  }

  // Private methods

  private normalizeError(
    error: Error | SVGError,
    context?: ErrorContext
  ): SVGError {
    if (isSVGError(error)) {
      return error;
    }

    return {
      code: this.categorizeError(error),
      message: error.message,
      severity: this.determineSeverity(error),
      context: context || {},
      timestamp: Date.now(),
      stack: error.stack,
    };
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('file not found') || message.includes('enoent')) {
      return 'FILE_NOT_FOUND';
    }
    if (message.includes('permission') || message.includes('eacces')) {
      return 'PERMISSION_DENIED';
    }
    if (message.includes('parse') || message.includes('syntax')) {
      return 'PARSE_ERROR';
    }
    if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('svg') && message.includes('invalid')) {
      return 'INVALID_SVG';
    }

    return 'UNKNOWN_ERROR';
  }

  private determineSeverity(error: Error): SVGError['severity'] {
    const message = error.message.toLowerCase();

    if (message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }
    if (message.includes('file not found') || message.includes('permission')) {
      return 'high';
    }
    if (message.includes('parse') || message.includes('invalid')) {
      return 'medium';
    }

    return 'low';
  }

  private logError(error: SVGError): void {
    const logMessage = `[${error.code}] ${error.message}`;

    // Object lookup map for severity logging - O(1) performance
    const severityLoggers: Record<string, () => void> = {
      critical: () => logger.error('CRITICAL:', logMessage, error.context),
      high: () => logger.error('HIGH:', logMessage, error.context),
      medium: () => logger.warn('MEDIUM:', logMessage, error.context),
      low: () => logger.info('LOW:', logMessage, error.context),
    };

    const logFunction = severityLoggers[error.severity];
    if (logFunction) {
      logFunction();
    }
  }

  private addToHistory(error: SVGError): void {
    this.errorHistory.push(error);

    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private async attemptRecovery(
    error: SVGError,
    context?: unknown
  ): Promise<{ recovered: boolean; result?: RecoveryResult }> {
    const strategy = this.recoveryStrategies.get(error.code);

    if (!strategy) {
      logger.debug(`No recovery strategy found for error code: ${error.code}`);
      return { recovered: false };
    }

    try {
      if (!strategy.canRecover(error)) {
        logger.debug(
          `Recovery strategy declined to handle error: ${error.code}`
        );
        return { recovered: false };
      }

      logger.info(`Attempting recovery for error: ${error.code}`);
      const result = await strategy.recover(error, context);

      logger.success(`Successfully recovered from error: ${error.code}`);
      return { recovered: true, result };
    } catch (recoveryError) {
      logger.error(`Recovery failed for error ${error.code}:`, recoveryError);
      return { recovered: false };
    }
  }

  private setupDefaultStrategies(): void {
    // File not found recovery
    this.registerRecoveryStrategy('FILE_NOT_FOUND', {
      canRecover: error =>
        !!getContextString(error.context, 'filePath') &&
        getContextBoolean(error.context, 'canSkip') === true,
      recover: async (error, _context) => {
        const filePath = getContextString(error.context, 'filePath');
        logger.warn(`Skipping missing file: ${filePath}`);
        return { skipped: true, filePath };
      },
    });

    // Invalid SVG recovery
    this.registerRecoveryStrategy('INVALID_SVG', {
      canRecover: error => !!getContextString(error.context, 'svgContent'),
      recover: async (error, _context) => {
        logger.info('Attempting to clean invalid SVG content');

        // Basic SVG cleanup
        let cleaned = getContextString(error.context, 'svgContent') || '';

        // Remove potentially problematic content
        cleaned = cleaned
          .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
          .replace(/<style[\s\S]*?<\/style>/gi, '') // Remove styles
          .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
          .replace(/javascript:[^"']*/gi, ''); // Remove javascript: URLs

        return { cleanedContent: cleaned };
      },
    });

    // Permission denied recovery
    this.registerRecoveryStrategy('PERMISSION_DENIED', {
      canRecover: error => !!getContextString(error.context, 'alternative'),
      recover: async (error, _context) => {
        const alternativePath = getContextString(error.context, 'alternative');
        logger.warn(
          `Using alternative path due to permission issue: ${alternativePath}`
        );
        return { alternativePath };
      },
    });

    logger.debug('Default error recovery strategies loaded');
  }
}

// Export singleton instance and utilities
export const errorHandler = SVGErrorHandler.getInstance();

/**
 * Utility function to wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const result = await errorHandler.handleError(error as Error, context);

    if (result.recovered) {
      return result.result as T;
    }

    // Re-throw if not recovered and severity is high
    if (
      hasSeverity(error) &&
      (error.severity === 'high' || error.severity === 'critical')
    ) {
      throw error;
    }

    return null;
  }
}

/**
 * Decorator for automatic error handling
 */
export function handleErrors(context?: ErrorContext) {
  return function (
    _target: unknown,
    propertyName: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const method = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      return withErrorHandling(() => method.apply(this, args), {
        method: propertyName,
        ...context,
      });
    };

    return descriptor;
  };
}
