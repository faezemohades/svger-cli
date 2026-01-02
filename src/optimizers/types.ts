/**
 * Type definitions for Advanced SVG Optimizer
 */

/**
 * Optimization level enum
 */
export enum OptLevel {
  NONE = 'none',
  BASIC = 'basic',
  BALANCED = 'balanced',
  AGGRESSIVE = 'aggressive',
  MAXIMUM = 'maximum',
}

/**
 * Optimization configuration interface
 */
export interface OptConfig {
  /**
   * Optimization level
   * @default 'balanced'
   */
  level: OptLevel;

  /**
   * Float precision for decimal numbers (1-4)
   * @default 3
   */
  floatPrecision: 1 | 2 | 3 | 4;

  /**
   * Path simplification tolerance (0-1)
   * Higher values = more aggressive simplification
   * @default 0.5
   */
  pathTolerance: number;

  /**
   * Remove viewBox attribute
   * @default false
   */
  removeViewBox: boolean;

  /**
   * Remove unnecessary XML declarations and metadata
   * @default true
   */
  removeMetadata: boolean;

  /**
   * Remove comments
   * @default true
   */
  removeComments: boolean;

  /**
   * Normalize whitespace
   * @default true
   */
  normalizeWhitespace: boolean;

  /**
   * Remove unnecessary attributes
   * @default true
   */
  removeUnnecessaryAttrs: boolean;

  /**
   * Convert colors to shortest form (#ffffff → #fff)
   * @default true
   */
  shortenColors: boolean;

  /**
   * Merge paths when possible
   * @default false (basic/balanced), true (aggressive/maximum)
   */
  mergePaths: boolean;

  /**
   * Remove hidden elements (opacity:0, display:none)
   * @default false (basic), true (balanced+)
   */
  removeHiddenElements: boolean;

  /**
   * Convert style attributes to presentation attributes
   * @default false
   */
  inlineStyles: boolean;

  /**
   * Remove empty containers (g, defs without children)
   * @default true
   */
  removeEmptyContainers: boolean;

  /**
   * Collapse useless groups
   * @default false (basic/balanced), true (aggressive/maximum)
   */
  collapseGroups: boolean;

  /**
   * Convert attributes to camelCase for React compatibility
   * @default true
   */
  reactCompatibility: boolean;

  /**
   * Sort attributes alphabetically
   * @default false
   */
  sortAttrs: boolean;

  /**
   * Remove DOCTYPE declarations
   * @default true
   */
  removeDoctype: boolean;

  /**
   * Remove XML processing instructions
   * @default true
   */
  removeXMLProcInst: boolean;

  /**
   * Enable numeric optimization (coordinate precision, etc.)
   * @default true
   */
  enableNumericOptimization: boolean;

  /**
   * Enable style optimization (color shortening, unit removal, etc.)
   * @default true
   */
  enableStyleOptimization: boolean;

  /**
   * Enable transform optimization (matrix simplification, etc.)
   * @default false (basic/balanced), true (aggressive/maximum)
   */
  enableTransformOptimization: boolean;

  /**
   * Enable transform collapsing (propagate, bake into coordinates, collapse groups)
   * @default false (basic/balanced), true (aggressive/maximum)
   */
  enableTransformCollapsing: boolean;

  /**
   * Enable path optimization (command merging, H/V conversion, etc.)
   * @default false (basic/balanced), true (aggressive/maximum)
   */
  enablePathOptimization: boolean;

  /**
   * Enable path simplification (Douglas-Peucker, Visvalingam-Whyatt)
   * @default false (basic/balanced/aggressive), true (maximum)
   */
  enablePathSimplification: boolean;

  /**
   * Enable shape conversion (rect/polygon/polyline → path)
   * @default false (basic/balanced), true (aggressive/maximum)
   */
  shapeConversion: boolean;

  /**
   * Minimum bytes to save for shape conversion
   * @default 5 (aggressive), 0 (maximum)
   */
  shapeConversionThreshold: number;

  /**
   * Optimization level for stage-based processing
   * @default 'BALANCED'
   */
  optimizationLevel: OptLevel;

  /**
   * Custom plugins (future extension point)
   */
  plugins?: OptimizationPlugin[];
}

/**
 * Optimization plugin interface (for future extensibility)
 */
