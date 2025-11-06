import path from "path";
import { generateSVG } from "./builder.js";
import { isLocked } from "./lock.js";
import { readConfig } from "./config.js";
import { FileSystem, FileWatcher } from "./utils/native.js";
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
export async function watchSVGs(config) {
    const srcDir = path.resolve(config.src);
    const outDir = path.resolve(config.out);
    const svgConfig = readConfig();
    if (!(await FileSystem.exists(srcDir))) {
        console.error("❌ Source folder not found:", srcDir);
        process.exit(1);
    }
    console.log(`👀 Watching for SVG changes in: ${srcDir}`);
    console.log("🚀 Watch mode active — waiting for file changes...");
    const watcher = new FileWatcher();
    // Watch the directory
    watcher.watch(srcDir, { recursive: false });
    // Handle file changes
    watcher.on("change", async (filePath) => {
        if (!filePath.endsWith(".svg"))
            return;
        console.log("Detected change in file:", filePath);
        if (isLocked(filePath)) {
            console.log(`⚠️ Skipped locked file: ${path.basename(filePath)}`);
            return;
        }
        console.log(`✏️ SVG updated: ${path.basename(filePath)}`);
        await generateSVG({ svgFile: filePath, outDir });
    });
    // Handle new files (rename event in fs.watch can indicate new files)
    watcher.on("rename", async (filePath) => {
        if (!filePath.endsWith(".svg"))
            return;
        // Check if file exists (new file) or doesn't exist (deleted file)
        const exists = await FileSystem.exists(filePath);
        if (exists) {
            console.log("Detected new file:", filePath);
            if (isLocked(filePath)) {
                console.log(`⚠️ Skipped locked file: ${path.basename(filePath)}`);
                return;
            }
            console.log(`➕ New SVG detected: ${path.basename(filePath)}`);
            await generateSVG({ svgFile: filePath, outDir });
        }
        else {
            // File was deleted
            const componentName = path.basename(filePath, ".svg");
            const outFile = path.join(outDir, `${componentName}.tsx`);
            if (await FileSystem.exists(outFile)) {
                await FileSystem.unlink(outFile);
                console.log(`🗑️ Removed component: ${componentName}.tsx`);
            }
        }
    });
    return watcher;
}
