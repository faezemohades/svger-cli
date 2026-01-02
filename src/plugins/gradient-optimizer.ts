/**
 * Gradient Optimizer Plugin
 * Removes redundant gradient stops and optimizes gradient definitions
 *
 * Features:
 * - Remove duplicate gradient stops
 * - Merge gradients with identical stops
 * - Remove unused gradient definitions
 * - Optimize stop colors (round precision)
 *
 * Visual tolerance: 2% (gradients should look nearly identical)
 */

import type {
  EnhancedPlugin,
  PluginHookContext,
} from '../types/plugin-system.js';

/**
 * Configuration for gradient optimizer
 */
export interface GradientOptimizerOptions {
  /** Remove duplicate stops (default: true) */
  removeDuplicates?: boolean;

  /** Merge identical gradients (default: true) */
  mergeIdentical?: boolean;

  /** Remove unused gradients (default: true) */
  removeUnused?: boolean;

  /** Color precision (number of decimals, default: 2) */
  colorPrecision?: number;

  /** Offset precision (number of decimals, default: 2) */
  offsetPrecision?: number;
}

/**
 * Default configuration
 */
const DEFAULT_OPTIONS: Required<GradientOptimizerOptions> = {
  removeDuplicates: true,
  mergeIdentical: true,
  removeUnused: true,
  colorPrecision: 2,
  offsetPrecision: 2,
};

/**
 * Extract gradient ID from gradient definition
 */
function extractGradientId(gradientDef: string): string | null {
  const match = gradientDef.match(/id="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Check if gradient is used in the SVG
 */
function isGradientUsed(svgContent: string, gradientId: string): boolean {
  // Check for url(#gradient-id) references
  const urlPattern = new RegExp(`url\\(#${gradientId}\\)`, 'g');
  return urlPattern.test(svgContent);
}

/**
 * Remove duplicate stops from gradient
 */
function removeDuplicateStops(gradientContent: string): string {
  const stopRegex = /<stop([^>]*)\/?>(?:<\/stop>)?/g;
  const stops: string[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = stopRegex.exec(gradientContent)) !== null) {
    const stopTag = match[0];
    const normalized = stopTag.replace(/\s+/g, ' ').trim();

    if (!seen.has(normalized)) {
      seen.add(normalized);
      stops.push(stopTag);
    }
  }

  // Reconstruct gradient with unique stops
  const gradientWithoutStops = gradientContent.replace(stopRegex, '');
  const stopsString = stops.join('\n    ');

  // Insert stops back
  return gradientWithoutStops.replace(
    /(<(?:linear|radial)Gradient[^>]*>)/,
    `$1\n    ${stopsString}\n  `
  );
}

/**
 * Optimize stop colors and offsets
 */
function optimizeStopPrecision(
  gradientContent: string,
  colorPrecision: number,
  offsetPrecision: number
): string {
  return gradientContent.replace(/<stop([^>]*)>/g, (_match, attributes) => {
    let optimized = attributes;

    // Optimize offset precision
    optimized = optimized.replace(
      /offset="([0-9.]+)"/g,
      (_: string, offset: string) => {
        const num = parseFloat(offset);
        const rounded = num.toFixed(offsetPrecision);
        return `offset="${rounded}"`;
      }
    );

    // Optimize stop-opacity precision
    optimized = optimized.replace(
      /stop-opacity="([0-9.]+)"/g,
      (_: string, opacity: string) => {
        const num = parseFloat(opacity);
        const rounded = num.toFixed(colorPrecision);
        return `stop-opacity="${rounded}"`;
      }
    );

    return `<stop${optimized}>`;
  });
}

/**
 * Get gradient signature for comparison
 */
function getGradientSignature(gradientContent: string): string {
  // Remove ID and create normalized signature
  return gradientContent
    .replace(/id="[^"]+"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gradient Optimizer Plugin
 */
export const gradientOptimizerPlugin: EnhancedPlugin = {
  name: 'gradient-optimizer',
  version: '1.0.0',
  description:
    'Optimize SVG gradients by removing redundancy and merging identical definitions',
  author: 'svger-cli',

  hooks: {
    'after-parse': async (context: PluginHookContext) => {
      const options: Required<GradientOptimizerOptions> = {
        ...DEFAULT_OPTIONS,
        ...((context.metadata.get(
          'gradientOptimizerOptions'
        ) as GradientOptimizerOptions) || {}),
      };

      let content = context.content;
      let stopsRemoved = 0;
      let gradientsRemoved = 0;
      let gradientsMerged = 0;

      // Extract all gradients
      const gradientRegex = /<(linear|radial)Gradient[\s\S]*?<\/\1Gradient>/g;
      const gradients = content.match(gradientRegex) || [];

      if (gradients.length === 0) {
        return { content };
      }

      // 1. Remove duplicate stops
      if (options.removeDuplicates) {
        gradients.forEach(gradient => {
          const optimized = removeDuplicateStops(gradient);
          const originalStops = (gradient.match(/<stop/g) || []).length;
          const optimizedStops = (optimized.match(/<stop/g) || []).length;
          stopsRemoved += originalStops - optimizedStops;
          content = content.replace(gradient, optimized);
        });
      }

      // 2. Optimize precision
      if (options.colorPrecision > 0 || options.offsetPrecision > 0) {
        const updatedGradients = content.match(gradientRegex) || [];
        updatedGradients.forEach(gradient => {
          const optimized = optimizeStopPrecision(
            gradient,
            options.colorPrecision,
            options.offsetPrecision
          );
          content = content.replace(gradient, optimized);
        });
      }

      // 3. Merge identical gradients
      if (options.mergeIdentical) {
        const updatedGradients = content.match(gradientRegex) || [];
        const signatureMap = new Map<string, string>();

        updatedGradients.forEach(gradient => {
          const id = extractGradientId(gradient);
          if (!id) return;

          const signature = getGradientSignature(gradient);
          const existingId = signatureMap.get(signature);

          if (existingId && existingId !== id) {
            // Replace all references to this gradient with the existing one
            content = content.replace(
              new RegExp(`url\\(#${id}\\)`, 'g'),
              `url(#${existingId})`
            );
            // Remove the duplicate gradient
            content = content.replace(gradient, '');
            gradientsMerged++;
          } else {
            signatureMap.set(signature, id);
          }
        });
      }

      // 4. Remove unused gradients
      if (options.removeUnused) {
        const finalGradients = content.match(gradientRegex) || [];
        finalGradients.forEach(gradient => {
          const id = extractGradientId(gradient);
          if (id && !isGradientUsed(content, id)) {
            content = content.replace(gradient, '');
            gradientsRemoved++;
          }
        });
      }

      return {
        content,
        metadata: {
          gradientOptimizer: {
            stopsRemoved,
            gradientsRemoved,
            gradientsMerged,
            totalGradients: gradients.length,
          },
        },
      };
    },
  },

  validation: {
    enabled: true,
    maxDiffPercent: 2, // Gradients should look nearly identical
    options: {
      diff: {
        threshold: 0.1,
        includeAA: false,
      },
    },
  },

  configSchema: {
    removeDuplicates: { type: 'boolean', default: true },
    mergeIdentical: { type: 'boolean', default: true },
    removeUnused: { type: 'boolean', default: true },
    colorPrecision: { type: 'number', default: 2 },
    offsetPrecision: { type: 'number', default: 2 },
  },
};

export default gradientOptimizerPlugin;
