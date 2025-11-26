/**
 * Webpack Configuration Example with SVGER-CLI
 *
 * This example shows how to use SVGER-CLI with Webpack for automatic
 * SVG to component conversion with HMR support.
 */

const path = require('path');
const { SvgerWebpackPlugin } = require('svger-cli/webpack');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      // SVGER-CLI Loader - Transform SVG imports inline
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'svger-cli/webpack-loader',
            options: {
              framework: 'react',
              typescript: false, // Set to true if using TypeScript
            },
          },
        ],
      },
    ],
  },

  plugins: [
    // SVGER-CLI Plugin - Batch convert SVGs at build time
    new SvgerWebpackPlugin({
      source: './src/icons', // Source directory with SVG files
      output: './src/components/icons', // Output directory for components
      framework: 'react', // Framework: react, vue, angular, etc.
      typescript: false, // Generate TypeScript files
      hmr: true, // Enable Hot Module Replacement
      generateIndex: true, // Generate index.js with all exports
      watch: {
        debounce: 300, // Debounce delay for file changes
      },
    }),
  ],

  devServer: {
    port: 3000,
    hot: true,
    static: {
      directory: path.join(__dirname, 'public'),
    },
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
};

/**
 * Usage in your code:
 *
 * // Import from generated components
 * import { StarIcon, MenuIcon } from './components/icons';
 *
 * // Or import SVG directly (transformed by loader)
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
