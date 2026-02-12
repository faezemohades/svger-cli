import path from 'path';
import { FileSystem } from '../utils/native.js';
import { SVGConfig } from '../types/index.js';
import { logger } from '../core/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package version dynamically
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);
const CURRENT_VERSION = packageJson.version;

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
      // Configuration Version (for migration compatibility)
      version: CURRENT_VERSION,

      // Source & Output
      source: './src/assets/svg',
      output: './src/components/icons',

      // Framework Configuration
      framework: 'react',
      typescript: true,
      componentType: 'functional',

      // Processing Options
      watch: false,
      parallel: true,
      batchSize: 10,
      maxConcurrency: 4,
      cache: true,

      // Default Properties
      defaultWidth: 24,
      defaultHeight: 24,
      defaultFill: 'currentColor',
      defaultStroke: 'none',
      defaultStrokeWidth: 1,

      // Styling Configuration
      styleRules: {
        fill: 'inherit',
        stroke: 'none',
      },

      responsive: {
        breakpoints: ['sm', 'md', 'lg', 'xl'],
        values: {
          width: ['16px', '20px', '24px', '32px'],
          height: ['16px', '20px', '24px', '32px'],
        },
      },

      theme: {
        mode: 'auto',
        variables: {
          primary: 'currentColor',
          secondary: '#6b7280',
          accent: '#3b82f6',
        },
      },

      animations: [],

      // v4.0.0: Plugin System
      plugins: [],

      // Advanced Options
      exclude: [],
      include: [],

      // Error Handling
      errorHandling: {
        strategy: 'continue',
        maxRetries: 3,
        timeout: 30000,
      },

      // Performance Settings
      performance: {
        optimization: 'balanced',
        memoryLimit: 512,
        cacheTimeout: 3600000,
      },

      // Output Customization
      outputConfig: {
        naming: 'pascal',
        extension: 'tsx',
        directory: './src/components/icons',
      },

      // Framework-specific configurations
      react: {
        componentType: 'functional',
        forwardRef: true,
        memo: false,
        propsInterface: 'SVGProps',
        styledComponents: false,
        cssModules: false,
      },

      vue: {
        api: 'composition',
        setup: true,
        typescript: true,
        scoped: true,
        cssVariables: true,
      },

      angular: {
        standalone: true,
        signals: true,
        changeDetection: 'OnPush',
        encapsulation: 'Emulated',
      },
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

      // Check if migration is needed
      if (!configData.version || configData.version !== CURRENT_VERSION) {
        logger.info('Detected older configuration version, migrating...');
        const migratedConfig = this.migrateConfig(configData);
        this.cachedConfig = migratedConfig;
        return this.cachedConfig;
      }

      // Merge with defaults to ensure all required properties exist
      this.cachedConfig = {
        ...this.getDefaultConfig(),
        ...configData,
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
   * Migrate configuration from older versions to v4.0.0
   */
  public migrateConfig(config: any): SVGConfig {
    // Validate config is not null/undefined
    if (!config || typeof config !== 'object') {
      logger.warn('Invalid config provided for migration, using defaults');
      return this.getDefaultConfig();
    }

    const currentVersion = config.version || '3.0.0';

    // No migration needed if already current version
    if (currentVersion === CURRENT_VERSION) {
      return { ...this.getDefaultConfig(), ...config };
    }

    logger.info(
      `Migrating configuration from ${currentVersion} to ${CURRENT_VERSION}...`
    );

    // Migration from v3.x to v4.0.0
    const migratedConfig: any = { ...config };

    // Add version field
    migratedConfig.version = CURRENT_VERSION;

    // Ensure plugins array exists (new in v4.0.0)
    if (!migratedConfig.plugins) {
      migratedConfig.plugins = [];
      logger.info('Added plugins array (new in v4.0.0)');
    }

    // Migrate legacy plugin configurations
    if (migratedConfig.plugin) {
      logger.warn('Migrating legacy "plugin" field to "plugins" array');
      if (Array.isArray(migratedConfig.plugin)) {
        migratedConfig.plugins = migratedConfig.plugin;
      } else {
        migratedConfig.plugins = [migratedConfig.plugin];
      }
      delete migratedConfig.plugin;
    }

    // Ensure performance.optimization uses new values
    if (migratedConfig.performance?.optimization) {
      const oldOptimization = migratedConfig.performance.optimization;
      const optimizationMap: Record<string, string> = {
        none: 'fast',
        basic: 'fast',
        standard: 'balanced',
        aggressive: 'maximum',
        maximum: 'maximum',
      };

      if (optimizationMap[oldOptimization]) {
        migratedConfig.performance.optimization =
          optimizationMap[oldOptimization];
        logger.info(
          `Migrated optimization level: ${oldOptimization} → ${migratedConfig.performance.optimization}`
        );
      }
    }

    // Save migrated config merged with defaults to ensure all new keys exist
    const mergedMigratedConfig: SVGConfig = {
      ...this.getDefaultConfig(),
      ...migratedConfig,
    };
    this.writeConfig(mergedMigratedConfig);
    logger.success(
      `Configuration migrated from ${currentVersion} to ${CURRENT_VERSION}`
    );

    return mergedMigratedConfig;
  }

  /**
   * Validate configuration
   */
  public validateConfig(config?: SVGConfig): {
    valid: boolean;
    errors: string[];
  } {
    const configToValidate = config || this.readConfig();
    const errors: string[] = [];

    // Required string fields
    const requiredStringFields = ['source', 'output', 'defaultFill'];
    for (const field of requiredStringFields) {
      if (
        !configToValidate[field as keyof SVGConfig] ||
        typeof configToValidate[field as keyof SVGConfig] !== 'string'
      ) {
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
    if (
      configToValidate.styleRules &&
      typeof configToValidate.styleRules !== 'object'
    ) {
      errors.push('styleRules must be an object');
    }

    return {
      valid: errors.length === 0,
      errors,
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
