/**
 * Vite Configuration Example with SVGER-CLI
 *
 * This example shows how to use SVGER-CLI with Vite for automatic
 * SVG to component conversion with HMR and virtual modules.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { svgerVitePlugin } from 'svger-cli/vite';

export default defineConfig({
  plugins: [
    react(),

    // SVGER-CLI Vite Plugin
    svgerVitePlugin({
      source: './src/icons', // Source directory with SVG files
      output: './src/components/icons', // Output directory for components
      framework: 'react', // Framework: react, vue, svelte, etc.
      typescript: true, // Generate TypeScript files
      hmr: true, // Enable Hot Module Replacement
      generateIndex: true, // Generate index.ts with all exports

      // Optional: Use virtual modules (experimental)
      virtual: false,

      // Optional: Export type
      exportType: 'default', // 'default' or 'named'

      // Optional: SVGO optimization
      svgo: false,
    }),
  ],

  server: {
    port: 3000,
    open: true,
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

/**
 * Usage in your code (React example):
 *
 * // Import from generated components
 * import { StarIcon, MenuIcon, HomeIcon } from './components/icons';
 *
 * // Or import SVG directly (transformed by plugin)
 * import Logo from './assets/logo.svg';
 *
 * function App() {
 *   return (
 *     <div>
 *       <Logo width={50} height={50} fill="currentColor" />
 *       <StarIcon width={24} height={24} fill="gold" />
 *       <MenuIcon className="menu-icon" />
 *       <HomeIcon />
 *     </div>
 *   );
 * }
 *
 * // With virtual modules (if enabled)
 * import StarIcon from 'virtual:svger/star-icon';
 */

/**
 * Usage with Vue:
 *
 * // vite.config.js
 * import vue from '@vitejs/plugin-vue';
 * import { svgerVitePlugin } from 'svger-cli/vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     vue(),
 *     svgerVitePlugin({
 *       framework: 'vue',
 *       typescript: true,
 *     }),
 *   ],
 * });
 *
 * // In your Vue component
 * <template>
 *   <div>
 *     <StarIcon :width="24" :height="24" fill="gold" />
 *   </div>
 * </template>
 *
 * <script setup>
 * import { StarIcon } from './components/icons';
 * </script>
 */
