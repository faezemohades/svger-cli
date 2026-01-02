/**
 * Enhanced Plugin Manager
 * Orchestrates plugin execution with hook-based architecture and visual validation
 */

import type {
  EnhancedPlugin,
  PluginHookType,
  PluginHookContext,
  PluginHookResult,
} from '../types/plugin-system.js';
import { logger } from './logger.js';
import { compareVisually } from '../utils/visual-diff.js';

/**
 * Plugin execution metrics
 */
interface PluginMetrics {
  pluginName: string;
  hookType: PluginHookType;
  executionTime: number;
  visualDiff?: number;
  validationPassed: boolean;
  error?: string;
}

/**
 * Enhanced Plugin Manager
 * Manages plugin lifecycle, hook execution, and visual validation
 */
export class EnhancedPluginManager {
  private plugins: Map<string, EnhancedPlugin> = new Map();
  private executionMetrics: PluginMetrics[] = [];
  private enableVisualValidation = true;

  constructor() {
    logger.debug('EnhancedPluginManager initialized');
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: EnhancedPlugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn(
        `Plugin "${plugin.name}" is already registered. Skipping duplicate.`
      );
      return;
    }

    // Validate plugin structure
    if (!this.validatePlugin(plugin)) {
      logger.error(`Plugin "${plugin.name}" failed validation. Skipping.`);
      return;
    }

    // Initialize plugin if it has init method
    if (plugin.init) {
      try {
        plugin.init();
        logger.debug(`Plugin "${plugin.name}" initialized successfully`);
      } catch (error) {
        logger.error(
          `Plugin "${plugin.name}" initialization failed:`,
          (error as Error).message
        );
        return;
      }
    }

