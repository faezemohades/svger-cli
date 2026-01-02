/**
 * Stroke Normalizer Plugin
 * Normalizes stroke widths and optimizes stroke definitions
 *
 * Features:
 * - Normalize stroke widths to standard values
 * - Remove default stroke attributes
 * - Optimize stroke-dasharray values
 * - Round stroke width precision
 *
 * Visual tolerance: 1% (strokes should look nearly identical)
 */

import type {
  EnhancedPlugin,
  PluginHookContext,
} from '../types/plugin-system.js';

/**
 * Configuration for stroke normalizer
 */
export interface StrokeNormalizerOptions {
  /** Normalize widths to nearest standard value (default: true) */
  normalizeWidths?: boolean;

  /** Standard width values to normalize to (default: [0.5, 1, 1.5, 2, 3, 4, 5]) */
  standardWidths?: number[];

  /** Remove default stroke values (default: true) */
  removeDefaults?: boolean;

  /** Width precision (number of decimals, default: 2) */
  widthPrecision?: number;

  /** Optimize dash arrays (default: true) */
  optimizeDashArrays?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_OPTIONS: Required<StrokeNormalizerOptions> = {
  normalizeWidths: true,
  standardWidths: [0.5, 1, 1.5, 2, 3, 4, 5],
  removeDefaults: true,
  widthPrecision: 2,
  optimizeDashArrays: true,
};

/**
 * Find nearest standard width
 */
function findNearestWidth(width: number, standards: number[]): number {
  return standards.reduce((nearest, standard) =>
    Math.abs(standard - width) < Math.abs(nearest - width) ? standard : nearest
  );
}

/**
 * Normalize stroke width
 */
function normalizeStrokeWidth(
  content: string,
  standards: number[],
  precision: number
): string {
  return content.replace(/stroke-width="([0-9.]+)"/g, (_match, width) => {
    const num = parseFloat(width);
    const nearest = findNearestWidth(num, standards);
    const rounded = nearest.toFixed(precision);
    return `stroke-width="${rounded}"`;
  });
}

/**
 * Remove default stroke attributes
 */
function removeDefaultStrokes(content: string): string {
  // Remove stroke="none" (default for most elements)
  let result = content.replace(/\s+stroke="none"/g, '');

  // Remove stroke-width="1" (default)
  result = result.replace(/\s+stroke-width="1(?:\.0+)?"/g, '');

  // Remove stroke-linecap="butt" (default)
  result = result.replace(/\s+stroke-linecap="butt"/g, '');

  // Remove stroke-linejoin="miter" (default)
  result = result.replace(/\s+stroke-linejoin="miter"/g, '');

  // Remove stroke-miterlimit="4" (default)
  result = result.replace(/\s+stroke-miterlimit="4(?:\.0+)?"/g, '');

  return result;
}

/**
 * Optimize dash arrays
 */
function optimizeDashArrays(content: string): string {
  return content.replace(
    /stroke-dasharray="([^"]+)"/g,
    (_match, dasharray: string) => {
      // Parse dash array
      const values = dasharray
        .split(/[\s,]+/)
        .map((v: string) => parseFloat(v))
        .filter((v: number) => !isNaN(v));

      if (values.length === 0) {
        return ''; // Remove empty dash arrays
      }

      // Round values to 2 decimals
      const rounded = values.map((v: number) => {
        const str = v.toFixed(2);
        // Remove trailing zeros: 1.50 → 1.5, 1.00 → 1
        return str.replace(/\.?0+$/, '');
      });

      // If all values are the same, reduce to single value
      if (rounded.every((v: string) => v === rounded[0])) {
        return `stroke-dasharray="${rounded[0]}"`;
      }

      return `stroke-dasharray="${rounded.join(' ')}"`;
    }
  );
}

/**
 * Stroke Normalizer Plugin
 */
export const strokeNormalizerPlugin: EnhancedPlugin = {
  name: 'stroke-normalizer',
  version: '1.0.0',
  description:
    'Normalize stroke widths and optimize stroke definitions for consistency',
  author: 'svger-cli',

  hooks: {
    'after-parse': async (context: PluginHookContext) => {
      const options: Required<StrokeNormalizerOptions> = {
        ...DEFAULT_OPTIONS,
        ...((context.metadata.get(
          'strokeNormalizerOptions'
        ) as StrokeNormalizerOptions) || {}),
      };

      let content = context.content;
      let widthsNormalized = 0;
      let defaultsRemoved = 0;
      let dashArraysOptimized = 0;

      // Count original stroke-width attributes
      const originalWidths = (content.match(/stroke-width="/g) || []).length;

      // 1. Normalize stroke widths
      if (options.normalizeWidths) {
        content = normalizeStrokeWidth(
          content,
          options.standardWidths,
          options.widthPrecision
        );
        widthsNormalized = originalWidths;
      }

      // Count original defaults
      const originalDefaults =
        (content.match(/stroke="none"/g) || []).length +
        (content.match(/stroke-width="1"/g) || []).length +
        (content.match(/stroke-linecap="butt"/g) || []).length +
        (content.match(/stroke-linejoin="miter"/g) || []).length +
        (content.match(/stroke-miterlimit="4"/g) || []).length;

      // 2. Remove default attributes
      if (options.removeDefaults) {
        content = removeDefaultStrokes(content);

        // Count removed defaults
        const remainingDefaults =
          (content.match(/stroke="none"/g) || []).length +
          (content.match(/stroke-width="1"/g) || []).length +
          (content.match(/stroke-linecap="butt"/g) || []).length +
          (content.match(/stroke-linejoin="miter"/g) || []).length +
          (content.match(/stroke-miterlimit="4"/g) || []).length;

        defaultsRemoved = originalDefaults - remainingDefaults;
      }

      // Count original dash arrays
      const originalDashArrays = (content.match(/stroke-dasharray="/g) || [])
        .length;

      // 3. Optimize dash arrays
      if (options.optimizeDashArrays) {
        content = optimizeDashArrays(content);

        // Some dash arrays may be removed if empty
        const remainingDashArrays = (content.match(/stroke-dasharray="/g) || [])
          .length;
        dashArraysOptimized = originalDashArrays - remainingDashArrays;
      }

      return {
        content,
        metadata: {
          strokeNormalizer: {
            widthsNormalized,
            defaultsRemoved,
            dashArraysOptimized,
            totalStrokes: originalWidths,
          },
        },
      };
    },
  },

  validation: {
    enabled: true,
    maxDiffPercent: 1, // Strokes should look nearly identical
    options: {
      diff: {
        threshold: 0.1,
        includeAA: false,
      },
    },
  },

  configSchema: {
    normalizeWidths: { type: 'boolean', default: true },
    standardWidths: { type: 'array', default: [0.5, 1, 1.5, 2, 3, 4, 5] },
    removeDefaults: { type: 'boolean', default: true },
    widthPrecision: { type: 'number', default: 2 },
    optimizeDashArrays: { type: 'boolean', default: true },
  },
};

export default strokeNormalizerPlugin;
