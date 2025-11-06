import { FileWatcher } from "./utils/native.js";
/**
 * Watches a source folder for changes to SVG files and automatically
 * rebuilds React components when SVGs are added, modified, or deleted.
 *
 * @param {Object} config - Watch configuration object.
 * @param {string} config.src - Source folder containing SVG files to watch.
 * @param {string} config.out - Output folder where React components are generated.
 * @returns {import("chokidar").FSWatcher} A chokidar file watcher instance.
 *
 * @example
 * watchSVGs({ src: "./src/assets/svg", out: "./src/components/icons" });
 *
 * // Watches the SVG folder and:
 * // - Generates new components when files are added.
 * // - Updates components when files change.
 * // - Removes components when SVGs are deleted.
 */
export declare function watchSVGs(config: {
    src: string;
    out: string;
}): Promise<FileWatcher>;
