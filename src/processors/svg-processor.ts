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
import { logger as defaultLogger } from '../core/logger.js';
import { performanceEngine as defaultPerformanceEngine } from '../core/performance-engine.js';
import { frameworkTemplateEngine as defaultFrameworkTemplateEngine } from '../core/framework-templates.js';
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
import { getPluginManager } from '../core/enhanced-plugin-manager.js';
import type { Logger } from '../types/index.js';
import type { PerformanceEngine } from '../core/performance-engine.js';
import type { FrameworkTemplateEngine } from '../core/framework-templates.js';
import type { EnhancedPluginManager } from '../core/enhanced-plugin-manager.js';
import type { FrameworkType } from '../types/index.js';
import {
  applySVGInputSafety,
  resolveOutputArtifactPath,
  type SVGInputSafetyOptions,
} from '../security/input-safety.js';

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('SVG processing was cancelled.');
  Object.assign(error, { code: 'ABORT_ERR', cause: signal.reason });
  throw error;
}

/**
 * SVG content processor and component generator
 */
export class SVGProcessor {
  private static instance: SVGProcessor;
  private processingQueue: Map<string, ProcessingJob> = new Map();
  private jobCounter = 0;
  private optimizer: OptimizerPipeline | null = null;
  private currentOptimizationLevel: OptLevel = OptLevel.BASIC;

  private readonly logger: Logger;
  private readonly performanceEngine: PerformanceEngine;
  private readonly frameworkTemplateEngine: FrameworkTemplateEngine;
  private readonly pluginManager: EnhancedPluginManager;

  public constructor(
    dependencies: {
      logger?: Logger;
      performanceEngine?: PerformanceEngine;
      frameworkTemplateEngine?: FrameworkTemplateEngine;
      pluginManager?: EnhancedPluginManager;
    } = {}
  ) {
    this.logger = dependencies.logger ?? defaultLogger;
    this.performanceEngine =
      dependencies.performanceEngine ?? defaultPerformanceEngine;
    this.frameworkTemplateEngine =
      dependencies.frameworkTemplateEngine ?? defaultFrameworkTemplateEngine;
    this.pluginManager = dependencies.pluginManager ?? getPluginManager();
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
    this.currentOptimizationLevel = level;
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
  public async cleanSVGContent(
    svgContent: string,
    safetyOptions: SVGInputSafetyOptions = {}
  ): Promise<string> {
    this.logger.debug('Cleaning SVG content');

    try {
      const safeContent = applySVGInputSafety(svgContent, {
        ...safetyOptions,
        warn: message => this.logger.warn(message),
      });

      if (this.optimizer) {
        const result = await this.optimizer.optimize(safeContent);
        this.logger.debug(
          `Optimized SVG: ${result.reductionPercent.toFixed(2)}% size reduction`
        );
        return result.optimizedSvg;
      }

      // Fallback to legacy cleaning if optimizer is not initialized
      return this.legacyCleanSVGContent(safeContent);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code.startsWith('E_')
      ) {
        throw error;
      }
      this.logger.warn(
        'Optimizer failed, falling back to legacy cleaning:',
        error
      );
      const safeContent = applySVGInputSafety(svgContent, safetyOptions);
      return this.legacyCleanSVGContent(safeContent);
    }
  }

