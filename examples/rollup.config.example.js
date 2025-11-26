/**
 * Rollup Configuration Example with SVGER-CLI
 *
 * This example shows how to use SVGER-CLI with Rollup for automatic
 * SVG to component conversion with tree-shaking support.
 */

import { svgerRollupPlugin } from 'svger-cli/rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.js',

  output: [
    {
      file: 'dist/bundle.js',
      format: 'iife',
      name: 'MyApp',
      sourcemap: true,
    },
    {
      file: 'dist/bundle.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],

  plugins: [
    // SVGER-CLI Rollup Plugin - Convert SVGs to components
    svgerRollupPlugin({
      source: './src/icons', // Source directory with SVG files
      output: './src/components/icons', // Output directory for components
      framework: 'react', // Framework: react, vue, svelte, etc.
      typescript: true, // Generate TypeScript files
      generateIndex: true, // Generate index.ts with all exports
      sourcemap: true, // Generate source maps

      // Optional: Export type
      exportType: 'default', // 'default' or 'named'

      // Optional: SVGO optimization
      svgo: true,
    }),

    // Resolve node modules
    resolve({
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    }),

    // Convert CommonJS modules to ES6
    commonjs(),

    // Transpile with Babel
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      presets: ['@babel/preset-env', '@babel/preset-react'],
    }),

    // Minify for production
    process.env.NODE_ENV === 'production' && terser(),
  ],

  external: ['react', 'react-dom'],
};

/**
 * Usage in your code:
 *
 * // Import from generated components
 * import { StarIcon, MenuIcon } from './components/icons';
 *
 * // Or import SVG directly (transformed by plugin)
 * import Logo from './assets/logo.svg';
 *
 * function App() {
 *   return (
 *     <div>
 *       <Logo width={50} height={50} />
 *       <StarIcon fill="gold" />
 *       <MenuIcon />
 *     </div>
 *   );
 * }
 */

/**
 * Library Build Configuration:
 *
 * For building a component library with icons:
 */
export const libraryConfig = {
  input: 'src/index.js',

  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named',
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
    },
  ],

  plugins: [
    svgerRollupPlugin({
      source: './src/icons',
      output: './src/components/icons',
      framework: 'react',
      typescript: true,
      generateIndex: true,
      exportType: 'named', // Better for libraries
    }),

    resolve(),
    commonjs(),
    babel({
      babelHelpers: 'runtime',
      exclude: 'node_modules/**',
    }),
  ],

  external: ['react', 'react-dom', '@babel/runtime'],
};
