/**
 * SVGER-CLI - Zero-Dependency SVG to React Component Generator
 * 
 * A high-performance, framework-agnostic SVG processing toolkit with enterprise-grade
 * architecture and comprehensive styling capabilities.
 * 
 * @version 2.0.0
 * @author SVGER-CLI Development Team
 * @license MIT
 */

// ============================================================================
// CORE SERVICES
// ============================================================================

/**
 * Logger Service - Professional logging with configurable levels and color formatting
 * Provides: debug, info, warn, error, success methods with timestamp and context
 */
export { LoggerService, logger } from './core/logger.js';

/**
 * Configuration Management Service - Centralized configuration with validation and caching
 * Provides: config loading, validation, defaults, and file-based persistence
 */
export { ConfigService, configService } from './services/config.js';

/**
 * Error Handler - Comprehensive error management with recovery strategies
 * Provides: structured error handling, recovery mechanisms, and user-friendly messages
 */
export { SVGErrorHandler, errorHandler, withErrorHandling, handleErrors } from './core/error-handler.js';

// ============================================================================
// PROCESSING ENGINES
// ============================================================================

/**
 * SVG Processor - Core SVG content processing and React component generation
 * Provides: SVG parsing, optimization, React component generation, and batch processing
 */
export { SVGProcessor, svgProcessor } from './processors/svg-processor.js';

/**
 * Performance Engine - Advanced optimization for batch processing and parallel execution
 * Provides: batch processing, caching, memory optimization, and performance monitoring
 */
export { PerformanceEngine, performanceEngine } from './core/performance-engine.js';

/**
 * Style Compiler - Comprehensive styling system with responsive design and theming
 * Provides: CSS generation, theme management, responsive values, and style optimization
 */
export { SVGStyleCompiler, styleCompiler } from './core/style-compiler.js';

// ============================================================================
// TEMPLATE SYSTEMS
// ============================================================================

/**
 * Template Manager - Extensible template system for React component generation
 * Provides: multiple component patterns (functional, class, forwardRef, styled-components)
 */
export { TemplateManager, templateManager } from './core/template-manager.js';

/**
 * Framework Template Engine - Universal template generator supporting multiple UI frameworks
 * Provides: React, Vue, Svelte, Angular, Solid, Preact, Lit, and Vanilla JS components
 */
export { 
  FrameworkTemplateEngine, 
  frameworkTemplateEngine,
  type FrameworkType,
  type FrameworkTemplateOptions 
} from './core/framework-templates.js';

// ============================================================================
// PLUGIN ARCHITECTURE
// ============================================================================

/**
 * Plugin Manager - Extensible plugin system for SVG processing enhancements
 * Provides: plugin registration, lifecycle management, and content processing pipeline
 */
export { PluginManager, pluginManager } from './core/plugin-manager.js';

// ============================================================================
// UTILITY SERVICES
// ============================================================================

/**
 * Native Node.js Utilities - Zero-dependency replacements for external libraries
 * Provides: file operations, string manipulation, CLI parsing, and file watching
 */
export { 
  toPascalCase, 
  FileSystem, 
  CLI, 
  FileWatcher 
} from './utils/native.js';

/**
 * File System Lock Functions - Concurrent file operation safety with advisory locking
 * Provides: file locking, unlocking, and lock status checking for safe concurrent access
 */
export { lockFiles, unlockFiles, isLocked } from './lock.js';

/**
 * File System Watcher - Real-time file system monitoring with change detection
 * Provides: directory watching, file change detection, and event-driven processing
 */
export { watchSVGs } from './watch.js';

/**
 * Project Builder - Automated project structure creation and dependency management
 * Provides: project scaffolding, dependency resolution, and build automation
 */
export { buildAll, generateSVG } from './builder.js';

/**
 * Content Cleaner - SVG content optimization and sanitization utilities
 * Provides: SVG cleaning, attribute normalization, and content optimization
 */
export { clean } from './clean.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * TypeScript Type Definitions - Comprehensive type system for all interfaces and configurations
 * Provides: complete type safety for all operations, configurations, and data structures
 */
export type {
  // Core configuration types
  SVGConfig,
  ComponentGenerationOptions,
  
  // Processing types
  SVGProcessorResult,
  ProcessingJob,
  ProcessingStatus,
  
  // Plugin system types
  Plugin,
  PluginConfig,
  
  // Template system types
  Template,
  TemplateConfig,
  
  // File operation types
  WatchOptions
} from './types/index.js';

/**
 * Error handling types - Available from core error handler
 */
export type { SVGError, ErrorRecoveryStrategy } from './core/error-handler.js';

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * Component Templates - Pre-built component templates for various use cases
 * Provides: functional React component template with TypeScript support
 */
export { reactTemplate } from './templates/ComponentTemplate.js';

// ============================================================================
// CONVENIENCE API
// ============================================================================

// Import instances for the convenience API
import { svgProcessor } from './processors/svg-processor.js';
import { watchSVGs } from './watch.js';
import { clean } from './clean.js';
import { buildAll } from './builder.js';

/**
 * Quick Start API - Simplified API for common operations
 * High-level functions for typical SVG processing workflows
 */
export const SVGER = {
  /**
   * Process single SVG file to React component
   */
  processFile: svgProcessor.processSVGFile.bind(svgProcessor),
  
  /**
   * Process multiple SVG files in batch
   */
  processBatch: svgProcessor.processBatch.bind(svgProcessor),
  
  /**
   * Generate framework-agnostic component
   */
  generateFrameworkComponent: svgProcessor.generateFrameworkComponent.bind(svgProcessor),
  
  /**
   * Watch directory for changes
   */
  watch: watchSVGs,
  
  /**
   * Clean and optimize directory
   */
  clean,
  
  /**
   * Build all SVG files in directory
   */
  build: buildAll
} as const;

// ============================================================================
// VERSION INFORMATION
// ============================================================================

/**
 * Package Version Information
 */
export const VERSION = '2.0.0';
export const PACKAGE_NAME = 'svger-cli';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Default export - Primary SVG processor instance for quick access
 * Most common entry point for programmatic usage
 */
export default svgProcessor;