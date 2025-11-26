/**
 * Official Next.js Plugin for SVGER-CLI
 *
 * Automatically converts SVG files to framework components in Next.js applications
 * with full SSR support, HMR, and webpack integration.
 *
 * @example
 * ```js
 * // next.config.js
 * const { withSvger } = require('svger-cli/nextjs');
 *
 * module.exports = withSvger({
 *   svger: {
 *     source: './src/icons',
 *     output: './src/components/icons',
 *     framework: 'react',
 *     typescript: true
 *   },
 *   // ... other Next.js config
 * });
 * ```
 */

import { SvgerWebpackPlugin } from './webpack.js';
import type { NextJsPluginOptions } from '../types/integrations.js';
import { logger } from '../core/logger.js';

/**
 * Next.js plugin configuration wrapper
 */
export function withSvger(nextConfig: any = {}) {
  return {
    ...nextConfig,
    webpack(config: any, options: any) {
      const { isServer } = options;

      // Get svger options from Next.js config
      const svgerOptions: NextJsPluginOptions = nextConfig.svger || {};

      // Add SVGER webpack plugin
      if (!config.plugins) {
        config.plugins = [];
      }

      // Only run on client build or if explicitly enabled for SSR
      if (!isServer || svgerOptions.ssr !== false) {
        const pluginInstance = new SvgerWebpackPlugin({
          source: svgerOptions.source,
          output: svgerOptions.output,
          framework: svgerOptions.framework || 'react',
          typescript: svgerOptions.typescript,
          config: svgerOptions.config,
          include: svgerOptions.include,
          exclude: svgerOptions.exclude,
          hmr: svgerOptions.hmr,
          generateIndex: svgerOptions.generateIndex,
        });

        config.plugins.push(pluginInstance);

        if (!isServer) {
          logger.info('SVGER Next.js Plugin: Configured for client build');
        } else {
          logger.info('SVGER Next.js Plugin: Configured for server build');
        }
      }

      // Add SVG file handling rule
      config.module.rules.push({
        test: /\.svg$/,
        issuer: /\.[jt]sx?$/,
        use: [
          {
            loader: 'svger-cli/webpack-loader',
            options: {
              framework: svgerOptions.framework || 'react',
              typescript: svgerOptions.typescript,
            },
          },
        ],
      });

      // Call user's custom webpack config if provided
      if (svgerOptions.webpack && typeof svgerOptions.webpack === 'function') {
        return svgerOptions.webpack(config, options);
      }

      // Call original webpack config if provided
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }

      return config;
    },
  };
}

/**
 * Standalone Next.js webpack plugin
 * Can be used directly in next.config.js webpack function
 */
export class SvgerNextJsPlugin extends SvgerWebpackPlugin {
  constructor(options: NextJsPluginOptions = {}) {
    super({
      source: options.source,
      output: options.output,
      framework: options.framework || 'react',
      typescript: options.typescript,
      config: options.config,
      include: options.include,
      exclude: options.exclude,
      hmr: options.hmr,
      generateIndex: options.generateIndex,
    });
  }
}

/**
 * Helper function to configure SVG imports in Next.js
 * For use in next.config.js
 *
 * @example
 * ```js
 * const { configureSvgImports } = require('svger-cli/nextjs');
 *
 * module.exports = {
 *   webpack(config, options) {
 *     configureSvgImports(config, {
 *       framework: 'react',
 *       typescript: true
 *     });
 *     return config;
 *   }
 * };
 * ```
 */
export function configureSvgImports(
  webpackConfig: any,
  options: Partial<NextJsPluginOptions> = {}
): void {
  webpackConfig.module.rules.push({
    test: /\.svg$/,
    issuer: /\.[jt]sx?$/,
    use: [
      {
        loader: 'svger-cli/webpack-loader',
        options: {
          framework: options.framework || 'react',
          typescript:
            options.typescript !== undefined ? options.typescript : true,
        },
      },
    ],
  });
}

// Default export
export default withSvger;
