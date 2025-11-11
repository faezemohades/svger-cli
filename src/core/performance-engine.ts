import os from 'os';
import { logger } from '../core/logger.js';
import { SVGProcessor, svgProcessor } from '../processors/svg-processor.js';
import { ComponentGenerationOptions } from '../types/index.js';

/**
 * Performance optimization engine for batch processing and parallel execution
 */
export class PerformanceEngine {
  private static instance: PerformanceEngine;
  private processingCache: Map<string, { result: any; timestamp: number }> =
    new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): PerformanceEngine {
    if (!PerformanceEngine.instance) {
      PerformanceEngine.instance = new PerformanceEngine();
    }
    return PerformanceEngine.instance;
  }

  /**
   * Process multiple SVG files in parallel with optimized batching
   */
  public async processBatch(
    files: Array<{
      path: string;
      outputDir: string;
      options?: Partial<ComponentGenerationOptions>;
    }>,
    config: {
      batchSize?: number;
      parallel?: boolean;
      maxConcurrency?: number;
    } = {}
  ): Promise<
    Array<{
      success: boolean;
      filePath: string;
      error?: Error;
      duration: number;
    }>
  > {
    const {
      batchSize = 10,
      parallel = true,
      maxConcurrency = Math.min(4, os.cpus().length),
    } = config;

    logger.info(
      `Processing ${files.length} files with ${parallel ? 'parallel' : 'sequential'} execution`
    );

    const startTime = Date.now();
    const results: Array<{
      success: boolean;
      filePath: string;
      error?: Error;
      duration: number;
    }> = [];

    if (!parallel) {
      // Sequential processing for stability
      for (const file of files) {
        const result = await this.processSingleWithCaching(file);
        results.push(result);
      }
    } else {
      // Parallel processing with controlled concurrency
      const batches = this.createBatches(files, batchSize);

      for (const batch of batches) {
        const semaphore = new Semaphore(maxConcurrency);
        const batchPromises = batch.map(file =>
          this.withSemaphore(semaphore, () =>
            this.processSingleWithCaching(file)
          )
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
    }

    const totalDuration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;

    logger.info(
      `Batch processing complete: ${successful}/${files.length} successful in ${totalDuration}ms`
    );

    return results;
  }

  /**
   * Process single file with caching support
   */
  private async processSingleWithCaching(file: {
    path: string;
    outputDir: string;
    options?: Partial<ComponentGenerationOptions>;
  }): Promise<{
    success: boolean;
    filePath: string;
    error?: Error;
    duration: number;
  }> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(file.path, file.options || {});

    // Check cache first
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for ${file.path}`);
      return {
        success: true,
        filePath: file.path,
        duration: Date.now() - startTime,
      };
    }

    try {
      const result = await svgProcessor.processSVGFile(
        file.path,
        file.outputDir,
        file.options
      );

      // Cache successful results
      if (result.success) {
        this.setCachedResult(cacheKey, result);
      }

      return {
        success: result.success,
        filePath: file.path,
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        filePath: file.path,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Optimize SVG content with performance considerations
   */
  public optimizeSVGContent(
    content: string,
    level: 'fast' | 'balanced' | 'maximum' = 'balanced'
  ): string {
    const startTime = performance.now();
    let optimized = content;

    switch (level) {
      case 'fast':
        // Basic optimizations only
        optimized = this.applyFastOptimizations(content);
        break;

      case 'balanced':
        // Standard optimizations with good performance/quality balance
        optimized = this.applyBalancedOptimizations(content);
        break;

      case 'maximum':
        // Comprehensive optimizations
        optimized = this.applyMaximumOptimizations(content);
        break;
    }

    const duration = performance.now() - startTime;
    const compressionRatio = (1 - optimized.length / content.length) * 100;

    logger.debug(
      `SVG optimization (${level}): ${compressionRatio.toFixed(1)}% reduction in ${duration.toFixed(2)}ms`
    );

    return optimized;
  }

  /**
   * Memory usage monitoring and optimization
   */
  public monitorMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    cacheSize: number;
    recommendations: string[];
  } {
    const memUsage = process.memoryUsage();
    const cacheSize = this.processingCache.size;
    const recommendations: string[] = [];

    // Memory usage analysis
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;

    if (heapUsedMB > 500) {
      recommendations.push(
        'Consider reducing batch size or enabling sequential processing'
      );
    }

    if (cacheSize > 1000) {
      recommendations.push(
        'Cache size is large, consider clearing old entries'
      );
    }

    if (memUsage.external > 100 * 1024 * 1024) {
      recommendations.push('High external memory usage detected');
    }

    return {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      external: memUsage.external / 1024 / 1024,
      cacheSize,
      recommendations,
    };
  }

  /**
   * Clear processing cache
   */
  public clearCache(): void {
    this.processingCache.clear();
    logger.debug('Processing cache cleared');
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): {
    cacheHitRate: number;
    averageProcessingTime: number;
    memoryUsage: any;
  } {
    // This would be implemented with proper metrics collection
    return {
      cacheHitRate: 0, // Placeholder
      averageProcessingTime: 0, // Placeholder
      memoryUsage: this.monitorMemoryUsage(),
    };
  }

  // Private helper methods

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async withSemaphore<T>(
    semaphore: Semaphore,
    task: () => Promise<T>
  ): Promise<T> {
    await semaphore.acquire();
    try {
      return await task();
    } finally {
      semaphore.release();
    }
  }

  private generateCacheKey(
    filePath: string,
    options: Partial<ComponentGenerationOptions>
  ): string {
    // Create a hash of file path and options for caching
    const key = JSON.stringify({ filePath, options });
    return Buffer.from(key).toString('base64');
  }

  private getCachedResult(key: string): any | null {
    const cached = this.processingCache.get(key);
    if (!cached) return null;

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.processingCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private setCachedResult(key: string, result: any): void {
    this.processingCache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  private applyFastOptimizations(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/>\s+</g, '><') // Remove spaces between tags
      .trim();
  }

  private applyBalancedOptimizations(content: string): string {
    let optimized = this.applyFastOptimizations(content);

    // Remove unnecessary attributes
    optimized = optimized
      .replace(/\s+id="[^"]*"/g, '') // Remove IDs (usually not needed in components)
      .replace(/\s+class="[^"]*"/g, '') // Remove classes
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+xmlns="[^"]*"/g, ''); // Remove xmlns (React adds it)

    return optimized;
  }

  private applyMaximumOptimizations(content: string): string {
    let optimized = this.applyBalancedOptimizations(content);

    // Advanced optimizations
    optimized = optimized
      .replace(/\s+style="[^"]*"/g, '') // Remove inline styles
      .replace(/\s+data-[^=]*="[^"]*"/g, '') // Remove data attributes
      .replace(/fill="none"/g, '') // Remove default fill
      .replace(/stroke="none"/g, '') // Remove default stroke
      .replace(/\s+version="[^"]*"/g, '') // Remove version
      .replace(/\s+baseProfile="[^"]*"/g, ''); // Remove baseProfile

    return optimized;
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      this.permits--;
      resolve();
    }
  }
}

// Export singleton instance
export const performanceEngine = PerformanceEngine.getInstance();
