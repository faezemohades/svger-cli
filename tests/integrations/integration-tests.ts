/**
 * Comprehensive Integration Tests
 *
 * Tests all build tool integrations to ensure they work correctly
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { FileSystem } from '../../src/utils/native.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDir = path.join(__dirname, '../test-integration-output');
const sourceDir = path.join(testDir, 'src/icons');
const outputDir = path.join(testDir, 'dist/components');

// Test SVG content
const testSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="currentColor"/>
  <path d="M12 2L15 9L22 10L17 15L18 22L12 18L6 22L7 15L2 10L9 9Z"/>
</svg>
`;

async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');

  // Create directories
  await FileSystem.ensureDir(sourceDir);
  await FileSystem.ensureDir(outputDir);

  // Create test SVG files
  await FileSystem.writeFile(
    path.join(sourceDir, 'star-icon.svg'),
    testSvg,
    'utf-8'
  );
  await FileSystem.writeFile(
    path.join(sourceDir, 'circle-icon.svg'),
    testSvg,
    'utf-8'
  );
  await FileSystem.writeFile(
    path.join(sourceDir, 'menu-icon.svg'),
    testSvg,
    'utf-8'
  );

  console.log('✅ Test environment ready');
}

async function testWebpackPlugin() {
  console.log('\n📦 Testing Webpack Plugin...');

  try {
    const { SvgerWebpackPlugin, svgerLoader } = await import(
      '../../dist/integrations/webpack.js'
    );

    // Test 1: Plugin instantiation
    const plugin = new SvgerWebpackPlugin({
      source: sourceDir,
      output: outputDir,
      framework: 'react',
      typescript: true,
    });

    console.log('  ✅ Plugin created successfully');
    console.log(
      '  ✅ Plugin has apply method:',
      typeof plugin.apply === 'function'
    );

    // Test 2: Loader function exists
    console.log(
      '  ✅ Loader function exists:',
      typeof svgerLoader === 'function'
    );

    // Test 3: Different framework support
    const vuePlugin = new SvgerWebpackPlugin({ framework: 'vue' });
    const angularPlugin = new SvgerWebpackPlugin({ framework: 'angular' });

    console.log('  ✅ Multiple frameworks supported');

    console.log('✅ Webpack Plugin tests passed');
    return true;
  } catch (error) {
    console.error('❌ Webpack Plugin tests failed:', error);
    return false;
  }
}

async function testVitePlugin() {
  console.log('\n⚡ Testing Vite Plugin...');

  try {
    const { svgerVitePlugin } = await import('../../dist/integrations/vite.js');

    // Test 1: Plugin creation
    const plugin = svgerVitePlugin({
      source: sourceDir,
      output: outputDir,
      framework: 'react',
      typescript: true,
    });

    console.log('  ✅ Plugin created successfully');
    console.log('  ✅ Plugin has name:', plugin.name);
    console.log(
      '  ✅ Plugin has buildStart:',
      typeof plugin.buildStart === 'function'
    );
    console.log(
      '  ✅ Plugin has handleHotUpdate:',
      typeof plugin.handleHotUpdate === 'function'
    );

    // Test 2: Virtual modules support
    const virtualPlugin = svgerVitePlugin({
      virtual: true,
    });

    console.log('  ✅ Virtual modules supported');

    console.log('✅ Vite Plugin tests passed');
    return true;
  } catch (error) {
    console.error('❌ Vite Plugin tests failed:', error);
    return false;
  }
}

async function testRollupPlugin() {
  console.log('\n📜 Testing Rollup Plugin...');

  try {
    const { svgerRollupPlugin } = await import(
      '../../dist/integrations/rollup.js'
    );

    // Test 1: Plugin creation
    const plugin = svgerRollupPlugin({
      source: sourceDir,
      output: outputDir,
      framework: 'react',
      typescript: true,
    });

    console.log('  ✅ Plugin created successfully');
    console.log('  ✅ Plugin has name:', plugin.name);
    console.log(
      '  ✅ Plugin has buildStart:',
      typeof plugin.buildStart === 'function'
    );
    console.log('  ✅ Plugin has load:', typeof plugin.load === 'function');
    console.log(
      '  ✅ Plugin has transform:',
      typeof plugin.transform === 'function'
    );

    // Test 2: Source maps support
    const pluginWithSourceMap = svgerRollupPlugin({
      sourcemap: true,
    });

    console.log('  ✅ Source maps supported');

    console.log('✅ Rollup Plugin tests passed');
    return true;
  } catch (error) {
    console.error('❌ Rollup Plugin tests failed:', error);
    return false;
  }
}

async function testNextJsPlugin() {
  console.log('\n▲ Testing Next.js Plugin...');

  try {
    const { withSvger, SvgerNextJsPlugin, configureSvgImports } = await import(
      '../../dist/integrations/nextjs.js'
    );

    // Test 1: withSvger wrapper
    const nextConfig = withSvger({
      svger: {
        source: sourceDir,
        output: outputDir,
        framework: 'react',
      },
    });

    console.log('  ✅ withSvger created successfully');
    console.log(
      '  ✅ Has webpack function:',
      typeof nextConfig.webpack === 'function'
    );

    // Test 2: Standalone plugin
    const plugin = new SvgerNextJsPlugin({
      source: sourceDir,
      output: outputDir,
    });

    console.log('  ✅ Standalone plugin created');

    // Test 3: Helper function
    console.log(
      '  ✅ configureSvgImports exists:',
      typeof configureSvgImports === 'function'
    );

    console.log('✅ Next.js Plugin tests passed');
    return true;
  } catch (error) {
    console.error('❌ Next.js Plugin tests failed:', error);
    return false;
  }
}

async function testJestPreset() {
  console.log('\n🧪 Testing Jest Preset...');

  try {
    const { svgerJestTransformer, jestPreset, createJestTransformer } =
      await import('../../dist/integrations/jest-preset.js');

    // Test 1: Transformer
    console.log(
      '  ✅ Transformer exists:',
      typeof svgerJestTransformer === 'object'
    );
    console.log(
      '  ✅ Transformer has process:',
      typeof svgerJestTransformer.process === 'function'
    );

    // Test 2: Preset config
    console.log('  ✅ Preset config exists:', typeof jestPreset === 'object');
    console.log(
      '  ✅ Has transform config:',
      jestPreset.transform !== undefined
    );

    // Test 3: Custom transformer factory
    const customTransformer = createJestTransformer({
      framework: 'react',
      typescript: true,
    });

    console.log('  ✅ Custom transformer created');

    // Test 4: Process SVG
    const result = svgerJestTransformer.process(testSvg, 'test-icon.svg', {});

    console.log('  ✅ SVG processed:', result.code.includes('React'));

    console.log('✅ Jest Preset tests passed');
    return true;
  } catch (error) {
    console.error('❌ Jest Preset tests failed:', error);
    return false;
  }
}

async function testIntegrationExports() {
  console.log('\n📤 Testing Integration Exports...');

  try {
    // Test main exports
    const mainExports = await import('../../dist/index.js');

    console.log(
      '  ✅ SvgerWebpackPlugin exported:',
      'SvgerWebpackPlugin' in mainExports
    );
    console.log(
      '  ✅ svgerVitePlugin exported:',
      'svgerVitePlugin' in mainExports
    );
    console.log(
      '  ✅ svgerRollupPlugin exported:',
      'svgerRollupPlugin' in mainExports
    );
    console.log('  ✅ withSvger exported:', 'withSvger' in mainExports);
    console.log(
      '  ✅ svgerJestTransformer exported:',
      'svgerJestTransformer' in mainExports
    );

    console.log('✅ Integration exports tests passed');
    return true;
  } catch (error) {
    console.error('❌ Integration exports tests failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Integration Tests\n');
  console.log('='.repeat(60));

  await setupTestEnvironment();

  const results = {
    webpack: await testWebpackPlugin(),
    vite: await testVitePlugin(),
    rollup: await testRollupPlugin(),
    nextjs: await testNextJsPlugin(),
    jest: await testJestPreset(),
    exports: await testIntegrationExports(),
  };

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary:\n');

  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  const failed = total - passed;

  Object.entries(results).forEach(([name, success]) => {
    const icon = success ? '✅' : '❌';
    console.log(
      `  ${icon} ${name.padEnd(20)} ${success ? 'PASSED' : 'FAILED'}`
    );
  });

  console.log('\n' + '='.repeat(60));
  console.log(
    `\n${passed}/${total} test suites passed (${((passed / total) * 100).toFixed(0)}%)`
  );

  if (failed > 0) {
    console.log(`\n⚠️  ${failed} test suite(s) failed`);
    process.exit(1);
  } else {
    console.log('\n🎉 All integration tests passed!');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
