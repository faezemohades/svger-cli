import path from 'path';
import {
  toPascalCase,
  toKebabCase,
  toCamelCase,
  FileSystem,
} from '../utils/native.js';
import {
  ComponentGenerationOptions,
  SVGProcessorResult,
  ProcessingJob,
  NamingConvention,
} from '../types/index.js';
import { logger } from '../core/logger.js';
import { performanceEngine } from '../core/performance-engine.js';
import { frameworkTemplateEngine } from '../core/framework-templates.js';
import { OptimizerPipeline } from '../optimizers/optimizer-pipeline.js';
import { OptLevel, getDefaultOptConfig } from '../optimizers/types.js';
import { basicCleaningStage } from '../optimizers/basic-cleaner.js';
import { treeOptimizationStage } from '../optimizers/tree-stages.js';
import {
  numericStage,
  styleStage,
  transformStage,
  pathOptimizationStage,
  pathSimplificationStage,
  advancedOptimizationStage,
} from '../optimizers/advanced-stages.js';
import { pathDeduplicationStage } from '../optimizers/path-deduplicator.js';
import { shapeConversionStage } from '../optimizers/shape-conversion.js';

/**
 * SVG content processor and component generator
 */
export class SVGProcessor {
  private static instance: SVGProcessor;
  private processingQueue: Map<string, ProcessingJob> = new Map();
  private jobCounter = 0;
  private optimizer: OptimizerPipeline | null = null;

  private constructor() {
    // Initialize optimizer pipeline with basic cleaning stage
    this.optimizer = new OptimizerPipeline({ level: OptLevel.BASIC });
    this.optimizer.registerStage('basic-cleaning', basicCleaningStage);
  }

  public static getInstance(): SVGProcessor {
    if (!SVGProcessor.instance) {
      SVGProcessor.instance = new SVGProcessor();
    }
    return SVGProcessor.instance;
  }

  /**
   * Set optimization level for SVG processing
   */
  public setOptimizationLevel(level: OptLevel): void {
    if (!this.optimizer) {
      this.optimizer = new OptimizerPipeline({ level });
      this.registerOptimizationStages(level);
    } else {
      this.optimizer.clearStages();
      // Update config with all properties for the level
      this.optimizer.updateConfig(getDefaultOptConfig(level));
      this.registerOptimizationStages(level);
    }
  }

  /**
   * Register optimization stages based on level
   */
  private registerOptimizationStages(level: OptLevel): void {
    if (!this.optimizer) return;

    // Always register basic cleaning
    this.optimizer.registerStage('basic-cleaning', basicCleaningStage);

    // BALANCED: Numeric + Style + Tree optimization (safe and fast)
    if (level === OptLevel.BALANCED) {
      this.optimizer.registerStage('numeric', numericStage);
      this.optimizer.registerStage('style', styleStage);
      this.optimizer.registerStage('tree-optimization', treeOptimizationStage);
    }

    // AGGRESSIVE: + Simple Transform + Medium precision + Path optimization
    if (level === OptLevel.AGGRESSIVE) {
      // CRITICAL: shape-conversion MUST run before numeric optimization
      // Otherwise coordinates get rounded before conversion (e.g., x="10" → x="1")
      this.optimizer.registerStage('shape-conversion', shapeConversionStage);
      this.optimizer.registerStage('numeric', numericStage);
      this.optimizer.registerStage('style', styleStage);
      this.optimizer.registerStage('transform', transformStage);
      this.optimizer.registerStage('path-optimization', pathOptimizationStage);
      // DISABLED: tree-optimization causes malformed XML at this level
      // this.optimizer.registerStage('tree-optimization', treeOptimizationStage);
    }

    // MAXIMUM: Everything enabled + Lower precision + Aggressive transformations
    if (level === OptLevel.MAXIMUM) {
      // Use combined advanced stage for maximum efficiency
      this.optimizer.registerStage(
        'advanced-optimization',
        advancedOptimizationStage
      );
      // Add shape conversion before path optimization
      this.optimizer.registerStage('shape-conversion', shapeConversionStage);
      // Add path simplification after other optimizations
      this.optimizer.registerStage(
        'path-simplification',
        pathSimplificationStage
      );
      // Add path deduplication for icon sets
      this.optimizer.registerStage(
        'path-deduplication',
        pathDeduplicationStage
      );
      this.optimizer.registerStage('tree-optimization', treeOptimizationStage);
    }
  }

  /**
   * Clean and optimize SVG content using the optimizer pipeline
   */
  public async cleanSVGContent(svgContent: string): Promise<string> {
    logger.debug('Cleaning SVG content');

    try {
      if (this.optimizer) {
        const result = await this.optimizer.optimize(svgContent);
        logger.debug(
          `Optimized SVG: ${result.reductionPercent.toFixed(2)}% size reduction`
        );
        return result.optimizedSvg;
      }

      // Fallback to legacy cleaning if optimizer is not initialized
      return this.legacyCleanSVGContent(svgContent);
    } catch (error) {
      logger.warn('Optimizer failed, falling back to legacy cleaning:', error);
      return this.legacyCleanSVGContent(svgContent);
    }
  }

