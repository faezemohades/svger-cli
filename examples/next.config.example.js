/**
 * Next.js Configuration Example with SVGER-CLI
 *
 * This example shows how to use SVGER-CLI with Next.js for automatic
 * SVG to component conversion with SSR support.
 */

const { withSvger } = require('svger-cli/nextjs');

/**
 * Method 1: Using withSvger wrapper (Recommended)
 */
module.exports = withSvger({
  // SVGER-CLI configuration
  svger: {
    source: './public/icons', // Source directory with SVG files
    output: './components/icons', // Output directory for components
    framework: 'react', // Always 'react' for Next.js
    typescript: true, // Generate TypeScript files
    hmr: true, // Enable Hot Module Replacement
    ssr: true, // Enable Server-Side Rendering support
    generateIndex: true, // Generate index.ts with all exports
  },

  // Standard Next.js configuration
  reactStrictMode: true,
  swcMinify: true,

  images: {
    domains: ['example.com'],
  },

  // Optional: Custom webpack configuration
  // webpack: (config, options) => {
  //   // Your custom webpack config here
  //   return config;
  // },
});

/**
 * Method 2: Manual webpack integration
 */
const { SvgerNextJsPlugin } = require('svger-cli/nextjs');

const manualConfig = {
  reactStrictMode: true,

  webpack(config, options) {
    // Add SVGER plugin
    config.plugins.push(
      new SvgerNextJsPlugin({
        source: './public/icons',
        output: './components/icons',
        framework: 'react',
        typescript: true,
      })
    );

    return config;
  },
};

// module.exports = manualConfig;

/**
 * Method 3: Using configureSvgImports helper
 */
const { configureSvgImports } = require('svger-cli/nextjs');

const helperConfig = {
  reactStrictMode: true,

  webpack(config, options) {
    // Configure SVG imports
    configureSvgImports(config, {
      framework: 'react',
      typescript: true,
    });

    return config;
  },
};

// module.exports = helperConfig;

/**
 * Usage in your Next.js pages/components:
 *
 * // pages/index.tsx
 * import { StarIcon, MenuIcon, LogoIcon } from '@/components/icons';
 * import type { NextPage } from 'next';
 *
 * const Home: NextPage = () => {
 *   return (
 *     <div>
 *       <LogoIcon width={100} height={100} />
 *       <StarIcon fill="gold" className="star" />
 *       <MenuIcon />
 *     </div>
 *   );
 * };
 *
 * export default Home;
 */

/**
 * App Router (Next.js 13+):
 *
 * // app/page.tsx
 * import { StarIcon } from '@/components/icons';
 *
 * export default function Page() {
 *   return (
 *     <main>
 *       <StarIcon width={24} height={24} />
 *     </main>
 *   );
 * }
 *
 * // The icons work seamlessly with Server Components!
 */

/**
 * TypeScript paths configuration (tsconfig.json):
 *
 * {
 *   "compilerOptions": {
 *     "paths": {
 *       "@/components/*": ["./components/*"]
 *     }
 *   }
 * }
 */
