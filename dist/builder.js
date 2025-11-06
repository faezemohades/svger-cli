import path from "path";
import { toPascalCase, FileSystem } from "./utils/native.js";
import { isLocked } from "./lock.js";
import { readConfig } from "./config.js";
import { reactTemplate } from "./templates/ComponentTemplate.js";
/**
 * Converts all SVG files from a source directory into React components and writes them to an output directory.
 *
 * @param {Object} config - Configuration object.
 * @param {string} config.src - Path to the source folder containing SVG files.
 * @param {string} config.out - Path to the output folder where React components will be generated.
 * @returns {Promise<void>} Resolves when all SVGs have been processed.
 */
export async function buildAll(config) {
    const svgConfig = readConfig();
    const srcDir = path.resolve(config.src);
    const outDir = path.resolve(config.out);
    if (!(await FileSystem.exists(srcDir))) {
        console.error("❌ Source folder not found:", srcDir);
        process.exit(1);
    }
    await FileSystem.ensureDir(outDir);
    const files = (await FileSystem.readDir(srcDir)).filter((f) => f.endsWith(".svg"));
    if (!files.length) {
        console.log("⚠️  No SVG files found in", srcDir);
        return;
    }
    for (const file of files) {
        const svgPath = path.join(srcDir, file);
        if (isLocked(svgPath)) {
            console.log(`⚠️ Skipped locked file: ${file}`);
            continue;
        }
        const svgContent = await FileSystem.readFile(svgPath, "utf-8");
        const componentName = toPascalCase(file.replace(".svg", ""));
        const componentCode = reactTemplate({
            componentName,
            svgContent,
            defaultWidth: svgConfig.defaultWidth,
            defaultHeight: svgConfig.defaultHeight,
            defaultFill: svgConfig.defaultFill,
        });
        const outFile = path.join(outDir, `${componentName}.tsx`);
        await FileSystem.writeFile(outFile, componentCode, "utf-8");
        console.log(`✅ Generated: ${componentName}.tsx`);
    }
    console.log("🎉 All SVGs have been converted successfully!");
}
/**
 * Generates a single React component from an SVG file.
 *
 * @param {Object} params - Parameters object.
 * @param {string} params.svgFile - Path to the SVG file to be converted.
 * @param {string} params.outDir - Path to the output folder for the generated component.
 * @returns {Promise<void>} Resolves when the SVG has been converted.
 */
export async function generateSVG({ svgFile, outDir, }) {
    const svgConfig = readConfig();
    const filePath = path.resolve(svgFile);
    if (isLocked(filePath)) {
        console.log(`⚠️ Skipped locked file: ${path.basename(svgFile)}`);
        return;
    }
    if (!(await FileSystem.exists(filePath))) {
        console.error("❌ SVG file not found:", filePath);
        process.exit(1);
    }
    const svgContent = await FileSystem.readFile(filePath, "utf-8");
    const componentName = toPascalCase(path.basename(svgFile, ".svg"));
    const componentCode = reactTemplate({
        componentName,
        svgContent,
        defaultWidth: svgConfig.defaultWidth,
        defaultHeight: svgConfig.defaultHeight,
        defaultFill: svgConfig.defaultFill,
    });
    const outputFolder = path.resolve(outDir);
    await FileSystem.ensureDir(outputFolder);
    const outFile = path.join(outputFolder, `${componentName}.tsx`);
    await FileSystem.writeFile(outFile, componentCode, "utf-8");
    console.log(`✅ Generated: ${componentName}.tsx`);
}
