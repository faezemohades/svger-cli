/**
 * Read the current svger-cli configuration.
 *
 * @returns {Record<string, any>} Configuration object. Returns an empty object if no config file exists.
 */
export declare function readConfig(): Record<string, any>;
/**
 * Write a configuration object to the config file.
 *
 * @param {Record<string, any>} config - Configuration object to write.
 */
export declare function writeConfig(config: Record<string, any>): void;
/**
 * Initialize the svger-cli configuration with default values.
 * If a config file already exists, this function will not overwrite it.
 */
export declare function initConfig(): Promise<void>;
/**
 * Set a specific configuration key to a new value.
 *
 * @param {string} key - The config key to set.
 * @param {any} value - The value to assign to the key.
 */
export declare function setConfig(key: string, value: any): void;
/**
 * Display the current configuration in the console.
 */
export declare function showConfig(): void;