    this.plugins.set(plugin.name, plugin);
    logger.info(
      `✅ Plugin registered: ${plugin.name} v${plugin.version} (${Object.keys(plugin.hooks).length} hooks)`
    );
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      logger.warn(`Plugin "${pluginName}" not found`);
      return;
    }

    // Cleanup plugin if it has cleanup method
    if (plugin.cleanup) {
      try {
        plugin.cleanup();
        logger.debug(`Plugin "${pluginName}" cleaned up successfully`);
      } catch (error) {
        logger.warn(
          `Plugin "${pluginName}" cleanup failed:`,
          (error as Error).message
        );
      }
    }

    this.plugins.delete(pluginName);
    logger.info(`🗑️  Plugin unregistered: ${pluginName}`);
  }

  /**
   * Execute plugins for a specific hook
   */
  async executeHook(
    hookType: PluginHookType,
    context: PluginHookContext
  ): Promise<PluginHookContext> {
    const pluginsForHook = this.getPluginsForHook(hookType);

    if (pluginsForHook.length === 0) {
      logger.debug(`No plugins registered for hook: ${hookType}`);
      return context;
    }

    logger.debug(
      `Executing ${pluginsForHook.length} plugin(s) for hook: ${hookType}`
    );

    const currentContext = { ...context };
    const startTime = performance.now();

    for (const plugin of pluginsForHook) {
      // Skip if previous plugin requested skip
      if (currentContext.skipRemaining) {
        logger.debug(
          `Skipping remaining plugins for hook: ${hookType} (requested by previous plugin)`
        );
        break;
      }

      try {
        const result = await this.executePluginHook(
          plugin,
          hookType,
          currentContext
        );

        // Update context with plugin result
        if (result.content !== undefined) {
          currentContext.content = result.content;
        }
        if (result.metadata) {
          currentContext.metadata = {
            ...currentContext.metadata,
            ...result.metadata,
          };
        }
        if (result.skipRemaining) {
          currentContext.skipRemaining = true;
        }
      } catch (error) {
        logger.error(
          `Plugin "${plugin.name}" failed at hook "${hookType}":`,
          (error as Error).message
        );
        // Continue with next plugin
      }
    }

    const totalTime = performance.now() - startTime;
    logger.debug(
      `Hook "${hookType}" execution completed in ${totalTime.toFixed(2)}ms`
    );

    return currentContext;
  }

  /**
   * Execute a single plugin hook with validation
   */
  private async executePluginHook(
    plugin: EnhancedPlugin,
    hookType: PluginHookType,
    context: PluginHookContext
  ): Promise<PluginHookResult> {
    const hookFn = plugin.hooks[hookType];
    if (!hookFn) {
      return { content: context.content };
    }

    const startTime = performance.now();
    const originalContent = context.content;

    logger.debug(`Executing plugin "${plugin.name}" at hook "${hookType}"`);

    // Execute plugin hook
    const result = await hookFn(context);
    const executionTime = performance.now() - startTime;

    // Visual validation if enabled
    let visualDiff = 0;
    let validationPassed = true;

    if (
      this.enableVisualValidation &&
      plugin.validation?.enabled &&
      result.content &&
      result.content !== originalContent
    ) {
      try {
        const compareResult = await compareVisually(
          originalContent,
          result.content,
          plugin.validation.options
        );

        visualDiff = compareResult.mismatchPercent;
        const maxDiff = plugin.validation.maxDiffPercent ?? 5;
        validationPassed = visualDiff <= maxDiff;

        if (!validationPassed) {
          logger.warn(
            `Plugin "${plugin.name}" exceeded visual diff threshold: ${visualDiff.toFixed(4)}% > ${maxDiff}%`
          );
        } else {
          logger.debug(
            `Plugin "${plugin.name}" visual validation passed: ${visualDiff.toFixed(4)}% <= ${maxDiff}%`
          );
        }
      } catch (error) {
        logger.warn(
          `Plugin "${plugin.name}" visual validation failed:`,
          (error as Error).message
        );
        validationPassed = false;
      }
    }

    // Record metrics
    this.executionMetrics.push({
      pluginName: plugin.name,
      hookType,
      executionTime,
      visualDiff: visualDiff > 0 ? visualDiff : undefined,
      validationPassed,
    });

    logger.debug(
      `Plugin "${plugin.name}" completed in ${executionTime.toFixed(2)}ms` +
        (visualDiff > 0 ? ` (visual diff: ${visualDiff.toFixed(4)}%)` : '')
    );

    return result;
  }

  /**
   * Get plugins that have a specific hook
   */
  private getPluginsForHook(hookType: PluginHookType): EnhancedPlugin[] {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.hooks[hookType] !== undefined
    );
  }

  /**
   * Validate plugin structure
   */
  private validatePlugin(plugin: EnhancedPlugin): boolean {
    // Check required fields
    if (!plugin.name || !plugin.version) {
      logger.error('Plugin must have name and version');
      return false;
    }

    // Check hooks
    if (!plugin.hooks || Object.keys(plugin.hooks).length === 0) {
      logger.error(`Plugin "${plugin.name}" has no hooks defined`);
      return false;
    }

    // Validate hook types
    const validHooks: PluginHookType[] = [
      'before-parse',
      'after-parse',
      'before-stage',
      'after-stage',
      'before-serialize',
      'after-serialize',
    ];

    for (const hookType of Object.keys(plugin.hooks)) {
      if (!validHooks.includes(hookType as PluginHookType)) {
        logger.error(
          `Plugin "${plugin.name}" has invalid hook type: ${hookType}`
        );
        return false;
      }
    }

    // Run custom validation if provided
    if (plugin.validate) {
      try {
        const isValid = plugin.validate();
        if (!isValid) {
          logger.error(`Plugin "${plugin.name}" custom validation failed`);
          return false;
        }
      } catch (error) {
        logger.error(
          `Plugin "${plugin.name}" validation threw error:`,
          (error as Error).message
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Get execution metrics
   */
  getMetrics(): PluginMetrics[] {
    return [...this.executionMetrics];
  }

  /**
   * Clear execution metrics
   */
  clearMetrics(): void {
    this.executionMetrics = [];
  }

  /**
   * Get summary of execution metrics
   */
  getMetricsSummary(): {
    totalPlugins: number;
    totalExecutions: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    validationsPassed: number;
    validationsFailed: number;
  } {
    const totalExecutions = this.executionMetrics.length;
    const totalExecutionTime = this.executionMetrics.reduce(
      (sum, m) => sum + m.executionTime,
      0
    );
    const validationsPassed = this.executionMetrics.filter(
      m => m.validationPassed
    ).length;
    const validationsFailed = this.executionMetrics.filter(
      m => !m.validationPassed
    ).length;

    return {
      totalPlugins: this.plugins.size,
      totalExecutions,
      totalExecutionTime,
      averageExecutionTime:
        totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
      validationsPassed,
      validationsFailed,
    };
  }

  /**
   * List all registered plugins
   */
  listPlugins(): Array<{
    name: string;
    version: string;
    description?: string;
    hooks: PluginHookType[];
  }> {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      hooks: Object.keys(plugin.hooks) as PluginHookType[],
    }));
  }

  /**
   * Get a specific plugin by name
   */
  getPlugin(name: string): EnhancedPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Enable or disable visual validation
   */
  setVisualValidation(enabled: boolean): void {
    this.enableVisualValidation = enabled;
    logger.info(
      `Visual validation ${enabled ? 'enabled' : 'disabled'} for all plugins`
    );
  }

  /**
   * Get total number of registered plugins
   */
  get pluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Clear all plugins (useful for testing)
   */
  clearPlugins(): void {
    // Cleanup all plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        try {
          plugin.cleanup();
        } catch (error) {
          logger.warn(
            `Cleanup failed for plugin "${plugin.name}":`,
            (error as Error).message
          );
        }
      }
    }

    this.plugins.clear();
    this.clearMetrics();
    logger.info('All plugins cleared');
  }
}

// Singleton instance
let pluginManagerInstance: EnhancedPluginManager | null = null;

/**
 * Get the global plugin manager instance
 */
export function getPluginManager(): EnhancedPluginManager {
  if (!pluginManagerInstance) {
    pluginManagerInstance = new EnhancedPluginManager();
  }
  return pluginManagerInstance;
}

/**
 * Reset the plugin manager (useful for testing)
 */
export function resetPluginManager(): void {
  if (pluginManagerInstance) {
    pluginManagerInstance.clearPlugins();
  }
  pluginManagerInstance = null;
}
