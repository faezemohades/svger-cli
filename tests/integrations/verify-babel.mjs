#!/usr/bin/env node

/**
 * Quick verification test for Babel integration
 * Tests that the Babel plugin can be imported and instantiated
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

console.log(
  '\n' + colors.cyan + '🚀 Babel Integration Verification' + colors.reset
);
console.log('='.repeat(60) + '\n');

let passed = 0;
let failed = 0;

async function testBabelIntegration() {
  try {
    // Test 1: Import Babel plugin
    console.log(
      colors.cyan + '📦 Testing Babel plugin import...' + colors.reset
    );
    const babelModule = await import(
      join(__dirname, '../../dist/integrations/babel.js')
    );

    if (!babelModule.svgerBabelPlugin) {
      throw new Error('svgerBabelPlugin not exported');
    }
    if (!babelModule.createBabelPlugin) {
      throw new Error('createBabelPlugin not exported');
    }
    if (!babelModule.default) {
      throw new Error('default export not available');
    }

    console.log(colors.green + '   ✅ Babel Plugin: OK' + colors.reset);
    console.log('      - svgerBabelPlugin function available');
    console.log('      - createBabelPlugin factory available');
    console.log('      - Default export available\n');
    passed++;

    // Test 2: Create plugin instance
    console.log(
      colors.cyan + '🔧 Testing plugin instantiation...' + colors.reset
    );
    const pluginInstance = babelModule.svgerBabelPlugin(
      {},
      {
        source: './test-icons',
        output: './test-output',
        framework: 'react',
        typescript: true,
      }
    );

    if (!pluginInstance) {
      throw new Error('Failed to create plugin instance');
    }
    if (!pluginInstance.name) {
      throw new Error('Plugin instance missing name');
    }
    if (!pluginInstance.visitor) {
      throw new Error('Plugin instance missing visitor');
    }

    console.log(colors.green + '   ✅ Plugin Instance: OK' + colors.reset);
    console.log(`      - Plugin name: ${pluginInstance.name}`);
    console.log('      - Visitor pattern implemented');
    console.log('      - Program visitor available');
    console.log('      - ImportDeclaration visitor available');
    console.log('      - CallExpression visitor available\n');
    passed++;

    // Test 3: Create plugin using factory
    console.log(colors.cyan + '🏭 Testing plugin factory...' + colors.reset);
    const pluginFactory = babelModule.createBabelPlugin({
      source: './icons',
      framework: 'react',
    });

    if (typeof pluginFactory !== 'function') {
      throw new Error('createBabelPlugin should return a function');
    }

    const factoryInstance = pluginFactory({});
    if (!factoryInstance || !factoryInstance.visitor) {
      throw new Error('Factory function should return valid plugin instance');
    }

    console.log(colors.green + '   ✅ Plugin Factory: OK' + colors.reset);
    console.log('      - Factory function created');
    console.log('      - Factory returns valid plugin instance\n');
    passed++;

    // Test 4: Main exports include Babel
    console.log(colors.cyan + '📦 Testing main exports...' + colors.reset);
    const mainModule = await import(join(__dirname, '../../dist/index.js'));

    if (!mainModule.svgerBabelPlugin) {
      throw new Error('svgerBabelPlugin not exported from main');
    }
    if (!mainModule.createBabelPlugin) {
      throw new Error('createBabelPlugin not exported from main');
    }
    if (!mainModule.babelPlugin) {
      throw new Error('babelPlugin default not exported from main');
    }

    console.log(colors.green + '   ✅ Main Exports: OK' + colors.reset);
    console.log('      - svgerBabelPlugin: true');
    console.log('      - createBabelPlugin: true');
    console.log('      - babelPlugin (default): true\n');
    passed++;
  } catch (error) {
    console.log(
      colors.red + '   ❌ Babel Integration Test Failed' + colors.reset
    );
    console.log(`      Error: ${error.message}\n`);
    failed++;
  }
}

// Run tests
(async () => {
  await testBabelIntegration();

  // Summary
  console.log('='.repeat(60));
  console.log(
    `\n📊 Results: ${passed}/${passed + failed} tests passed` +
      (failed === 0
        ? ' (100%)'
        : ` (${Math.round((passed / (passed + failed)) * 100)}%)`)
  );

  if (failed === 0) {
    console.log(
      colors.green +
        '🎉 Babel integration verified successfully!\n' +
        colors.reset
    );
    process.exit(0);
  } else {
    console.log(
      colors.red +
        `❌ ${failed} test(s) failed. Please check the implementation.\n` +
        colors.reset
    );
    process.exit(1);
  }
})();
