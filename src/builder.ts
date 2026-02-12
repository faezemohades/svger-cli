import path from 'path';
import { FileSystem } from './utils/native.js';
import { isLocked } from './lock.js';
import { svgProcessor } from './processors/svg-processor.js';
import { configService } from './services/config.js';
import { frameworkTemplateEngine } from './core/framework-templates.js';

/**
 * Converts all SVG files from a source directory into framework components
 * and writes them to an output directory. Respects the configured framework,
 * TypeScript setting, and other options from the config file.
 *
 * @param {Object} config - Configuration object.
 * @param {string} config.src - Path to the source folder containing SVG files.
 * @param {string} config.out - Path to the output folder where components will be generated.
 * @returns {Promise<void>} Resolves when all SVGs have been processed.
 */
export async function buildAll(config: { src: string; out: string }) {
  const svgConfig = configService.readConfig();
  const srcDir = path.resolve(config.src);
  const outDir = path.resolve(config.out);

  if (!(await FileSystem.exists(srcDir))) {
    throw new Error(`Source folder not found: ${srcDir}`);
  }

  await FileSystem.ensureDir(outDir);
  const files = (await FileSystem.readDir(srcDir)).filter((f: string) =>
    f.endsWith('.svg')
  );

  if (!files.length) {
    console.log('⚠️  No SVG files found in', srcDir);
    return;
  }

  const framework = svgConfig.framework || 'react';
  const typescript = svgConfig.typescript !== false;
  const fileExtension = frameworkTemplateEngine.getFileExtension(
    framework,
    typescript
  );

  for (const file of files) {
    const svgPath = path.join(srcDir, file);

    if (isLocked(svgPath)) {
      console.log(`⚠️ Skipped locked file: ${file}`);
      continue;
    }

    const svgContent = await FileSystem.readFile(svgPath, 'utf-8');
    const componentName = svgProcessor.generateComponentName(
      file,
      svgConfig.outputConfig?.naming || 'pascal'
    );

    const componentCode = await svgProcessor.generateComponent(
      componentName,
      svgContent,
      {
        framework,
        typescript,
        defaultWidth: svgConfig.defaultWidth,
        defaultHeight: svgConfig.defaultHeight,
        defaultFill: svgConfig.defaultFill,
        styleRules: svgConfig.styleRules,
      }
    );

    const outFile = path.join(outDir, `${componentName}.${fileExtension}`);
    await FileSystem.writeFile(outFile, componentCode, 'utf-8');
    console.log(`✅ Generated: ${componentName}.${fileExtension}`);
  }

  console.log('🎉 All SVGs have been converted successfully!');
}

/**
 * Generates a single framework component from an SVG file.
 * Respects the configured framework and TypeScript settings.
 *
 * @param {Object} params - Parameters object.
 * @param {string} params.svgFile - Path to the SVG file to be converted.
 * @param {string} params.outDir - Path to the output folder for the generated component.
 * @returns {Promise<void>} Resolves when the SVG has been converted.
 */
export async function generateSVG({
  svgFile,
  outDir,
}: {
  svgFile: string;
  outDir: string;
}) {
  const svgConfig = configService.readConfig();
  const filePath = path.resolve(svgFile);

  if (isLocked(filePath)) {
    console.log(`⚠️ Skipped locked file: ${path.basename(svgFile)}`);
    return;
  }

  if (!(await FileSystem.exists(filePath))) {
    throw new Error(`SVG file not found: ${filePath}`);
  }

  const framework = svgConfig.framework || 'react';
  const typescript = svgConfig.typescript !== false;
  const fileExtension = frameworkTemplateEngine.getFileExtension(
    framework,
    typescript
  );

  const svgContent = await FileSystem.readFile(filePath, 'utf-8');
  const componentName = svgProcessor.generateComponentName(
    path.basename(svgFile),
    svgConfig.outputConfig?.naming || 'pascal'
  );

  const componentCode = await svgProcessor.generateComponent(
    componentName,
    svgContent,
    {
      framework,
      typescript,
      defaultWidth: svgConfig.defaultWidth,
      defaultHeight: svgConfig.defaultHeight,
      defaultFill: svgConfig.defaultFill,
      styleRules: svgConfig.styleRules,
    }
  );

  const outputFolder = path.resolve(outDir);
  await FileSystem.ensureDir(outputFolder);

  const outFile = path.join(outputFolder, `${componentName}.${fileExtension}`);
  await FileSystem.writeFile(outFile, componentCode, 'utf-8');

  console.log(`✅ Generated: ${componentName}.${fileExtension}`);
}
