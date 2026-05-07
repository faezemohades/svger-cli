/**
 * Legacy configuration module - delegates to ConfigService.
 *
 * @deprecated Use `configService` from `./services/config.js` instead.
 * This module exists only for backward compatibility and will be removed in v5.0.0.
 */
import { configService } from './services/config.js';

type LegacyConfigValue = string | number | boolean | null | undefined;
type LegacyConfigRecord = Record<string, unknown>;

/**
 * Read the current svger-cli configuration.
 *
 * @deprecated Use `configService.readConfig()` instead.
 * @returns {LegacyConfigRecord} Configuration object.
 */
export function readConfig(): LegacyConfigRecord {
  return configService.readConfig() as unknown as LegacyConfigRecord;
}

/**
 * Write a configuration object to the config file.
 *
 * @deprecated Use `configService.writeConfig(config)` instead.
 * @param {LegacyConfigRecord} config - Configuration object to write.
 */
export function writeConfig(config: LegacyConfigRecord): void {
  configService.writeConfig(config as never);
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
 * @param {LegacyConfigValue} value - The value to assign to the key.
 */
export function setConfig(key: string, value: LegacyConfigValue): void {
  configService.setConfig(key, value);
}

/**
 * Display the current configuration in the console.
 *
 * @deprecated Use `configService.showConfig()` instead.
 */
export function showConfig(): void {
  configService.showConfig();
}
