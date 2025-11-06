import path from 'path';
import { toPascalCase, FileSystem } from '../utils/native.js';
import { ComponentGenerationOptions, SVGProcessorResult, ProcessingJob, ProcessingStatus } from '../types/index.js';
import { logger } from '../core/logger.js';
import { pluginManager } from '../core/plugin-manager.js';
import { templateManager } from '../core/template-manager.js';
import { performanceEngine } from '../core/performance-engine.js';
import { frameworkTemplateEngine, FrameworkTemplateOptions } from '../core/framework-templates.js';

/**
 * SVG content processor and component generator
 */
export class SVGProcessor {
  private static instance: SVGProcessor;
  private processingQueue: Map<string, ProcessingJob> = new Map();
  private jobCounter = 0;

  private constructor() {}

  public static getInstance(): SVGProcessor {
    if (!SVGProcessor.instance) {
      SVGProcessor.instance = new SVGProcessor();
    }
    return SVGProcessor.instance;
  }

  /**
   * Clean and optimize SVG content
   */
  public cleanSVGContent(svgContent: string): string {
    logger.debug('Cleaning SVG content');

    return svgContent
      // Remove XML declaration
      .replace(/<\?xml.*?\?>/g, '')
      // Remove DOCTYPE declaration
      .replace(/<!DOCTYPE.*?>/g, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Normalize whitespace
      .replace(/\r?\n|\r/g, '')
      .replace(/\s{2,}/g, ' ')
      // Remove inline styles (they interfere with React styling)
      .replace(/style="[^"]*"/g, '')
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
      // Remove outer SVG tag and keep inner content
      .trim()
      .replace(/^<svg[^>]*>([\s\S]*)<\/svg>$/i, '$1')
      .trim();
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
  public generateComponentName(fileName: string): string {
    const baseName = path.basename(fileName, '.svg');
    const componentName = toPascalCase(baseName);
    
    // Ensure component name starts with uppercase letter
    if (!/^[A-Z]/.test(componentName)) {
      return `Svg${componentName}`;
    }
    
    return componentName;
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
      // Apply plugins (no plugin configs for now, just process directly)
      const processedContent = svgContent;
      
      // Create full options object with required fields
      const fullOptions: ComponentGenerationOptions = {
        componentName,
        svgContent: processedContent,
        ...options
      };
      
      // Generate component using template manager
      const component = templateManager.generateComponent(
        'functional',
        fullOptions
      );

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
    options: FrameworkTemplateOptions
  ): Promise<string> {
    try {
      // Optimize SVG content based on framework requirements
      const optimizationLevel = options.framework === 'vanilla' ? 'maximum' : 'balanced';
      const optimizedContent = performanceEngine.optimizeSVGContent(svgContent, optimizationLevel);
      
      // Generate framework-specific component
      const component = frameworkTemplateEngine.generateComponent(
        componentName,
        optimizedContent,
        options
      );

      logger.debug(`Generated ${options.framework} component: ${componentName}`);
      return component;

    } catch (error) {
      logger.error(`Failed to generate ${options.framework} component ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Process multiple SVG files in batch with performance optimization
   */
  public async processBatch(
    files: Array<{ path: string; outputDir: string; options?: Partial<ComponentGenerationOptions> }>,
    config: { batchSize?: number; parallel?: boolean; maxConcurrency?: number } = {}
  ): Promise<Array<{ success: boolean; filePath: string; error?: Error; duration: number }>> {
    logger.info(`Starting batch processing of ${files.length} files`);
    
    try {
      const results = await performanceEngine.processBatch(files, config);
      
      // Log performance metrics
      const metrics = performanceEngine.getPerformanceMetrics();
      if (metrics.memoryUsage.recommendations.length > 0) {
        logger.warn('Performance recommendations:', metrics.memoryUsage.recommendations);
      }
      
      return results;
    } catch (error) {
      logger.error('Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Process a single SVG file
   */
  public async processSVGFile(
    svgFilePath: string,
    outputDir: string,
    options: Partial<ComponentGenerationOptions> = {}
  ): Promise<SVGProcessorResult> {
    const jobId = `job-${++this.jobCounter}`;
    const job: ProcessingJob = {
      id: jobId,
      filePath: svgFilePath,
      status: 'processing',
      startTime: Date.now()
    };

    this.processingQueue.set(jobId, job);
    logger.debug(`Processing SVG file: ${svgFilePath}`);

    try {
      // Read SVG content
      const svgContent = await FileSystem.readFile(svgFilePath, 'utf-8');
      
      // Generate component name
      const componentName = this.generateComponentName(path.basename(svgFilePath));
      
      // Generate component code
      const componentCode = await this.generateComponent(
        componentName,
        svgContent,
        options
      );

      // Ensure output directory exists
      await FileSystem.ensureDir(outputDir);

      // Write component file
      const outputFilePath = path.join(outputDir, `${componentName}.tsx`);
      await FileSystem.writeFile(outputFilePath, componentCode, 'utf-8');

      // Update job status
      job.status = 'completed';
      job.endTime = Date.now();

      const result: SVGProcessorResult = {
        success: true,
        componentName,
        filePath: outputFilePath
      };

      logger.success(`Generated component: ${componentName}.tsx`);
      return result;

    } catch (error) {
      job.status = 'failed';
      job.endTime = Date.now();
      job.error = error as Error;

      const result: SVGProcessorResult = {
        success: false,
        componentName: '',
        filePath: svgFilePath,
        error: error as Error
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