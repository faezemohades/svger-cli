/**
 * Advanced SVG Optimizer Pipeline
 * Pluggable stage-based optimization system
 */

import type {
  OptConfig,
  OptimizationStage,
  OptimizationResult,
} from './types.js';
import { OptLevel, getDefaultOptConfig } from './types.js';

/**
 * SVG Optimizer Pipeline
 * Orchestrates optimization stages in a composable manner
 */
export class OptimizerPipeline {
  private stages: Array<{ name: string; fn: OptimizationStage }> = [];
  private config: OptConfig;

  constructor(config?: Partial<OptConfig>) {
    const level = config?.level || OptLevel.BALANCED;
    this.config = {
      ...getDefaultOptConfig(level),
      ...config,
    };
  }

  /**
   * Register an optimization stage
   */
  registerStage(name: string, fn: OptimizationStage): this {
    this.stages.push({ name, fn });
    return this;
  }

  /**
   * Execute optimization pipeline
   */
  async optimize(svgString: string): Promise<OptimizationResult> {
    const originalSize = Buffer.byteLength(svgString, 'utf8');
    let optimizedSvg = svgString;
    const stagesApplied: string[] = [];

    // Execute each stage sequentially
    for (const stage of this.stages) {
      try {
        const result = await stage.fn(optimizedSvg, this.config);
        optimizedSvg = result;
        stagesApplied.push(stage.name);
      } catch (error) {
        console.warn(
          `⚠️  Stage "${stage.name}" failed, skipping:`,
          (error as Error).message
        );
        // Continue with other stages even if one fails
      }
    }

    const optimizedSize = Buffer.byteLength(optimizedSvg, 'utf8');
    const reductionPercent =
      ((originalSize - optimizedSize) / originalSize) * 100;

    return {
      optimizedSvg,
      originalSize,
      optimizedSize,
      reductionPercent,
      stagesApplied,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): OptConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OptConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all registered stages
   */
  clearStages(): void {
    this.stages = [];
  }
}

/**
 * Create a pre-configured optimizer pipeline based on optimization level
 */
export function createOptimizerPipeline(
  level: OptLevel = OptLevel.BALANCED
): OptimizerPipeline {
  const config = getDefaultOptConfig(level);
  return new OptimizerPipeline(config);
}
