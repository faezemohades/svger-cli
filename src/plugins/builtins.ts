import type { EnhancedPlugin } from '../types/plugin-system.js';
import { svgProcessor } from '../processors/svg-processor.js';
import type { EnhancedPluginManager } from '../core/enhanced-plugin-manager.js';

const optimizePlugin: EnhancedPlugin = {
  name: 'optimize',
  version: '1.0.0',
  description: 'Advanced SVG optimization and cleaning',
  hooks: {
    'after-parse': async context => ({
      content: await svgProcessor.cleanSVGContent(context.content),
    }),
  },
};

const colorThemePlugin: EnhancedPlugin = {
  name: 'color-theme',
  version: '1.0.0',
  description: 'Apply color themes and palette transformations',
  hooks: {
    'after-parse': async context => {
      const theme = context.metadata.get('theme');
      if (!theme || typeof theme !== 'object') {
        return { content: context.content };
      }

      let content = context.content;
      for (const [from, to] of Object.entries(
        theme as Record<string, string>
      )) {
        const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedFrom, 'g');
        content = content.replace(regex, to);
      }

      return { content };
    },
  },
};

const minifyPlugin: EnhancedPlugin = {
  name: 'minify',
  version: '1.0.0',
  description: 'Aggressive size reduction for production',
  hooks: {
    'after-parse': async context => ({
      content: context.content
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    }),
  },
};

export const builtInPlugins: EnhancedPlugin[] = [
  optimizePlugin,
  colorThemePlugin,
  minifyPlugin,
];

export function registerBuiltInPlugins(manager: EnhancedPluginManager): void {
  for (const plugin of builtInPlugins) {
    if (!manager.hasPlugin(plugin.name)) {
      manager.registerPlugin(plugin, { activate: false });
    }
  }
}
