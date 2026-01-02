import path from 'path';
import { FileSystem } from './utils/native.js';

const CONFIG_FILE = '.svgconfig.json';

/**
 * Get the absolute path to the configuration file.
 *
 * @returns {string} Absolute path to .svgconfig.json
 */
function getConfigPath(): string {
  return path.resolve(CONFIG_FILE);
}

/**
 * Read the current svger-cli configuration.
 *
 * @returns {Record<string, any>} Configuration object. Returns an empty object if no config file exists.
 */
export function readConfig(): Record<string, any> {
  return FileSystem.readJSONSync(getConfigPath());
}

/**
 * Write a configuration object to the config file.
 *
 * @param {Record<string, any>} config - Configuration object to write.
 */
export function writeConfig(config: Record<string, any>) {
  FileSystem.writeJSONSync(getConfigPath(), config, { spaces: 2 });
}

/**
 * Initialize the svger-cli configuration with default values.
 * If a config file already exists, this function will not overwrite it.
 */
export async function initConfig() {
  if (await FileSystem.exists(getConfigPath())) {
    console.log('⚠️  Config file already exists:', getConfigPath());
    return;
  }

  const defaultConfig = {
    // Configuration Version (for migration compatibility)
    version: '4.0.0',

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

    // Legacy support (deprecated)
    template: {
      type: 'default',
    },
    frameworkOptions: {
      forwardRef: true,
      memo: false,
      scriptSetup: true,
      standalone: true,
    },
  };

  writeConfig(defaultConfig);
  console.log('✅ Config file created:', getConfigPath());
}

/**
 * Set a specific configuration key to a new value.
 *
 * @param {string} key - The config key to set.
 * @param {any} value - The value to assign to the key.
 */
export function setConfig(key: string, value: any) {
  const config = readConfig();
  config[key] = value;
  writeConfig(config);
  console.log(`✅ Set config ${key}=${value}`);
}

/**
 * Display the current configuration in the console.
 */
export function showConfig() {
  const config = readConfig();
  console.log('📄 Current Config:');
  console.log(JSON.stringify(config, null, 2));
}
