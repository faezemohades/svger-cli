import path from 'path';
import { FileSystem } from '../utils/native.js';
import { SVGConfig } from '../types/index.js';
import { logger } from '../core/logger.js';

/**
 * Professional configuration management service
 */
export class ConfigService {
  private static instance: ConfigService;
  private static readonly CONFIG_FILE = '.svgconfig.json';
  private cachedConfig: SVGConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get the default configuration
   */
  public getDefaultConfig(): SVGConfig {
    return {
      source: './src/assets/svg',
      output: './src/components/icons',
      watch: false,
      defaultWidth: 24,
      defaultHeight: 24,
      defaultFill: 'currentColor',
      exclude: [],
      styleRules: {
        fill: 'inherit',
        stroke: 'none',
      },
      plugins: [],
      template: {
        type: 'default'
      },
      errorHandling: {
        skipOnError: false,
        logLevel: 'info',
        maxRetries: 3
      },
      performance: {
        batchSize: 10,
        parallel: true,
        timeout: 30000
      }
    };
  }

  /**
   * Get configuration file path
   */
  private getConfigPath(): string {
    return path.resolve(ConfigService.CONFIG_FILE);
  }

  /**
   * Read configuration from file with caching
   */
  public readConfig(): SVGConfig {
    if (this.cachedConfig) {
      return { ...this.cachedConfig };
    }

    try {
      const configData = FileSystem.readJSONSync(this.getConfigPath());
      
      if (Object.keys(configData).length === 0) {
        logger.debug('No configuration found, using defaults');
        this.cachedConfig = this.getDefaultConfig();
        return this.cachedConfig;
      }

      // Merge with defaults to ensure all required properties exist
      this.cachedConfig = {
        ...this.getDefaultConfig(),
        ...configData
      };

      logger.debug('Configuration loaded successfully');
      return this.cachedConfig!;
    } catch (error) {
      logger.warn('Failed to read configuration, using defaults:', error);
      this.cachedConfig = this.getDefaultConfig();
      return this.cachedConfig;
    }
  }

  /**
   * Write configuration to file
   */
  public writeConfig(config: SVGConfig): void {
    try {
      FileSystem.writeJSONSync(this.getConfigPath(), config, { spaces: 2 });
      this.cachedConfig = config; // Update cache
      logger.success('Configuration saved successfully');
    } catch (error) {
      logger.error('Failed to write configuration:', error);
      throw error;
    }
  }

  /**
   * Initialize configuration with defaults
   */
  public async initConfig(): Promise<void> {
    const configPath = this.getConfigPath();
    
    if (await FileSystem.exists(configPath)) {
      logger.warn('Config file already exists:', configPath);
      return;
    }

    const defaultConfig = this.getDefaultConfig();
    this.writeConfig(defaultConfig);
    logger.success('Configuration initialized with defaults');
  }

  /**
   * Set a specific configuration value
   */
  public setConfig(key: string, value: any): void {
    const config = this.readConfig();
    
    // Support nested key paths like 'styleRules.fill'
    const keys = key.split('.');
    let current: any = config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }
    
    const finalKey = keys[keys.length - 1];
    current[finalKey] = value;
    
    this.writeConfig(config);
    logger.success(`Configuration updated: ${key} = ${value}`);
  }

  /**
   * Get a specific configuration value
   */
  public getConfig(key?: string): any {
    const config = this.readConfig();
    
    if (!key) {
      return config;
    }

    // Support nested key paths
    const keys = key.split('.');
    let current: any = config;
    
    for (const k of keys) {
      if (!(k in current)) {
        return undefined;
      }
      current = current[k];
    }
    
    return current;
  }

  /**
   * Validate configuration
   */
  public validateConfig(config?: SVGConfig): { valid: boolean; errors: string[] } {
    const configToValidate = config || this.readConfig();
    const errors: string[] = [];

    // Required string fields
    const requiredStringFields = ['source', 'output', 'defaultFill'];
    for (const field of requiredStringFields) {
      if (!configToValidate[field as keyof SVGConfig] || typeof configToValidate[field as keyof SVGConfig] !== 'string') {
        errors.push(`${field} must be a non-empty string`);
      }
    }

    // Required numeric fields
    const requiredNumericFields = ['defaultWidth', 'defaultHeight'];
    for (const field of requiredNumericFields) {
      const value = configToValidate[field as keyof SVGConfig];
      if (typeof value !== 'number' || value <= 0) {
        errors.push(`${field} must be a positive number`);
      }
    }

    // Validate exclude array
    if (configToValidate.exclude && !Array.isArray(configToValidate.exclude)) {
      errors.push('exclude must be an array');
    }

    // Validate styleRules object
    if (configToValidate.styleRules && typeof configToValidate.styleRules !== 'object') {
      errors.push('styleRules must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear cached configuration (useful for testing)
   */
  public clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * Display current configuration
   */
  public showConfig(): void {
    const config = this.readConfig();
    console.log('📄 Current Configuration:');
    console.log(JSON.stringify(config, null, 2));
  }
}

// Export singleton instance
export const configService = ConfigService.getInstance();