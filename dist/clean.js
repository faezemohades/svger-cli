import path from "path";
import { FileSystem } from "./utils/native.js";
/**
 * Cleans the specified output directory by removing all files and folders inside it.
 * Typically used to clear previously generated SVG React components before a new build.
 *
 * @param {string} outDir - Path to the output directory to be cleaned.
 * @returns {Promise<void>} Resolves when the directory has been emptied.
 */
export async function clean(outDir) {
    const targetDir = path.resolve(outDir);
    if (!(await FileSystem.exists(targetDir))) {
        console.log(`⚠️ Directory not found: ${targetDir}`);
        return;
    }
    await FileSystem.emptyDir(targetDir);
    console.log(`🧹 Cleaned all generated SVG components in: ${targetDir}`);
}
