/**
 * Example Plugin: Color Replacer with Visual Validation
 * Demonstrates Phase 6.2 plugin system with pipeline hooks
 */

import type {
  EnhancedPlugin,
  PluginHookContext,
  PluginHookResult,
  ColorReplacerOptions,
} from '../types/plugin-system.js';

/**
 * Color Replacer Plugin
 * Replaces specified colors in SVG while ensuring visual quality
 */
export const colorReplacerPlugin: EnhancedPlugin = {
  name: 'color-replacer',
  version: '1.0.0',
  description: 'Replace colors in SVG with visual validation',
  author: 'svger-cli',

  hooks: {
    'after-parse': async (
      context: PluginHookContext
    ): Promise<PluginHookResult> => {
      const options = context.metadata.get('pluginOptions') as
        | ColorReplacerOptions
        | undefined;

      if (!options || !options.colors) {
        return { content: context.content };
      }

      let modifiedContent = context.content;

      // Replace colors
      for (const [oldColor, newColor] of Object.entries(options.colors)) {
        // Replace in fill attributes
        const fillRegex = new RegExp(
          `fill=["']${escapeRegex(oldColor)}["']`,
          options.caseSensitive ? 'g' : 'gi'
        );
        modifiedContent = modifiedContent.replace(
          fillRegex,
          `fill="${newColor}"`
        );

        // Replace in stroke attributes
        const strokeRegex = new RegExp(
          `stroke=["']${escapeRegex(oldColor)}["']`,
          options.caseSensitive ? 'g' : 'gi'
        );
        modifiedContent = modifiedContent.replace(
          strokeRegex,
          `stroke="${newColor}"`
        );

        // Replace in style attributes if enabled
        if (options.includeStyles) {
          const styleRegex = new RegExp(
            `(fill|stroke):\\s*${escapeRegex(oldColor)}`,
            options.caseSensitive ? 'g' : 'gi'
          );
          modifiedContent = modifiedContent.replace(
            styleRegex,
            `$1:${newColor}`
          );
        }
      }

      return {
        content: modifiedContent,
        metadata: {
          colorsReplaced: Object.keys(options.colors).length,
        },
      };
    },
  },

  // Enable visual validation - colors should change but structure stays the same
  validation: {
    enabled: true,
    maxDiffPercent: 100, // Allow 100% color change, but structure must be identical
    options: {
      diff: {
        threshold: 0.1, // Strict threshold for structural changes
        includeAA: false,
      },
    },
  },

  configSchema: {
    colors: {
      type: 'object',
      required: true,
      description: 'Color mapping (old color → new color)',
    },
    includeStyles: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Whether to replace colors in style attributes',
    },
    caseSensitive: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Case-sensitive color matching',
    },
  },

  validate(options?: any): boolean | { valid: boolean; errors: string[] } {
    if (!options) {
      return { valid: false, errors: ['Options are required'] };
    }

    if (!options.colors || typeof options.colors !== 'object') {
      return {
        valid: false,
        errors: ['colors property is required and must be an object'],
      };
    }

    if (Object.keys(options.colors).length === 0) {
      return {
        valid: false,
        errors: ['At least one color mapping is required'],
      };
    }

    return { valid: true, errors: [] };
  },
};

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Example usage:
 *
 * import { enhancedPluginManager } from './core/enhanced-plugin-manager.js';
 * import { colorReplacerPlugin } from './plugins/color-replacer.js';
 *
 * // Register plugin
 * await enhancedPluginManager.registerPlugin(colorReplacerPlugin);
 *
 * // Enable with options
 * enhancedPluginManager.enablePlugin('color-replacer', {
 *   colors: {
 *     '#ff0000': '#00ff00',  // Red → Green
 *     '#0000ff': '#ffff00',  // Blue → Yellow
 *   },
 *   includeStyles: true,
 * });
 *
 * // Process SVG through pipeline with visual validation
 * const result = await enhancedPluginManager.processWithHooks(
 *   svgContent,
 *   config
 * );
 *
 * // Check validation results
 * if (result.validationResults.some(v => !v.validationPassed)) {
 *   console.error('Visual validation failed!');
 * }
 */
