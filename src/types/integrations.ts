/**
 * Type definitions for build tool integrations
 */

import type { FrameworkType, SVGConfig } from './index.js';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Base options for all integrations
 */
export interface BaseIntegrationOptions {
  /**
   * Source directory containing SVG files
   */
  source?: string;

  /**
   * Output directory for generated components
   */
  output?: string;

  /**
   * Framework to generate components for
   */
  framework?: FrameworkType;

  /**
   * Whether to use TypeScript
   */
  typescript?: boolean;

  /**
   * Custom configuration
   */
  config?: Partial<SVGConfig>;

  /**
   * Include pattern (glob)
   */
  include?: string | string[];

  /**
   * Exclude pattern (glob)
   */
  exclude?: string | string[];
}

// ============================================================================
// Webpack Plugin Types
// ============================================================================

export interface WebpackPluginOptions extends BaseIntegrationOptions {
  /**
   * Enable Hot Module Replacement
   * @default true
   */
  hmr?: boolean;

  /**
   * Emit files to output directory
   * @default true
   */
  emitFile?: boolean;

  /**
   * Generate index file with exports
   * @default true
   */
  generateIndex?: boolean;

  /**
   * Watch mode options
   */
  watch?: {
    /**
     * Debounce delay in milliseconds
     * @default 300
     */
    debounce?: number;

    /**
     * Paths to ignore
     */
    ignored?: string | string[];
  };
}

/**
 * Webpack loader options
 */
export interface WebpackLoaderOptions extends BaseIntegrationOptions {
  /**
   * Export format
   * @default 'default'
   */
  exportType?: 'default' | 'named';

  /**
   * SVGO optimization options
   */
  svgo?: boolean | Record<string, any>;
}

// ============================================================================
// Vite Plugin Types
// ============================================================================

export interface VitePluginOptions extends BaseIntegrationOptions {
  /**
   * Enable Hot Module Replacement
   * @default true
   */
  hmr?: boolean;

  /**
   * Use virtual modules for components
   * @default false
   */
  virtual?: boolean;

  /**
   * Default export or named export
   * @default 'default'
   */
  exportType?: 'default' | 'named';

  /**
   * SVGO optimization options
   */
  svgo?: boolean | Record<string, any>;

  /**
   * Generate index file with exports
   * @default true
   */
  generateIndex?: boolean;
}

// ============================================================================
// Rollup Plugin Types
// ============================================================================

export interface RollupPluginOptions extends BaseIntegrationOptions {
  /**
   * Default export or named export
   * @default 'default'
   */
  exportType?: 'default' | 'named';

  /**
   * SVGO optimization options
   */
  svgo?: boolean | Record<string, any>;

  /**
   * Generate index file with exports
   * @default true
   */
  generateIndex?: boolean;

  /**
   * Generate source maps
   * @default false
   */
  sourcemap?: boolean;
}

// ============================================================================
// Next.js Plugin Types
// ============================================================================

export interface NextJsPluginOptions extends BaseIntegrationOptions {
  /**
   * Enable Hot Module Replacement
   * @default true
   */
  hmr?: boolean;

  /**
   * Server-side rendering support
   * @default true
   */
  ssr?: boolean;

  /**
   * Generate index file with exports
   * @default true
   */
  generateIndex?: boolean;

  /**
   * Webpack configuration modifier
   */
  webpack?: (config: any, options: any) => any;
}

// ============================================================================
// Babel Plugin Types
// ============================================================================

export interface BabelPluginOptions extends BaseIntegrationOptions {
  /**
   * Transform SVG imports to component imports
   * @default true
   */
  transformImports?: boolean;

  /**
   * Process all SVGs when plugin is initialized
   * @default true
   */
  processOnInit?: boolean;

  /**
   * Generate index file with all components
   * @default true
   */
  generateIndex?: boolean;
}

// ============================================================================
// Jest Preset Types
// ============================================================================

export interface JestPresetOptions {
  /**
   * Framework to use for component generation in tests
   * @default 'react'
   */
  framework?: FrameworkType;

  /**
   * Use TypeScript
   * @default true
   */
  typescript?: boolean;

  /**
   * Transform SVG files to components
   * @default true
   */
  transform?: boolean;

  /**
   * Mock SVG files as simple React components
   * @default false
   */
  mock?: boolean;
}

// ============================================================================
// Plugin Result Types
// ============================================================================

export interface ProcessingResult {
  /**
   * Whether processing was successful
   */
  success: boolean;

  /**
   * Path to the generated file
   */
  outputPath?: string;

  /**
   * Component name
   */
  componentName?: string;

  /**
   * Generated code
   */
  code?: string;

  /**
   * Source map
   */
  map?: string | null;

  /**
   * Error if processing failed
   */
  error?: Error;
}

export interface BatchProcessingResult {
  /**
   * Total files processed
   */
  total: number;

  /**
   * Successful conversions
   */
  successful: number;

  /**
   * Failed conversions
   */
  failed: number;

  /**
   * Individual results
   */
  results: ProcessingResult[];
}

// ============================================================================
// Build Tool Integration Metadata
// ============================================================================

export interface IntegrationMetadata {
  /**
   * Name of the build tool
   */
  name: string;

  /**
   * Version of the integration
   */
  version: string;

  /**
   * Supported file extensions
   */
  extensions: string[];

  /**
   * Whether HMR is supported
   */
  supportsHMR: boolean;

  /**
   * Whether source maps are supported
   */
  supportsSourceMaps: boolean;
}
