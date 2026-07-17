import path from 'path';
import { FileSystem } from './utils/native.js';
import { isLocked } from './lock.js';
import { svgProcessor } from './processors/svg-processor.js';
import { configService } from './services/config.js';
import { frameworkTemplateEngine } from './core/framework-templates.js';
import { resolveOutputArtifactPath } from './security/input-safety.js';
import type { BuildOptions, UnsafeInputPolicy } from './types/index.js';
import { createSVGCompiler } from './compiler/create-svg-compiler.js';

let facadeWarningEmitted = false;

function emitFacadeDeprecationWarning(): void {
  if (facadeWarningEmitted) return;
  facadeWarningEmitted = true;
  process.emitWarning(
    'The legacy builder facade is deprecated and will be removed in v5.0. Use createSVGCompiler().build() instead.',
    { type: 'DeprecationWarning', code: 'DEP_SVGER_BUILDER' }
  );
}

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
export async function buildAll(config: BuildOptions) {
  emitFacadeDeprecationWarning();
  const compiler = await createSVGCompiler();
  return compiler.build(config);
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
  maxInputSizeBytes,
  unsafeInputPolicy,
}: {
  svgFile: string;
  outDir: string;
  maxInputSizeBytes?: number;
  unsafeInputPolicy?: UnsafeInputPolicy;
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
      maxInputSizeBytes: maxInputSizeBytes ?? svgConfig.maxInputSizeBytes,
      unsafeInputPolicy,
    }
  );

  const outputFolder = path.resolve(outDir);
  await FileSystem.ensureDir(outputFolder);

  const outFile = resolveOutputArtifactPath(
    outputFolder,
    `${componentName}.${fileExtension}`
  );
  await FileSystem.writeFile(outFile, componentCode, 'utf-8');

  console.log(`✅ Generated: ${componentName}.${fileExtension}`);
}