  /**
   * Legacy cleaning method (for backward compatibility)
   * @deprecated Use cleanSVGContent with optimizer pipeline instead
   */
  private legacyCleanSVGContent(svgContent: string): string {
    // First, convert inline styles to React style objects for React-based frameworks
    const cleaned = this.convertInlineStylesToReact(svgContent);

    return (
      cleaned
        // Remove XML declaration
        .replace(/<\?xml.*?\?>/g, '')
        // Remove DOCTYPE declaration
        .replace(/<!DOCTYPE.*?>/g, '')
        // Remove comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Normalize whitespace
        .replace(/\r?\n|\r/g, '')
        .replace(/\s{2,}/g, ' ')
        // Remove xmlns attributes (React will handle these)
        .replace(/\s+xmlns(:xlink)?="[^"]*"/g, '')
        // Convert attributes to camelCase for React
        .replace(/fill-rule/g, 'fillRule')
        .replace(/clip-rule/g, 'clipRule')
        .replace(/stroke-width/g, 'strokeWidth')
        .replace(/stroke-linecap/g, 'strokeLinecap')
        .replace(/stroke-linejoin/g, 'strokeLinejoin')
        .replace(/stroke-miterlimit/g, 'strokeMiterlimit')
        .replace(/stroke-dasharray/g, 'strokeDasharray')
        .replace(/stroke-dashoffset/g, 'strokeDashoffset')
        .replace(/font-family/g, 'fontFamily')
        .replace(/font-size/g, 'fontSize')
        .replace(/font-weight/g, 'fontWeight')
        .replace(/text-anchor/g, 'textAnchor')
        // Remove width/height with px units (React doesn't accept these in numeric attributes)
        .replace(/\s(width|height)=["'](\d+)px["']/g, ' $1={$2}')
        // Remove outer SVG tag and keep inner content
        .trim()
        .replace(/^<svg[^>]*>([\s\S]*)<\/svg>$/i, '$1')
        .trim()
    );
  }

  /**
   * Convert inline CSS style attributes to React style objects
   * Converts style="fill: #000; stroke-width: 2px;" to style={{fill: '#000', strokeWidth: '2px'}}
   */
  private convertInlineStylesToReact(svgContent: string): string {
    return svgContent.replace(/style="([^"]*)"/g, (_match, styleString) => {
      // Parse CSS string into object
      const styles: Record<string, string> = {};
      const declarations = styleString
        .split(';')
        .filter((s: string) => s.trim());

      declarations.forEach((declaration: string) => {
        const [property, value] = declaration
          .split(':')
          .map((s: string) => s.trim());
        if (property && value) {
          // Convert CSS property to camelCase (e.g., stroke-width -> strokeWidth)
          const camelProperty = property.replace(/-([a-z])/g, (g: string) =>
            g[1].toUpperCase()
          );
          styles[camelProperty] = value;
        }
      });

      // If empty styles, return empty string to remove attribute
      if (Object.keys(styles).length === 0) {
        return '';
      }

      // Convert to React inline style object syntax
      const styleEntries = Object.entries(styles)
        .map(([key, value]) => `${key}: '${value}'`)
        .join(', ');

      return `style={{${styleEntries}}}`;
    });
  }

  /**
   * Extract viewBox from SVG content
   */
  public extractViewBox(svgContent: string): string | null {
    const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/i);
    return viewBoxMatch ? viewBoxMatch[1] : null;
  }

  /**
   * Generate component name from filename
   */
  public generateComponentName(
    fileName: string,
    namingConvention?: 'kebab' | 'pascal' | 'camel'
  ): string {
    const baseName = path.basename(fileName, '.svg');

    // Object lookup map for naming conventions - O(1) performance
    const namingHandlers = {
      kebab: () => toPascalCase(baseName),
      camel: () => {
        const pascalName = toPascalCase(baseName);
        return pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
      },
      pascal: () => {
        const componentName = toPascalCase(baseName);
        // Ensure component name starts with uppercase letter
        if (!/^[A-Z]/.test(componentName)) {
          return `Svg${componentName}`;
        }
        return componentName;
      },
    };

    const handler = namingHandlers[namingConvention || 'pascal'];
    return handler ? handler() : namingHandlers.pascal();
  }

  /**
   * Generate React component from SVG content
   */
  public async generateComponent(
    componentName: string,
    svgContent: string,
    options: Partial<ComponentGenerationOptions> = {}
  ): Promise<string> {
    try {
      // Clean and optimize SVG content (now async)
      const cleanedContent = await this.cleanSVGContent(svgContent);

      // Apply plugins (no plugin configs for now, just process directly)
      const processedContent = cleanedContent;

      // Create full options object with required fields
      const fullOptions: ComponentGenerationOptions = {
        componentName,
        svgContent: processedContent,
        framework: options.framework || 'react',
        typescript:
          options.typescript !== undefined ? options.typescript : true,
        ...options,
      };

      // Use framework template engine directly
      const component = frameworkTemplateEngine.generateComponent(fullOptions);

      logger.debug(`Generated component: ${componentName}`);
      return component;
    } catch (error) {
      logger.error(`Failed to generate component ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Generate framework-agnostic component from SVG content
   */
  public async generateFrameworkComponent(
    componentName: string,
    svgContent: string,
    options: ComponentGenerationOptions
  ): Promise<string> {
    try {
      // Optimize SVG content based on framework requirements
      const optimizationLevel =
        options.framework === 'vanilla' ? 'maximum' : 'balanced';
      const optimizedContent = performanceEngine.optimizeSVGContent(
        svgContent,
        optimizationLevel
      );

      // Generate framework-specific component
      const component = frameworkTemplateEngine.generateComponent({
        ...options,
        componentName,
        svgContent: optimizedContent,
      });

      logger.debug(
        `Generated ${options.framework} component: ${componentName}`
      );
      return component;
    } catch (error) {
      logger.error(
        `Failed to generate ${options.framework} component ${componentName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Process multiple SVG files in batch with performance optimization
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
    logger.info(`Starting batch processing of ${files.length} files`);

    try {
      const results = await performanceEngine.processBatch(files, config);

      // Log performance metrics
      const metrics = performanceEngine.getPerformanceMetrics();
      if (metrics.memoryUsage.recommendations.length > 0) {
        logger.warn(
          'Performance recommendations:',
          metrics.memoryUsage.recommendations
        );
      }

      return results;
    } catch (error) {
      logger.error('Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Generate filename from component name using naming convention
   */
  public generateFileName(
    componentName: string,
    extension: string,
    namingConvention?: NamingConvention
  ): string {
    // Object lookup map for file naming - O(1) performance
    const namingConverters: Record<string, (name: string) => string> = {
      kebab: toKebabCase,
      camel: toCamelCase,
      pascal: (name: string) => name,
    };

    const converter = namingConverters[namingConvention || 'pascal'];
    const fileName = converter ? converter(componentName) : componentName;

    return `${fileName}.${extension}`;
  }

  /**
   * Process a single SVG file
   */
  public async processSVGFile(
    svgFilePath: string,
    outputDir: string,
    options: Partial<
      ComponentGenerationOptions & { namingConvention?: NamingConvention }
    > = {}
  ): Promise<SVGProcessorResult> {
    const jobId = `job-${++this.jobCounter}`;
    const job: ProcessingJob = {
      id: jobId,
      filePath: svgFilePath,
      status: 'processing',
      startTime: Date.now(),
    };

    this.processingQueue.set(jobId, job);
    logger.debug(`Processing SVG file: ${svgFilePath}`);

    try {
      // Read SVG content
      const svgContent = await FileSystem.readFile(svgFilePath, 'utf-8');

      // Generate component name using the specified naming convention
      const namingConvention = options.namingConvention || 'pascal';
      const componentName = this.generateComponentName(
        path.basename(svgFilePath),
        namingConvention
      );

      // Generate component code
      const componentCode = await this.generateComponent(
        componentName,
        svgContent,
        options
      );

      // Ensure output directory exists
      await FileSystem.ensureDir(outputDir);

      // Get correct file extension based on framework
      const framework = options.framework || 'react';
      const typescript =
        options.typescript !== undefined ? options.typescript : true;
      const fileExtension = frameworkTemplateEngine.getFileExtension(
        framework,
        typescript
      );

      // Generate filename using naming convention from options
      const fileName = this.generateFileName(
        componentName,
        fileExtension,
        namingConvention
      );

      // Write component file
      const outputFilePath = path.join(outputDir, fileName);
      await FileSystem.writeFile(outputFilePath, componentCode, 'utf-8');

      // Update job status
      job.status = 'completed';
      job.endTime = Date.now();

      const result: SVGProcessorResult = {
        success: true,
        componentName,
        filePath: outputFilePath,
      };

      logger.success(`Generated component: ${fileName}`);
      return result;
    } catch (error) {
      job.status = 'failed';
      job.endTime = Date.now();
      job.error = error as Error;

      const result: SVGProcessorResult = {
        success: false,
        componentName: '',
        filePath: svgFilePath,
        error: error as Error,
      };

      logger.error(`Failed to process ${svgFilePath}:`, error);
      return result;
    } finally {
      // Clean up completed jobs after some time
      setTimeout(() => {
        this.processingQueue.delete(jobId);
      }, 30000); // 30 seconds
    }
  }

  /**
   * Get processing statistics
   */
  public getProcessingStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const jobs = Array.from(this.processingQueue.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
  }

  /**
   * Clear processing queue
   */
  public clearQueue(): void {
    this.processingQueue.clear();
  }
}

// Export singleton instance
export const svgProcessor = SVGProcessor.getInstance();
