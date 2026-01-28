/**
 * Phase 6.3: Visual Diff Testing
 *
 * Provides pixel-perfect comparison of SVGs before/after optimization
 * to ensure zero visual regression.
 *
 * Uses:
 * - sharp: SVG → PNG rendering (via librsvg) [OPTIONAL]
 * - pixelmatch: Pixel-by-pixel comparison [OPTIONAL]
 * - pngjs: PNG buffer handling [OPTIONAL]
 *
 * These dependencies are lazy-loaded and optional.
 * Install them only if you need visual validation:
 * npm install --save-dev sharp pixelmatch pngjs
 */

// Lazy imports - only loaded when visual validation is used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharp: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pixelmatch: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PNG: any = null;

/**
 * Lazy-load optional visual diff dependencies
 */
async function loadVisualDiffDependencies() {
  if (sharp && pixelmatch && PNG) {
    return; // Already loaded
  }

  try {
    const sharpModule = await import('sharp');
    sharp = sharpModule.default;

    const pixelmatchModule = await import('pixelmatch');
    pixelmatch = pixelmatchModule.default;

    const pngjsModule = await import('pngjs');
    PNG = pngjsModule.PNG;
  } catch (error) {
    throw new Error(
      'Visual diff validation requires optional dependencies. Install them with:\n' +
        'npm install --save-dev sharp pixelmatch pngjs\n\n' +
        'Or skip visual validation by removing the --validate flag.'
    );
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Rendering configuration for SVG → PNG conversion
 */
export interface RenderConfig {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** DPI density (144 = 2x retina) */
  density: number;
  /** Background color */
  background: string;
}

/**
 * Pixel comparison configuration
 */
export interface DiffConfig {
  /** Pixel color difference threshold (0-1, default: 0.1) */
  threshold: number;
  /** Include anti-aliasing in diff detection */
  includeAA: boolean;
  /** Alpha blend value for diff mask (0-1) */
  alpha: number;
  /** RGB color for highlighted differences */
  diffColor: [number, number, number];
  /** Maximum allowed difference percentage (0-100) */
  maxDiffPercent: number;
}

/**
 * Visual diff comparison result
 */
export interface VisualDiffResult {
  /** True if difference is within acceptable threshold */
  passed: boolean;
  /** Number of different pixels */
  mismatchCount: number;
  /** Percentage of different pixels (0-100) */
  mismatchPercent: number;
  /** Total pixel count */
  totalPixels: number;
  /** PNG buffer with highlighted differences (if generated) */
  diffImage?: Buffer;
  /** Human-readable summary message */
  message: string;
}

/**
 * Options for compareVisually()
 */
export interface CompareOptions {
  /** Rendering configuration */
  render?: Partial<RenderConfig>;
  /** Diff comparison configuration */
  diff?: Partial<DiffConfig>;
  /** Path to save diff image (optional) */
  saveDiffImage?: string;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_RENDER_CONFIG: RenderConfig = {
  width: 800,
  height: 600,
  density: 144, // 2x retina for fine details
  background: 'transparent',
};

const DEFAULT_DIFF_CONFIG: DiffConfig = {
  threshold: 0.1, // 10% color difference per pixel
  includeAA: false, // Ignore anti-aliasing differences
  alpha: 0.1, // 10% alpha blend for diff mask
  diffColor: [255, 0, 255], // Magenta
  maxDiffPercent: 0.1, // 0.1% of pixels can differ
};

// ============================================================================
// Error Handling
// ============================================================================

export class VisualDiffError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'RENDER_FAILED'
      | 'COMPARISON_FAILED'
      | 'THRESHOLD_EXCEEDED'
  ) {
    super(message);
    this.name = 'VisualDiffError';
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Render SVG string to PNG buffer
 *
 * @param svgContent - SVG string to render
 * @param config - Rendering configuration
 * @returns PNG buffer
 */
export async function renderSVG(
  svgContent: string,
  config?: Partial<RenderConfig>
): Promise<Buffer> {
  await loadVisualDiffDependencies();

  const renderConfig: RenderConfig = { ...DEFAULT_RENDER_CONFIG, ...config };

  try {
    // Create SVG buffer
    const svgBuffer = Buffer.from(svgContent, 'utf-8');

    // Render to PNG using sharp
    const pngBuffer = await sharp(svgBuffer, { density: renderConfig.density })
      .resize(renderConfig.width, renderConfig.height, {
        fit: 'contain',
        background: renderConfig.background,
      })
      .png()
      .toBuffer();

    return pngBuffer;
  } catch (error) {
    throw new VisualDiffError(
      `Failed to render SVG: ${error instanceof Error ? error.message : String(error)}`,
      'RENDER_FAILED'
    );
  }
}

/**
 * Compare two PNG buffers pixel-by-pixel
 *
 * @param beforePNG - Original PNG buffer
 * @param afterPNG - Optimized PNG buffer
 * @param config - Diff configuration
 * @param generateDiffImage - Whether to generate diff image
 * @returns Comparison result with mismatch count and percentage
 */
export async function comparePixels(
  beforePNG: Buffer,
  afterPNG: Buffer,
  config?: Partial<DiffConfig>,
  generateDiffImage: boolean = false
): Promise<{
  mismatchCount: number;
  mismatchPercent: number;
  totalPixels: number;
  diffImage?: Buffer;
}> {
  await loadVisualDiffDependencies();

  const diffConfig: DiffConfig = { ...DEFAULT_DIFF_CONFIG, ...config };

  try {
    // Parse PNG buffers
    const img1 = PNG.sync.read(beforePNG);
    const img2 = PNG.sync.read(afterPNG);

    // Verify dimensions match
    if (img1.width !== img2.width || img1.height !== img2.height) {
      throw new VisualDiffError(
        `Image dimensions mismatch: ${img1.width}×${img1.height} vs ${img2.width}×${img2.height}`,
        'COMPARISON_FAILED'
      );
    }

    const { width, height } = img1;
    const totalPixels = width * height;

    // Create diff image buffer if requested
    const diff = generateDiffImage ? new PNG({ width, height }) : undefined;

    // Compare pixels
    const mismatchCount = pixelmatch(
      img1.data,
      img2.data,
      diff?.data,
      width,
      height,
      {
        threshold: diffConfig.threshold,
        includeAA: diffConfig.includeAA,
        alpha: diffConfig.alpha,
        diffColor: diffConfig.diffColor,
      }
    );

    const mismatchPercent = (mismatchCount / totalPixels) * 100;

    // Generate diff image buffer if requested
    let diffImage: Buffer | undefined;
    if (diff) {
      diffImage = PNG.sync.write(diff);
    }

    return {
      mismatchCount,
      mismatchPercent,
      totalPixels,
      diffImage,
    };
  } catch (error) {
    if (error instanceof VisualDiffError) {
      throw error;
    }
    throw new VisualDiffError(
      `Pixel comparison failed: ${error instanceof Error ? error.message : String(error)}`,
      'COMPARISON_FAILED'
    );
  }
}

/**
 * Compare two SVG strings for visual differences
 *
 * Main entry point for visual diff testing.
 *
 * @param beforeSVG - Original SVG string
 * @param afterSVG - Optimized SVG string
 * @param options - Comparison options
 * @returns Visual diff result
 *
 * @example
 * ```typescript
 * const result = await compareVisually(original, optimized, {
 *   diff: { maxDiffPercent: 0.1 },
 *   saveDiffImage: './diff.png'
 * });
 *
 * if (result.passed) {
 *   console.log('✓ Visual appearance preserved');
 * } else {
 *   console.error(`✗ ${result.mismatchPercent.toFixed(2)}% difference detected`);
 * }
 * ```
 */
export async function compareVisually(
  beforeSVG: string,
  afterSVG: string,
  options?: CompareOptions
): Promise<VisualDiffResult> {
  const renderConfig = options?.render;
  const diffConfig = options?.diff;
  const maxDiffPercent =
    diffConfig?.maxDiffPercent ?? DEFAULT_DIFF_CONFIG.maxDiffPercent;
  const shouldSaveDiff = !!options?.saveDiffImage;

  try {
    // Step 1: Render both SVGs to PNG
    const beforePNG = await renderSVG(beforeSVG, renderConfig);
    const afterPNG = await renderSVG(afterSVG, renderConfig);

    // Step 2: Compare pixels
    const { mismatchCount, mismatchPercent, totalPixels, diffImage } =
      await comparePixels(beforePNG, afterPNG, diffConfig, shouldSaveDiff);

    // Step 3: Determine pass/fail
    const passed = mismatchPercent <= maxDiffPercent;

    // Step 4: Generate summary message
    const message = passed
      ? `Visual diff passed: ${mismatchPercent.toFixed(4)}% difference (threshold: ${maxDiffPercent}%)`
      : `Visual diff failed: ${mismatchPercent.toFixed(4)}% difference exceeds threshold of ${maxDiffPercent}%`;

    // Step 5: Save diff image if requested
    if (options?.saveDiffImage && diffImage) {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Ensure directory exists
      const dir = path.dirname(options.saveDiffImage);
      await fs.mkdir(dir, { recursive: true });

      // Write diff image
      await fs.writeFile(options.saveDiffImage, diffImage);
    }

    return {
      passed,
      mismatchCount,
      mismatchPercent,
      totalPixels,
      diffImage: shouldSaveDiff ? diffImage : undefined,
      message,
    };
  } catch (error) {
    if (error instanceof VisualDiffError) {
      throw error;
    }
    throw new VisualDiffError(
      `Visual comparison failed: ${error instanceof Error ? error.message : String(error)}`,
      'COMPARISON_FAILED'
    );
  }
}

/**
 * Safe wrapper for compareVisually that returns null on error
 *
 * @param beforeSVG - Original SVG string
 * @param afterSVG - Optimized SVG string
 * @param options - Comparison options
 * @returns Visual diff result or null on error
 */
export async function safeCompareVisually(
  beforeSVG: string,
  afterSVG: string,
  options?: CompareOptions
): Promise<VisualDiffResult | null> {
  try {
    return await compareVisually(beforeSVG, afterSVG, options);
  } catch (error) {
    if (error instanceof VisualDiffError) {
      console.warn(`Visual diff error: ${error.message} (${error.code})`);
      return null;
    }
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format visual diff result as human-readable string
 *
 * @param result - Visual diff result
 * @returns Formatted string
 */
export function formatDiffResult(result: VisualDiffResult): string {
  const status = result.passed ? '✓ PASSED' : '✗ FAILED';
  const percent = result.mismatchPercent.toFixed(4);
  const pixels = result.mismatchCount.toLocaleString();
  const total = result.totalPixels.toLocaleString();

  return [
    `${status}: ${percent}% difference`,
    `Mismatched pixels: ${pixels} / ${total}`,
    result.message,
  ].join('\n');
}

/**
 * Batch compare multiple SVG pairs
 *
 * @param pairs - Array of [before, after] SVG pairs
 * @param options - Comparison options
 * @returns Array of results
 */
export async function batchCompare(
  pairs: Array<{ name: string; before: string; after: string }>,
  options?: CompareOptions
): Promise<Array<{ name: string; result: VisualDiffResult }>> {
  const results: Array<{ name: string; result: VisualDiffResult }> = [];

  for (const { name, before, after } of pairs) {
    try {
      const result = await compareVisually(before, after, options);
      results.push({ name, result });
    } catch (error) {
      console.error(`Failed to compare ${name}:`, error);
    }
  }

  return results;
}
