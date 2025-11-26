/**
 * Quick Integration Verification
 *
 * Simple tests to verify all integrations are properly compiled and exported
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go up to project root
const projectRoot = path.resolve(__dirname, '../..');

console.log('🚀 Quick Integration Verification\n');
console.log('='.repeat(60));

async function verifyIntegrations() {
  const results = {};

  // Test 1: Webpack Plugin
  try {
    const webpackPath = path.join(projectRoot, 'dist/integrations/webpack.js');
    const { SvgerWebpackPlugin, svgerLoader } = await import(webpackPath);

    const plugin = new SvgerWebpackPlugin();
    console.log('✅ Webpack Plugin: OK');
    console.log('   - Plugin instance created');
    console.log('   - Loader function available');
    results.webpack = true;
  } catch (error) {
    console.log('❌ Webpack Plugin: FAILED');
    console.log('   Error:', error.message);
    results.webpack = false;
  }

  // Test 2: Vite Plugin
  try {
    const vitePath = path.join(projectRoot, 'dist/integrations/vite.js');
    const { svgerVitePlugin } = await import(vitePath);

    const plugin = svgerVitePlugin();
    console.log('\n✅ Vite Plugin: OK');
    console.log('   - Plugin created');
    console.log('   - Plugin name:', plugin.name);
    results.vite = true;
  } catch (error) {
    console.log('\n❌ Vite Plugin: FAILED');
    console.log('   Error:', error.message);
    results.vite = false;
  }

  // Test 4: Rollup Plugin
  try {
    const rollupPath = path.join(projectRoot, 'dist/integrations/rollup.js');
    const { svgerRollupPlugin } = await import(rollupPath);

    const plugin = svgerRollupPlugin();
    console.log('\n✅ Rollup Plugin: OK');
    console.log('   - Plugin created');
    console.log('   - Plugin name:', plugin.name);
    results.rollup = true;
  } catch (error) {
    console.log('\n❌ Rollup Plugin: FAILED');
    console.log('   Error:', error.message);
    results.rollup = false;
  }

  // Test 5: Babel Plugin
  try {
    const babelPath = path.join(projectRoot, 'dist/integrations/babel.js');
    const { svgerBabelPlugin, createBabelPlugin } = await import(babelPath);

    const plugin = svgerBabelPlugin(
      {},
      { source: './icons', framework: 'react' }
    );
    console.log('\n✅ Babel Plugin: OK');
    console.log('   - Plugin created');
    console.log('   - Plugin name:', plugin.name);
    console.log('   - Factory function available');
    results.babel = true;
  } catch (error) {
    console.log('\n❌ Babel Plugin: FAILED');
    console.log('   Error:', error.message);
    results.babel = false;
  }

  // Test 6: Next.js Plugin
  try {
    const nextjsPath = path.join(projectRoot, 'dist/integrations/nextjs.js');
    const { withSvger, SvgerNextJsPlugin } = await import(nextjsPath);

    const config = withSvger({});
    const plugin = new SvgerNextJsPlugin();
    console.log('\n✅ Next.js Plugin: OK');
    console.log('   - withSvger wrapper created');
    console.log('   - Standalone plugin created');
    results.nextjs = true;
  } catch (error) {
    console.log('\n❌ Next.js Plugin: FAILED');
    console.log('   Error:', error.message);
    results.nextjs = false;
  }

  // Test 7: Jest Preset
  try {
    const jestPath = path.join(projectRoot, 'dist/integrations/jest-preset.js');
    const { svgerJestTransformer, jestPreset } = await import(jestPath);

    console.log('\n✅ Jest Preset: OK');
    console.log('   - Transformer available');
    console.log('   - Preset config available');
    results.jest = true;
  } catch (error) {
    console.log('\n❌ Jest Preset: FAILED');
    console.log('   Error:', error.message);
    results.jest = false;
  }

  // Test 8: Main exports
  try {
    const mainPath = path.join(projectRoot, 'dist/index.js');
    const mainExports = await import(mainPath);

    const hasWebpack = 'SvgerWebpackPlugin' in mainExports;
    const hasVite = 'svgerVitePlugin' in mainExports;
    const hasRollup = 'svgerRollupPlugin' in mainExports;
    const hasBabel = 'svgerBabelPlugin' in mainExports;
    const hasNextJs = 'withSvger' in mainExports;
    const hasJest = 'svgerJestTransformer' in mainExports;

    console.log('\n✅ Main Exports: OK');
    console.log('   - SvgerWebpackPlugin:', hasWebpack);
    console.log('   - svgerVitePlugin:', hasVite);
    console.log('   - svgerRollupPlugin:', hasRollup);
    console.log('   - svgerBabelPlugin:', hasBabel);
    console.log('   - withSvger:', hasNextJs);
    console.log('   - svgerJestTransformer:', hasJest);

    results.exports =
      hasWebpack && hasVite && hasRollup && hasBabel && hasNextJs && hasJest;
  } catch (error) {
    console.log('\n❌ Main Exports: FAILED');
    console.log('   Error:', error.message);
    results.exports = false;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Results:\n');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([name, success]) => {
    console.log(
      `  ${success ? '✅' : '❌'} ${name.padEnd(15)} ${success ? 'PASSED' : 'FAILED'}`
    );
  });

  console.log('\n' + '='.repeat(60));
  console.log(
    `\n${passed}/${total} integrations verified (${Math.round((passed / total) * 100)}%)\n`
  );

  if (passed === total) {
    console.log('🎉 All integrations working correctly!\n');
    return true;
  } else {
    console.log(`⚠️  ${total - passed} integration(s) need attention\n`);
    return false;
  }
}

verifyIntegrations()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
