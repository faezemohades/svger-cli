import { logger } from '../core/logger.js';

/**
 * Enhanced error handling system with detailed error tracking and recovery
 */

export interface SVGError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  timestamp: number;
  stack?: string;
}

export interface ErrorRecoveryStrategy {
  canRecover(error: SVGError): boolean;
  recover(error: SVGError, context?: any): Promise<any>;
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
    context?: Record<string, any>
  ): Promise<{ recovered: boolean; result?: any }> {
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
  public registerRecoveryStrategy(errorCode: string, strategy: ErrorRecoveryStrategy): void {
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
      recentErrors: this.errorHistory.slice(-10)
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

  private normalizeError(error: Error | SVGError, context?: Record<string, any>): SVGError {
    if ('code' in error && 'severity' in error) {
      return error as SVGError;
    }

    // Convert regular Error to SVGError
    const regularError = error as Error;
    return {
      code: this.categorizeError(regularError),
      message: regularError.message,
      severity: this.determineSeverity(regularError),
      context: context || {},
      timestamp: Date.now(),
      stack: regularError.stack
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
    
    switch (error.severity) {
      case 'critical':
        logger.error('CRITICAL:', logMessage, error.context);
        break;
      case 'high':
        logger.error('HIGH:', logMessage, error.context);
        break;
      case 'medium':
        logger.warn('MEDIUM:', logMessage, error.context);
        break;
      case 'low':
        logger.info('LOW:', logMessage, error.context);
        break;
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
    context?: any
  ): Promise<{ recovered: boolean; result?: any }> {
    const strategy = this.recoveryStrategies.get(error.code);
    
    if (!strategy) {
      logger.debug(`No recovery strategy found for error code: ${error.code}`);
      return { recovered: false };
    }

    try {
      if (!strategy.canRecover(error)) {
        logger.debug(`Recovery strategy declined to handle error: ${error.code}`);
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
      canRecover: (error) => error.context?.filePath && error.context?.canSkip === true,
      recover: async (error, context) => {
        logger.warn(`Skipping missing file: ${error.context?.filePath}`);
        return { skipped: true, filePath: error.context?.filePath };
      }
    });

    // Invalid SVG recovery
    this.registerRecoveryStrategy('INVALID_SVG', {
      canRecover: (error) => error.context?.svgContent,
      recover: async (error, context) => {
        logger.info('Attempting to clean invalid SVG content');
        
        // Basic SVG cleanup
        let cleaned = error.context?.svgContent || '';
        
        // Remove potentially problematic content
        cleaned = cleaned
          .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
          .replace(/<style[\s\S]*?<\/style>/gi, '')   // Remove styles
          .replace(/on\w+="[^"]*"/gi, '')             // Remove event handlers
          .replace(/javascript:[^"']*/gi, '');        // Remove javascript: URLs
        
        return { cleanedContent: cleaned };
      }
    });

    // Permission denied recovery
    this.registerRecoveryStrategy('PERMISSION_DENIED', {
      canRecover: (error) => error.context?.alternative,
      recover: async (error, context) => {
        logger.warn(`Using alternative path due to permission issue: ${error.context?.alternative}`);
        return { alternativePath: error.context?.alternative };
      }
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
  context?: Record<string, any>
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const result = await errorHandler.handleError(error as Error, context);
    
    if (result.recovered) {
      return result.result as T;
    }
    
    // Re-throw if not recovered and severity is high
    const svgError = error as any;
    if (svgError.severity === 'high' || svgError.severity === 'critical') {
      throw error;
    }
    
    return null;
  }
}

/**
 * Decorator for automatic error handling
 */
export function handleErrors(context?: Record<string, any>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return withErrorHandling(
        () => method.apply(this, args),
        { method: propertyName, ...context }
      );
    };
  };
}