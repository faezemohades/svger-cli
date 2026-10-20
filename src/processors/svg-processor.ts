import path from 'path';
import { toPascalCase, toKebabCase, toCamelCase } from '../utils/native.js';
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
import { numericStage } from '../optimizers/advanced-stages.js';
import { transformSVGAttributeValues } from '../optimizers/xml-attribute-transform.js';
import { readSVGInputFile } from '../security/input-safety.js';
import { getPluginManager } from '../core/enhanced-plugin-manager.js';
import type { Logger } from '../types/index.js';
import type { PerformanceEngine } from '../core/performance-engine.js';
import type { FrameworkTemplateEngine } from '../core/framework-templates.js';
import type { EnhancedPluginManager } from '../core/enhanced-plugin-manager.js';
import type { FrameworkType } from '../types/index.js';
import {
  applySVGInputSafety,
  collectAdmittedSVGDocument,
  type SVGInputSafetyOptions,
} from '../security/input-safety.js';
import { lowerAdmittedSVGToIR } from '../compiler/lower-svg-document-to-ir.js';
import { emitSvelteIRComponent } from '../compiler/svelte-ir-emitter.js';
import { writeOutputFileAtomic } from '../io/atomic-write.js';
import {
  DiagnosticError,
  ExitCode,
  sanitizePublicError,
} from '../contracts/diagnostics.js';

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
  private static readonly COMPLETED_JOB_HISTORY_LIMIT = 500;
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
    this.optimizer = this.createOptimizer(OptLevel.BASIC);
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
    this.optimizer = this.createOptimizer(level);
  }

  private createOptimizer(level: OptLevel): OptimizerPipeline {
    const optimizer = new OptimizerPipeline(getDefaultOptConfig(level));
    if (level !== OptLevel.NONE) {
      optimizer.registerStage('basic-cleaning', basicCleaningStage);
    }
    if (
      level === OptLevel.BALANCED ||
      level === OptLevel.AGGRESSIVE ||
      level === OptLevel.MAXIMUM
    ) {
      optimizer.registerStage('numeric', numericStage);
    }
    return optimizer;
  }

  /**
   * Clean and optimize SVG content using the optimizer pipeline
   */
  public async cleanSVGContent(
    svgContent: string,
    safetyOptions: SVGInputSafetyOptions = {},
    optimizationLevel?: OptLevel
  ): Promise<string> {
    this.logger.debug('Cleaning SVG content');

    try {
      const safeContent = applySVGInputSafety(svgContent, {
        ...safetyOptions,
        warn: message => this.logger.warn(message),
      });

      if (this.optimizer) {
        const optimizer = optimizationLevel
          ? this.createOptimizer(optimizationLevel)
          : this.optimizer;
        const result = await optimizer.optimize(safeContent);
        const verifiedOutput = applySVGInputSafety(result.optimizedSvg, {
          ...safetyOptions,
          unsafeInputPolicy: 'reject',
          warn: () => undefined,
        });
        this.logger.debug(
          `Optimized SVG: ${result.reductionPercent.toFixed(2)}% size reduction`
        );
        return verifiedOutput;
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
      throw error;
    }
  }

  /**
   * Legacy cleaning method (for backward compatibility)
   * @deprecated Use cleanSVGContent with optimizer pipeline instead
   */
  private legacyCleanSVGContent(svgContent: string): string {
    // If no verified optimizer is available, preserve the authorized source.
    return svgContent;
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

    return transformSVGAttributeValues(svgContent, (_tag, name) => {
      const jsxName = attributeMap[name];
      return jsxName ? { name: jsxName } : undefined;
    });
  }

  private prepareSVGForFramework(
    svgContent: string,
    framework: FrameworkType
  ): string {
    if (!SVGProcessor.JSX_FRAMEWORKS.has(framework)) {
      return svgContent;
    }

    return this.convertInlineStylesToReact(
      this.convertAttributesToJSX(svgContent)
    );
  }

  private async applyActivePlugins(
    svgContent: string,
    optimizationLevel: OptLevel
  ): Promise<string> {
    const pluginManager = this.pluginManager;
    if (pluginManager.activePluginCount === 0) {
      return svgContent;
    }

    const context = await pluginManager.executeHook('after-parse', {
      content: svgContent,
      config: getDefaultOptConfig(optimizationLevel),
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
    return transformSVGAttributeValues(
      svgContent,
      (_tag, name, styleString) => {
        if (name !== 'style') return undefined;
        const declarations = styleString.split(';').filter(item => item.trim());
        if (declarations.length === 0) return undefined;
        const styles = new Map<string, string>();
        for (const declaration of declarations) {
          const separator = declaration.indexOf(':');
          if (separator < 1) return undefined;
          const property = declaration.slice(0, separator).trim();
          const value = declaration.slice(separator + 1).trim();
          if (
            !/^--[\w-]+$|^-?[a-z][a-z\d-]*$/i.test(property) ||
            !value ||
            /[;{}"'\\]/.test(value)
          ) {
            return undefined;
          }
          const jsxProperty = property.replace(
            /-([a-z])/g,
            (_match, char: string) => char.toUpperCase()
          );
          styles.set(jsxProperty, value);
        }
        const entries = Array.from(
          styles,
          ([property, value]) => `${property}: '${value}'`
        );
        return { raw: `style={{${entries.join(', ')}}}` };
      }
    );
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
      const optimizationLevel = options.optimizationLevel
        ? OptLevel[
            options.optimizationLevel.toUpperCase() as keyof typeof OptLevel
          ]
        : this.currentOptimizationLevel;
      if (!optimizationLevel) {
        throw new DiagnosticError(
          'E_INVALID_OPTIMIZATION_LEVEL',
          'Unsupported optimization level.',
          { exitCode: ExitCode.InvalidConfiguration }
        );
      }
      const cleanedContent = await this.cleanSVGContent(
        svgContent,
        {
          maxInputSizeBytes: options.maxInputSizeBytes,
          source: componentName,
          unsafeInputPolicy: options.unsafeInputPolicy,
        },
        optimizationLevel
      );
      const pluginProcessedContent = await this.applyActivePlugins(
        cleanedContent,
        optimizationLevel
      );
      throwIfAborted(options.signal);

      if (options.svelteCompiler === 'ir-v1') {
        if ((options.framework ?? 'react') !== 'svelte') {
          throw new DiagnosticError(
            'E_INVALID_CONFIGURATION',
            'The IR v1 compiler is available only for Svelte.',
            { exitCode: ExitCode.InvalidConfiguration }
          );
        }
        const collected = collectAdmittedSVGDocument(pluginProcessedContent, {
          maxInputSizeBytes: options.maxInputSizeBytes,
          source: componentName,
          unsafeInputPolicy: options.unsafeInputPolicy,
          warn: message => this.logger.warn(message),
        });
        const ir = lowerAdmittedSVGToIR(
          collected.source,
          collected.document,
          componentName
        );
        return emitSvelteIRComponent(
          ir,
          componentName,
          options.typescript ?? true
        );
      }

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
      this.logger.error(`Failed to generate component ${componentName}.`);
      throw sanitizePublicError(error);
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
      applySVGInputSafety(optimizedContent, {
        maxInputSizeBytes: options.maxInputSizeBytes,
        source: componentName,
        unsafeInputPolicy: 'reject',
        warn: () => undefined,
      });
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
        `Failed to generate ${options.framework} component ${componentName}.`
      );
      throw sanitizePublicError(error);
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
      this.logger.error('Batch processing failed.');
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
      const svgContent = await readSVGInputFile(
        svgFilePath,
        options.maxInputSizeBytes,
        svgFilePath
      );

      // Generate component name using the specified naming convention
      const namingConvention = options.namingConvention || 'pascal';
      const componentNamingConvention =
        namingConvention === 'kebab' ? 'pascal' : namingConvention;
      const componentName = this.generateComponentName(
        path.basename(svgFilePath),
        componentNamingConvention
      );

      // Generate component code
      const componentCode = await this.generateComponent(
        componentName,
        svgContent,
        options
      );
      throwIfAborted(options.signal);

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
      const outputFilePath = await writeOutputFileAtomic(
        outputDir,
        fileName,
        componentCode,
        options.signal
      );

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

      this.logger.error(`Failed to process ${path.basename(svgFilePath)}.`);

      // Immediately remove failed jobs to prevent memory leaks
      this.processingQueue.delete(jobId);

      return result;
    } finally {
      // Keep a bounded recent history for stats without retaining one timer per
      // completed job. Active jobs remain visible until they settle.
      if (job.status === 'completed') {
        let completedJobs = 0;
        for (const queuedJob of this.processingQueue.values()) {
          if (queuedJob.status === 'completed') completedJobs++;
        }
        while (completedJobs > SVGProcessor.COMPLETED_JOB_HISTORY_LIMIT) {
          const oldestCompleted = Array.from(this.processingQueue).find(
            ([, queuedJob]) => queuedJob.status === 'completed'
          );
          if (!oldestCompleted) break;
          this.processingQueue.delete(oldestCompleted[0]);
          completedJobs--;
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
