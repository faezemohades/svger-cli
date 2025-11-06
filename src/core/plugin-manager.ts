import { Plugin, PluginConfig } from '../types/index.js';
import { logger } from '../core/logger.js';

/**
 * Plugin management system for extending SVG processing capabilities
 */
export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, Plugin> = new Map();
  private activePlugins: Set<string> = new Set();

  private constructor() {
    this.loadBuiltinPlugins();
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * Load built-in plugins
   */
  private loadBuiltinPlugins(): void {
    // SVG Optimizer Plugin
    this.registerPlugin({
      name: 'svg-optimizer',
      version: '1.0.0',
      process: async (content: string, options?: any) => {
        return this.optimizeSVG(content, options);
      },
      validate: (options?: any) => true
    });

    // Color Theme Plugin
    this.registerPlugin({
      name: 'color-theme',
      version: '1.0.0',
      process: async (content: string, options?: any) => {
        return this.applyColorTheme(content, options);
      },
      validate: (options?: any) => {
        return options && typeof options.theme === 'object';
      }
    });

    // Size Normalizer Plugin
    this.registerPlugin({
      name: 'size-normalizer',
      version: '1.0.0',
      process: async (content: string, options?: any) => {
        return this.normalizeSizes(content, options);
      }
    });

    logger.debug('Built-in plugins loaded');
  }

  /**
   * Register a new plugin
   */
  public registerPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn(`Plugin ${plugin.name} is already registered, overwriting`);
    }
    
    this.plugins.set(plugin.name, plugin);
    logger.debug(`Plugin registered: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Enable a plugin
   */
  public enablePlugin(name: string, config?: PluginConfig): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    if (plugin.validate && config?.options && !plugin.validate(config.options)) {
      throw new Error(`Invalid options for plugin: ${name}`);
    }

    this.activePlugins.add(name);
    logger.info(`Plugin enabled: ${name}`);
  }

  /**
   * Disable a plugin
   */
  public disablePlugin(name: string): void {
    this.activePlugins.delete(name);
    logger.info(`Plugin disabled: ${name}`);
  }

  /**
   * Process content through all active plugins
   */
  public async processContent(
    content: string, 
    pluginConfigs: PluginConfig[] = []
  ): Promise<string> {
    let processedContent = content;

    for (const config of pluginConfigs) {
      const plugin = this.plugins.get(config.name);
      
      if (!plugin) {
        logger.warn(`Plugin not found: ${config.name}, skipping`);
        continue;
      }

      if (!this.activePlugins.has(config.name)) {
        logger.debug(`Plugin ${config.name} is disabled, skipping`);
        continue;
      }

      try {
        logger.debug(`Processing with plugin: ${config.name}`);
        processedContent = await plugin.process(processedContent, config.options);
      } catch (error) {
        logger.error(`Plugin ${config.name} failed:`, error);
        // Continue processing with other plugins
      }
    }

    return processedContent;
  }

  /**
   * Get list of available plugins
   */
  public getAvailablePlugins(): Array<{ name: string; version: string; enabled: boolean }> {
    return Array.from(this.plugins.entries()).map(([name, plugin]) => ({
      name,
      version: plugin.version,
      enabled: this.activePlugins.has(name)
    }));
  }

  /**
   * Built-in SVG optimizer
   */
  private optimizeSVG(content: string, options: any = {}): string {
    let optimized = content;

    // Remove unnecessary whitespace
    if (options.removeWhitespace !== false) {
      optimized = optimized.replace(/>\s+</g, '><');
    }

    // Remove empty groups
    if (options.removeEmptyGroups !== false) {
      optimized = optimized.replace(/<g[^>]*>\s*<\/g>/g, '');
    }

    // Merge similar paths (basic implementation)
    if (options.mergePaths === true) {
      // This would require more sophisticated path parsing
      logger.debug('Path merging not implemented yet');
    }

    // Remove comments
    if (options.removeComments !== false) {
      optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');
    }

    return optimized;
  }

  /**
   * Built-in color theme applier
   */
  private applyColorTheme(content: string, options: any = {}): string {
    if (!options.theme) {
      return content;
    }

    let themed = content;
    const theme = options.theme;

    // Replace colors according to theme
    for (const [originalColor, newColor] of Object.entries(theme)) {
      const colorRegex = new RegExp(`(fill|stroke)=["']${originalColor}["']`, 'g');
      themed = themed.replace(colorRegex, `$1="${newColor}"`);
    }

    return themed;
  }

  /**
   * Built-in size normalizer
   */
  private normalizeSizes(content: string, options: any = {}): string {
    const targetSize = options.size || 24;
    
    // This is a basic implementation - would need more sophisticated sizing logic
    let normalized = content;
    
    // Normalize stroke-width relative to size
    if (options.normalizeStrokes !== false) {
      const strokeRegex = /stroke-width=["']([^"']+)["']/g;
      normalized = normalized.replace(strokeRegex, (match, width) => {
        const numericWidth = parseFloat(width);
        if (!isNaN(numericWidth)) {
          const normalizedWidth = (numericWidth / 24) * targetSize;
          return `stroke-width="${normalizedWidth}"`;
        }
        return match;
      });
    }

    return normalized;
  }

  /**
   * Clear all plugins (useful for testing)
   */
  public clear(): void {
    this.plugins.clear();
    this.activePlugins.clear();
  }
}

// Export singleton instance
export const pluginManager = PluginManager.getInstance();