export interface OptimizationPlugin {
  name: string;
  stage: 'pre-parse' | 'tree' | 'post-serialize';
  execute: (
    input: string | OptimizedTree,
    config: OptConfig
  ) => string | OptimizedTree | Promise<string | OptimizedTree>;
}

/**
 * Optimized tree node (lightweight virtual DOM)
 */
export interface OptimizedNode {
  type: 'element' | 'text' | 'comment';
  tagName?: string;
  attributes?: Record<string, string>;
  children?: OptimizedNode[];
  textContent?: string;
  commentText?: string;
}

/**
 * Optimized tree structure
 */
export interface OptimizedTree {
  root: OptimizedNode;
  metadata: {
    originalSize: number;
    optimizedSize: number;
    reductionPercent: number;
    stages: string[];
  };
}

/**
 * Optimization stage function type
 */
export type OptimizationStage = (
  svgString: string,
  config: OptConfig
) => Promise<string> | string;

/**
 * Optimization result
 */
export interface OptimizationResult {
  optimizedSvg: string;
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
  stagesApplied: string[];
}

/**
 * Get default optimization config based on level
 */
export function getDefaultOptConfig(level: OptLevel): OptConfig {
  const baseConfig: OptConfig = {
    level,
    floatPrecision: 3,
    pathTolerance: 0.5,
    removeViewBox: false,
    removeMetadata: true,
    removeComments: true,
    normalizeWhitespace: true,
    removeUnnecessaryAttrs: true,
    shortenColors: true,
    mergePaths: false,
    removeHiddenElements: false,
    inlineStyles: false,
    removeEmptyContainers: true,
    collapseGroups: false,
    reactCompatibility: true,
    sortAttrs: false,
    removeDoctype: true,
    removeXMLProcInst: true,
    enableNumericOptimization: true,
    enableStyleOptimization: true,
    enableTransformOptimization: false,
    enableTransformCollapsing: false,
    enablePathOptimization: false,
    enablePathSimplification: false,
    shapeConversion: false,
    shapeConversionThreshold: 5,
    optimizationLevel: level,
  };

  switch (level) {
    case OptLevel.NONE:
      return {
        ...baseConfig,
        removeMetadata: false,
        removeComments: false,
        normalizeWhitespace: false,
        removeUnnecessaryAttrs: false,
        shortenColors: false,
        removeEmptyContainers: false,
        removeDoctype: false,
        removeXMLProcInst: false,
        enableNumericOptimization: false,
        enableStyleOptimization: false,
        enableTransformOptimization: false,
        enableTransformCollapsing: false,
        enablePathOptimization: false,
        enablePathSimplification: false,
      };

    case OptLevel.BASIC:
      return baseConfig;

    case OptLevel.BALANCED:
      return {
        ...baseConfig,
        removeHiddenElements: true,
        floatPrecision: 3,
        enableNumericOptimization: true,
        enableStyleOptimization: true,
        enableTransformOptimization: false,
        enableTransformCollapsing: false,
        enablePathOptimization: false,
      };

    case OptLevel.AGGRESSIVE:
      return {
        ...baseConfig,
        removeHiddenElements: true,
        mergePaths: true,
        collapseGroups: true,
        floatPrecision: 2,
        pathTolerance: 0.7,
        sortAttrs: true,
        enableNumericOptimization: true,
        enableStyleOptimization: true,
        enableTransformOptimization: true,
        enableTransformCollapsing: true,
        enablePathOptimization: true,
        // DISABLED: Shape conversion conflicts with floatPrecision=2
        // Causes visual regressions (coordinates get rounded before conversion)
        shapeConversion: false,
        shapeConversionThreshold: 5,
      };

    case OptLevel.MAXIMUM:
      return {
        ...baseConfig,
        removeHiddenElements: true,
        mergePaths: true,
        collapseGroups: true,
        inlineStyles: true,
        floatPrecision: 1,
        pathTolerance: 0.9,
        sortAttrs: true,
        removeViewBox: false, // Keep viewBox even at maximum for compatibility
        enableNumericOptimization: true,
        enableStyleOptimization: true,
        enableTransformOptimization: true,
        enableTransformCollapsing: true,
        enablePathOptimization: true,
        enablePathSimplification: true,
        shapeConversion: true,
        shapeConversionThreshold: 0, // Convert even 1-byte savings
      };

    default:
      return baseConfig;
  }
}