  /**
   * Legacy cleaning method (for backward compatibility)
   * @deprecated Use cleanSVGContent with optimizer pipeline instead
   */
  private legacyCleanSVGContent(svgContent: string): string {
    return (
      svgContent
        // Remove XML declaration
        .replace(/<\?xml.*?\?>/g, '')
        // Remove DOCTYPE declaration
        .replace(/<!DOCTYPE.*?>/g, '')
        // Remove comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Normalize whitespace
        .replace(/\r?\n|\r/g, '')
        .replace(/\s{2,}/g, ' ')
        // Keep SVG content valid for downstream optimization and non-JSX frameworks
        .replace(/\s(width|height)=["'](\d+)px["']/g, ' $1="$2"')
        .trim()
    );
  }

  private static readonly JSX_FRAMEWORKS = new Set<FrameworkType>([
    'react',
    'react-native',
    'preact',
    'solid',
  ]);

  private convertAttributesToJSX(svgContent: string): string {
    const attributeMap: Record<string, string> = {
      'fill-rule': 'fillRule',
      'clip-rule': 'clipRule',
      'stroke-width': 'strokeWidth',
      'stroke-linecap': 'strokeLinecap',
      'stroke-linejoin': 'strokeLinejoin',
      'stroke-miterlimit': 'strokeMiterlimit',
      'stroke-dasharray': 'strokeDasharray',
      'stroke-dashoffset': 'strokeDashoffset',
      'font-family': 'fontFamily',
      'font-size': 'fontSize',
      'font-weight': 'fontWeight',
      'text-anchor': 'textAnchor',
      'stop-color': 'stopColor',
      'stop-opacity': 'stopOpacity',
      'fill-opacity': 'fillOpacity',
      'stroke-opacity': 'strokeOpacity',
      'clip-path': 'clipPath',
      'xlink:href': 'xlinkHref',
    };

    const regex = new RegExp(Object.keys(attributeMap).join('|'), 'g');
    return svgContent.replace(regex, match => attributeMap[match]);
  }

  private prepareSVGForFramework(
    svgContent: string,
    framework: FrameworkType
  ): string {
    if (!SVGProcessor.JSX_FRAMEWORKS.has(framework)) {
      return svgContent;
    }

    return this.convertAttributesToJSX(
      this.convertInlineStylesToReact(svgContent)
    );
  }

  private async applyActivePlugins(svgContent: string): Promise<string> {
    const pluginManager = this.pluginManager;
    if (pluginManager.activePluginCount === 0) {
      return svgContent;
    }

    const context = await pluginManager.executeHook('after-parse', {
      content: svgContent,
      config: getDefaultOptConfig(this.currentOptimizationLevel),
      originalContent: svgContent,
      metadata: new Map<string, unknown>(),
    });

    return context.content;
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

  private static readonly NAMING_HANDLERS: Record<
    string,
    (baseName: string) => string
  > = {
    kebab: baseName => toKebabCase(baseName),
    camel: baseName => {
      const pascalName = toPascalCase(baseName);
      return pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
    },
    pascal: baseName => {
      const componentName = toPascalCase(baseName);
      // Ensure component name starts with uppercase letter
      if (!/^[A-Z]/.test(componentName)) {
        return `Svg${componentName}`;
      }
      return componentName;
    },
  };

  /**
   * Generate component name from filename
   */
  public generateComponentName(
    fileName: string,
    namingConvention?: 'kebab' | 'pascal' | 'camel'
  ): string {
    const extension = path.extname(fileName);
    const baseName = path.basename(
      fileName,
      extension.toLowerCase() === '.svg' ? extension : '.svg'
    );
    const convention = namingConvention || 'pascal';
    return SVGProcessor.NAMING_HANDLERS[convention](baseName);
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
      throwIfAborted(options.signal);
      // Clean and optimize SVG content (now async)
      const cleanedContent = await this.cleanSVGContent(svgContent, {
        maxInputSizeBytes: options.maxInputSizeBytes,
        source: componentName,
        unsafeInputPolicy: options.unsafeInputPolicy,
      });
      const pluginProcessedContent =
        await this.applyActivePlugins(cleanedContent);
      throwIfAborted(options.signal);

      // Create full options object with required fields
      const fullOptions: ComponentGenerationOptions = {
        componentName,
        svgContent: this.prepareSVGForFramework(
          pluginProcessedContent,
          options.framework || 'react'
        ),
        framework: options.framework || 'react',
        typescript:
          options.typescript !== undefined ? options.typescript : true,
        ...options,
      };

      // Use framework template engine directly
      const component =
        this.frameworkTemplateEngine.generateComponent(fullOptions);

      this.logger.debug(`Generated component: ${componentName}`);
      return component;
    } catch (error) {
      this.logger.error(
        `Failed to generate component ${componentName}:`,
        error
      );
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
      throwIfAborted(options.signal);
      // Optimize SVG content based on framework requirements
      const optimizationLevel =
        options.framework === 'vanilla' ? 'maximum' : 'balanced';
      const safeContent = applySVGInputSafety(svgContent, {
        maxInputSizeBytes: options.maxInputSizeBytes,
        source: componentName,
        unsafeInputPolicy: options.unsafeInputPolicy,
        warn: message => this.logger.warn(message),
      });
      const optimizedContent = this.performanceEngine.optimizeSVGContent(
        safeContent,
        optimizationLevel
      );
      throwIfAborted(options.signal);

      // Generate framework-specific component
      const component = this.frameworkTemplateEngine.generateComponent({
        ...options,
        componentName,
        svgContent: optimizedContent,
      });

      this.logger.debug(
        `Generated ${options.framework} component: ${componentName}`
      );
      return component;
    } catch (error) {
      this.logger.error(
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
      signal?: AbortSignal;
    } = {}
  ): Promise<
    Array<{
      success: boolean;
      filePath: string;
      error?: Error;
      duration: number;
    }>
  > {
    this.logger.info(`Starting batch processing of ${files.length} files`);

    try {
      throwIfAborted(config.signal);
      const results = await this.performanceEngine.processBatch(files, config);
      throwIfAborted(config.signal);

      // Log performance metrics
      const metrics = this.performanceEngine.getPerformanceMetrics();
      if (metrics.memoryUsage.recommendations.length > 0) {
        this.logger.warn(
          'Performance recommendations:',
          metrics.memoryUsage.recommendations
        );
      }

      return results;
    } catch (error) {
      this.logger.error('Batch processing failed:', error);
      throw error;
    }
  }

  private static readonly NAMING_CONVERTERS: Record<
    string,
    (name: string) => string
  > = {
    kebab: toKebabCase,
    camel: toCamelCase,
    pascal: (name: string) => name,
  };

  /**
   * Generate filename from component name using naming convention
   */
  public generateFileName(
    componentName: string,
    extension: string,
    namingConvention?: NamingConvention
  ): string {
    const convention = namingConvention || 'pascal';
    const converter = SVGProcessor.NAMING_CONVERTERS[convention];
    const fileName = converter ? converter(componentName) : componentName;

    return `${fileName}.${extension}`;
  }

  public getFileExtension(
    framework: FrameworkType,
    typescript: boolean
  ): string {
    return this.frameworkTemplateEngine.getFileExtension(framework, typescript);
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
    this.logger.debug(`Processing SVG file: ${svgFilePath}`);

    try {
      throwIfAborted(options.signal);
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
      throwIfAborted(options.signal);

      // Ensure output directory exists
      await FileSystem.ensureDir(outputDir);

      // Get correct file extension based on framework
      const framework = options.framework || 'react';
      const typescript =
        options.typescript !== undefined ? options.typescript : true;
      const fileExtension = this.frameworkTemplateEngine.getFileExtension(
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
      const outputFilePath = resolveOutputArtifactPath(outputDir, fileName);
      throwIfAborted(options.signal);
      await FileSystem.writeFile(outputFilePath, componentCode, 'utf-8');

      // Update job status
      job.status = 'completed';
      job.endTime = Date.now();

      const result: SVGProcessorResult = {
        success: true,
        componentName,
        filePath: outputFilePath,
      };

      this.logger.success(`Generated component: ${fileName}`);
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

      this.logger.error(`Failed to process ${svgFilePath}:`, error);

      // Immediately remove failed jobs to prevent memory leaks
      this.processingQueue.delete(jobId);

      return result;
    } finally {
      // Clean up completed jobs after a short delay (allows stats queries)
      if (job.status === 'completed') {
        setTimeout(() => {
          this.processingQueue.delete(jobId);
        }, 30000); // 30 seconds
      }

      // Cap queue size as a safety net to prevent unbounded growth
      if (this.processingQueue.size > 10000) {
        const oldestEntries = Array.from(this.processingQueue.entries())
          .filter(([, j]) => j.status === 'completed' || j.status === 'failed')
          .slice(0, this.processingQueue.size - 5000);
        for (const [key] of oldestEntries) {
          this.processingQueue.delete(key);
        }
      }
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

    // Direct property increment via object key — O(1) per job, avoids switch branching
    const stats: Record<string, number> & {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    } = {
      total: jobs.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const job of jobs) {
      stats[job.status]++;
    }

    return stats;
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
