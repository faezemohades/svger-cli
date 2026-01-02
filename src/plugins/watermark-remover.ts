/**
 * Example Plugin: Watermark Remover with Visual Validation
 * Demonstrates Phase 6.2 plugin system for content cleanup
 */

import type {
  EnhancedPlugin,
  PluginHookContext,
  PluginHookResult,
  WatermarkRemoverOptions,
} from '../types/plugin-system.js';

/**
 * Watermark Remover Plugin
 * Removes watermarks and unwanted elements while validating visual quality
 */
export const watermarkRemoverPlugin: EnhancedPlugin = {
  name: 'watermark-remover',
  version: '1.0.0',
  description: 'Remove watermarks and unwanted elements with visual validation',
  author: 'svger-cli',

  hooks: {
    'after-parse': async (
      context: PluginHookContext
    ): Promise<PluginHookResult> => {
      const options = context.metadata.get('pluginOptions') as
        | WatermarkRemoverOptions
        | undefined;

      if (!options) {
        return { content: context.content };
      }

      let modifiedContent = context.content;
      let removedCount = 0;

      // Remove elements by ID
      if (options.elementIds && options.elementIds.length > 0) {
        for (const id of options.elementIds) {
          const idRegex = new RegExp(
            `<[^>]+id=["']${escapeRegex(id)}["'][^>]*>.*?</[^>]+>`,
            'gs'
          );
          const beforeLength = modifiedContent.length;
          modifiedContent = modifiedContent.replace(idRegex, '');

          if (modifiedContent.length < beforeLength) {
            removedCount++;
          }
        }
      }

      // Remove text elements matching patterns
      if (options.textPatterns && options.textPatterns.length > 0) {
        for (const pattern of options.textPatterns) {
          const textRegex = new RegExp(
            `<text[^>]*>[^<]*${escapeRegex(pattern)}[^<]*</text>`,
            'gi'
          );
          const beforeLength = modifiedContent.length;
          modifiedContent = modifiedContent.replace(textRegex, '');

          if (modifiedContent.length < beforeLength) {
            removedCount++;
          }
        }
      }

      // Remove hidden elements
      if (options.removeHidden) {
        // Remove elements with display:none
        modifiedContent = modifiedContent.replace(
          /<[^>]+display\s*:\s*none[^>]*>.*?<\/[^>]+>/gs,
          ''
        );

        // Remove elements with opacity:0
        modifiedContent = modifiedContent.replace(
          /<[^>]+opacity\s*:\s*0[^>]*>.*?<\/[^>]+>/gs,
          ''
        );

        // Remove elements with visibility:hidden
        modifiedContent = modifiedContent.replace(
          /<[^>]+visibility\s*:\s*hidden[^>]*>.*?<\/[^>]+>/gs,
          ''
        );
      }

      return {
        content: modifiedContent,
        metadata: {
          elementsRemoved: removedCount,
        },
      };
    },
  },

  // Visual validation ensures we don't accidentally remove visible content
  validation: {
    enabled: true,
    maxDiffPercent: 5, // Allow up to 5% visual difference (watermark removal)
    options: {
      diff: {
        threshold: 0.1,
        includeAA: false,
      },
    },
  },

  configSchema: {
    elementIds: {
      type: 'array',
      required: false,
      description: 'Element IDs to remove',
    },
    textPatterns: {
      type: 'array',
      required: false,
      description: 'Text patterns to match and remove',
    },
    removeHidden: {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Remove hidden elements (display:none, opacity:0, etc.)',
    },
  },

  validate(options?: any): boolean | { valid: boolean; errors: string[] } {
    if (!options) {
      return { valid: false, errors: ['Options are required'] };
    }

    // At least one removal method must be specified
    if (!options.elementIds && !options.textPatterns && !options.removeHidden) {
      return {
        valid: false,
        errors: [
          'At least one removal method must be specified (elementIds, textPatterns, or removeHidden)',
        ],
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
 * import { watermarkRemoverPlugin } from './plugins/watermark-remover.js';
 *
 * // Register plugin
 * await enhancedPluginManager.registerPlugin(watermarkRemoverPlugin);
 *
 * // Enable with options
 * enhancedPluginManager.enablePlugin('watermark-remover', {
 *   textPatterns: ['watermark', 'copyright', 'shutterstock'],
 *   elementIds: ['watermark-layer', 'branding'],
 *   removeHidden: true,
 * });
 *
 * // Process SVG - plugin will remove watermarks and validate visual quality
 * const result = await enhancedPluginManager.processWithHooks(
 *   svgContent,
 *   config
 * );
 */
