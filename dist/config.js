import path from "path";
import { FileSystem } from "./utils/native.js";
const CONFIG_FILE = ".svgconfig.json";
/**
 * Get the absolute path to the configuration file.
 *
 * @returns {string} Absolute path to .svgconfig.json
 */
function getConfigPath() {
    return path.resolve(CONFIG_FILE);
}
/**
 * Read the current svger-cli configuration.
 *
 * @returns {Record<string, any>} Configuration object. Returns an empty object if no config file exists.
 */
export function readConfig() {
    return FileSystem.readJSONSync(getConfigPath());
}
/**
 * Write a configuration object to the config file.
 *
 * @param {Record<string, any>} config - Configuration object to write.
 */
export function writeConfig(config) {
    FileSystem.writeJSONSync(getConfigPath(), config, { spaces: 2 });
}
/**
 * Initialize the svger-cli configuration with default values.
 * If a config file already exists, this function will not overwrite it.
 */
export async function initConfig() {
    if (await FileSystem.exists(getConfigPath())) {
        console.log("⚠️  Config file already exists:", getConfigPath());
        return;
    }
    const defaultConfig = {
        source: "./src/assets/svg",
        output: "./src/components/icons",
        watch: false,
        defaultWidth: 24,
        defaultHeight: 24,
        defaultFill: "currentColor",
        exclude: [],
        styleRules: {
            fill: "inherit",
            stroke: "none",
        },
    };
    writeConfig(defaultConfig);
    console.log("✅ Config file created:", getConfigPath());
}
/**
 * Set a specific configuration key to a new value.
 *
 * @param {string} key - The config key to set.
 * @param {any} value - The value to assign to the key.
 */
export function setConfig(key, value) {
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
    console.log("📄 Current Config:");
    console.log(JSON.stringify(config, null, 2));
}
