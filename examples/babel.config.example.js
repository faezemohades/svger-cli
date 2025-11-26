/**
 * Example Babel Configuration for SVGER-CLI
 *
 * This example shows how to use the SVGER Babel plugin to automatically
 * convert SVG files to framework components during transpilation.
 *
 * The plugin works with any Babel-based build process including:
 * - Standalone Babel
 * - Create React App
 * - Gatsby
 * - Any tool using Babel under the hood
 */

// Option 1: Using require (CommonJS)
const { svgerBabelPlugin } = require('svger-cli/babel');

module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  plugins: [
    // Add SVGER plugin with configuration
    [
      svgerBabelPlugin,
      {
        // Source directory containing SVG files
        source: './src/icons',

        // Output directory for generated components
        output: './src/components/icons',

        // Target framework
        framework: 'react',

        // Use TypeScript
        typescript: true,

        // Transform SVG imports to component imports
        // When enabled: import Icon from './icon.svg' -> import Icon from './components/icons/Icon'
        transformImports: true,

        // Process all SVGs when plugin is initialized
        // Recommended for production builds
        processOnInit: true,

        // Generate index file with all components
        generateIndex: true,

        // Glob patterns to include
        include: ['**/*.svg'],

        // Glob patterns to exclude
        exclude: ['node_modules/**'],
      },
    ],
  ],
};

// Option 2: Using ES Modules (in babel.config.mjs)
/*
import { svgerBabelPlugin } from 'svger-cli/babel';

export default {
  presets: [
    '@babel/preset-env',
    '@babel/preset-react'
  ],
  plugins: [
    [svgerBabelPlugin, {
      source: './src/icons',
      output: './src/components/icons',
      framework: 'react',
      typescript: true
    }]
  ]
};
*/

// Option 3: Create React App (babel-plugin-macros.config.js)
/*
const { createBabelPlugin } = require('svger-cli/babel');

module.exports = {
  svger: createBabelPlugin({
    source: './src/icons',
    output: './src/components/icons',
    framework: 'react'
  })
};
*/

// Option 4: Minimal configuration (uses defaults from .svgerconfig)
/*
module.exports = {
  presets: ['@babel/preset-react'],
  plugins: [
    // Simple usage - reads config from .svgerconfig
    require('svger-cli/babel').svgerBabelPlugin
  ]
};
*/

// Option 5: Vue.js example
/*
const { svgerBabelPlugin } = require('svger-cli/babel');

module.exports = {
  presets: ['@vue/cli-plugin-babel/preset'],
  plugins: [
    [svgerBabelPlugin, {
      source: './src/assets/icons',
      output: './src/components/icons',
      framework: 'vue',
      typescript: false
    }]
  ]
};
*/

// Option 6: Angular example
/*
const { svgerBabelPlugin } = require('svger-cli/babel');

module.exports = {
  presets: ['@babel/preset-typescript'],
  plugins: [
    [svgerBabelPlugin, {
      source: './src/assets/svg',
      output: './src/app/components/icons',
      framework: 'angular',
      typescript: true
    }]
  ]
};
*/

/**
 * Configuration Options Reference:
 *
 * @param {string} source - Source directory containing SVG files
 * @param {string} output - Output directory for generated components
 * @param {string} framework - Target framework (react, vue, angular, svelte, etc.)
 * @param {boolean} typescript - Generate TypeScript files (.tsx instead of .jsx)
 * @param {boolean} transformImports - Transform SVG imports to component imports
 * @param {boolean} processOnInit - Process all SVGs when plugin initializes
 * @param {boolean} generateIndex - Generate index.ts/js with all exports
 * @param {string|string[]} include - Glob patterns to include
 * @param {string|string[]} exclude - Glob patterns to exclude
 * @param {object} config - Advanced configuration (see .svgerconfig docs)
 *
 * Features:
 * - ✅ Automatic SVG to component conversion during build
 * - ✅ Import transformation (import Icon from './icon.svg')
 * - ✅ Dynamic import support (import('./icon.svg'))
 * - ✅ Framework-agnostic (React, Vue, Angular, Svelte, etc.)
 * - ✅ TypeScript support with type definitions
 * - ✅ Auto-generated barrel exports (index files)
 * - ✅ Watch mode compatible
 * - ✅ Works with Create React App, Gatsby, and more
 *
 * How it works:
 * 1. Plugin processes all SVGs in source directory on initialization
 * 2. Generates framework-specific components in output directory
 * 3. Transforms SVG imports in your code to component imports
 * 4. Creates index file with all component exports
 *
 * Usage in your code:
 * ```jsx
 * // Before (with transformImports: true)
 * import HomeIcon from './assets/home.svg';
 *
 * // After transformation (automatic)
 * import HomeIcon from './components/icons/HomeIcon';
 *
 * // Use the component
 * function App() {
 *   return <HomeIcon width={24} height={24} />;
 * }
 * ```
 */
