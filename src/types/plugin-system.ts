/**
 * Enhanced Plugin System Types (Phase 6.2)
 * Pipeline hooks with visual diff validation
 */

import type { OptConfig } from '../optimizers/types.js';
import type { CompareOptions, VisualDiffResult } from '../utils/visual-diff.js';

/**
 * Plugin hook types for pipeline integration
 */
export type PluginHookType =
  | 'before-parse' // Before SVG parsing
  | 'after-parse' // After SVG parsing, before optimization
  | 'before-stage' // Before each optimization stage
  | 'after-stage' // After each optimization stage
  | 'before-serialize' // Before final serialization
  | 'after-serialize'; // After final serialization

/**
 * Plugin hook context - contains information about current processing state
 */
export interface PluginHookContext {
  /** Current SVG content */
  content: string;

  /** Optimization configuration */
  config: OptConfig;

  /** Current stage name (if applicable) */
  stageName?: string;

  /** Original SVG content (for comparison) */
  originalContent?: string;

  /** Metadata passed between hooks */
  metadata: Map<string, any>;

  /** Skip subsequent hooks for this stage */
  skipRemaining?: boolean;
}

/**
 * Plugin hook function signature
 */
export type PluginHookFunction = (
  context: PluginHookContext
) => Promise<PluginHookResult>;

/**
 * Result from plugin hook execution
 */
export interface PluginHookResult {
  /** Modified content (if changed) */
  content?: string;

  /** Whether to skip remaining hooks */
  skipRemaining?: boolean;

  /** Additional metadata */
  metadata?: Record<string, any>;

  /** Validation result (if validation was performed) */
  validation?: VisualDiffResult;
}

/**
 * Enhanced plugin interface with hooks
 */
export interface EnhancedPlugin {
  /** Plugin name (unique identifier) */
  name: string;

  /** Plugin version */
  version: string;

  /** Plugin description */
  description?: string;

  /** Plugin author */
  author?: string;

  /** Hook registrations */
  hooks: {
    [K in PluginHookType]?: PluginHookFunction;
  };

  /** Visual diff validation options */
  validation?: {
    /** Enable visual validation for this plugin */
    enabled: boolean;

    /** Maximum allowed visual difference (percentage) */
    maxDiffPercent?: number;

    /** Custom validation options */
    options?: Partial<CompareOptions>;
  };

  /** Plugin configuration schema */
  configSchema?: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      required?: boolean;
      default?: any;
      description?: string;
    };
  };

  /** Validate plugin options */
  validate?(options?: any): boolean | { valid: boolean; errors: string[] };

  /** Initialize plugin (called once on registration) */
  init?(): Promise<void>;

  /** Cleanup plugin resources */
  cleanup?(): Promise<void>;
}

/**
 * Plugin execution result with metrics
 */
export interface PluginExecutionResult {
  /** Plugin name */
  pluginName: string;

  /** Hook type that was executed */
  hookType: PluginHookType;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Whether content was modified */
  contentModified: boolean;

  /** Visual diff result (if validation was performed) */
  visualDiff?: VisualDiffResult;

  /** Validation passed */
  validationPassed?: boolean;

  /** Error (if execution failed) */
  error?: Error;
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
  /** Plugin instance */
  plugin: EnhancedPlugin;

  /** Enabled state */
  enabled: boolean;

  /** Plugin options */
  options?: Record<string, any>;

  /** Registration timestamp */
  registeredAt: Date;

  /** Execution statistics */
  stats: {
    executionCount: number;
    totalExecutionTime: number;
    successCount: number;
    failureCount: number;
    lastExecuted?: Date;
  };
}

/**
 * Example plugin configurations
 */
export interface ColorReplacerOptions {
  /** Color mapping (old color → new color) */
  colors: Record<string, string>;

  /** Whether to replace in attributes only or also in styles */
  includeStyles?: boolean;

  /** Case-sensitive matching */
  caseSensitive?: boolean;
}

export interface WatermarkRemoverOptions {
  /** Text patterns to remove */
  textPatterns?: string[];

  /** Elements to remove by id */
  elementIds?: string[];

  /** Remove hidden elements */
  removeHidden?: boolean;
}

export interface CustomOptimizerOptions {
  /** Custom optimization function */
  optimize: (svg: string) => string;

  /** Maximum allowed visual difference */
  maxDiffPercent?: number;
}
