/**
 * Legacy configuration module - delegates to ConfigService.
 *
 * @deprecated Use `configService` from `./services/config.js` instead.
 * This module exists only for backward compatibility and will be removed in v5.0.0.
 */
import { configService } from './services/config.js';

/**
 * Read the current svger-cli configuration.
 *
 * @deprecated Use `configService.readConfig()` instead.
 * @returns {Record<string, any>} Configuration object.
 */
export function readConfig(): Record<string, any> {
  return configService.readConfig();
}

/**
 * Write a configuration object to the config file.
 *
 * @deprecated Use `configService.writeConfig(config)` instead.
 * @param {Record<string, any>} config - Configuration object to write.
 */
export function writeConfig(config: Record<string, any>) {
  configService.writeConfig(config as any);
}

/**
 * Initialize the svger-cli configuration with default values.
 *
 * @deprecated Use `configService.initConfig()` instead.
 */
export async function initConfig() {
  return configService.initConfig();
}

/**
 * Set a specific configuration key to a new value.
 *
 * @deprecated Use `configService.setConfig(key, value)` instead.
 * @param {string} key - The config key to set.
 * @param {any} value - The value to assign to the key.
 */
export function setConfig(key: string, value: any) {
  configService.setConfig(key, value);
}

/**
 * Display the current configuration in the console.
 *
 * @deprecated Use `configService.showConfig()` instead.
 */
export function showConfig() {
  configService.showConfig();
}
