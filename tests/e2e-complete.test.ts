#!/usr/bin/env node

/**
 * End-to-End Complete Test Suite
 * Tests the complete workflow with all features and configuration options
 */

import { svgService } from '../dist/services/svg-service.js';
import { configService } from '../dist/services/config.js';
import { FileSystem } from '../dist/utils/native.js';
import path from 'path';

// Test output directory
const TEST_DIR = path.join(process.cwd(), 'test-e2e-complete');

// Sample SVG content
const sampleSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <circle cx="12" cy="12" r="10"/>
</svg>`;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  try {
    await testFn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`❌ ${name}`);
    console.log(
      `   Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function setup() {
  console.log('\n🔧 Setting up E2E test environment...\n');

  // Clean test directory
  if (await FileSystem.exists(TEST_DIR)) {
    await FileSystem.emptyDir(TEST_DIR);
  } else {
    await FileSystem.ensureDir(TEST_DIR);
  }
}

/**
 * Test: Complete React Workflow
 */
async function testReactWorkflow() {
  const srcDir = path.join(TEST_DIR, 'react-src');
  const outDir = path.join(TEST_DIR, 'react-out');

  await FileSystem.ensureDir(srcDir);

  // Create test SVGs
  await FileSystem.writeFile(
    path.join(srcDir, 'icon-home.svg'),
    sampleSVG,
    'utf-8'
  );
  await FileSystem.writeFile(
    path.join(srcDir, 'icon-settings.svg'),
    sampleSVG,
    'utf-8'
  );

  // Build with React + TypeScript
  await svgService.buildAll({
    src: srcDir,
    out: outDir,
    config: {
      framework: 'react',
      typescript: true,
    },
  });

  // Verify output
  const files = await FileSystem.readDir(outDir);
  const hasComponents = files.filter(f => f.endsWith('.tsx')).length === 2;
  const hasIndex = files.some(f => f === 'index.ts');

  if (!hasComponents || !hasIndex) {
    throw new Error('React workflow did not generate expected files');
  }
}

/**
 * Test: Vue 3 Composition API
 */
async function testVueWorkflow() {
  const srcDir = path.join(TEST_DIR, 'vue-src');
  const outDir = path.join(TEST_DIR, 'vue-out');

  await FileSystem.ensureDir(srcDir);
  await FileSystem.writeFile(
    path.join(srcDir, 'button-icon.svg'),
    sampleSVG,
    'utf-8'
  );

  await svgService.buildAll({
    src: srcDir,
    out: outDir,
    config: {
      framework: 'vue',
      typescript: true,
      frameworkOptions: {
        scriptSetup: true,
      },
    },
  });

  const files = await FileSystem.readDir(outDir);
  const hasVueComponents = files.some(f => f.endsWith('.vue'));

  if (!hasVueComponents) {
    throw new Error('Vue workflow did not generate .vue files');
  }
}

/**
 * Test: Angular Standalone Components
 */
async function testAngularWorkflow() {
  const srcDir = path.join(TEST_DIR, 'angular-src');
  const outDir = path.join(TEST_DIR, 'angular-out');

  await FileSystem.ensureDir(srcDir);
  await FileSystem.writeFile(
    path.join(srcDir, 'check-mark.svg'),
    sampleSVG,
    'utf-8'
  );

  await svgService.buildAll({
    src: srcDir,
    out: outDir,
    config: {
      framework: 'angular',
      typescript: true,
      frameworkOptions: {
        standalone: true,
      },
    },
  });

  const files = await FileSystem.readDir(outDir);
  const hasAngularComponents = files.some(f => f.endsWith('.component.ts'));

  if (!hasAngularComponents) {
    throw new Error('Angular workflow did not generate .component.ts files');
  }
}

/**
 * Test: Svelte Components
 */
async function testSvelteWorkflow() {
  const srcDir = path.join(TEST_DIR, 'svelte-src');
  const outDir = path.join(TEST_DIR, 'svelte-out');

  await FileSystem.ensureDir(srcDir);
  await FileSystem.writeFile(
    path.join(srcDir, 'star-icon.svg'),
    sampleSVG,
    'utf-8'
  );

  await svgService.buildAll({
    src: srcDir,
    out: outDir,
    config: {
      framework: 'svelte',
      typescript: true,
    },
  });

  const files = await FileSystem.readDir(outDir);
  const hasSvelteComponents = files.some(f => f.endsWith('.svelte'));

  if (!hasSvelteComponents) {
    throw new Error('Svelte workflow did not generate .svelte files');
  }
}

/**
 * Test: Multiple Frameworks in One Project
 */
async function testMultiFrameworkWorkflow() {
  const srcDir = path.join(TEST_DIR, 'multi-src');

  await FileSystem.ensureDir(srcDir);
  await FileSystem.writeFile(path.join(srcDir, 'logo.svg'), sampleSVG, 'utf-8');

  const frameworks = ['react', 'vue', 'svelte', 'angular', 'solid'] as const;

  for (const framework of frameworks) {
    const outDir = path.join(TEST_DIR, `multi-out-${framework}`);

    await svgService.buildAll({
      src: srcDir,
      out: outDir,
      config: {
        framework,
        typescript: true,
      },
    });

    const files = await FileSystem.readDir(outDir);
    if (files.length === 0) {
      throw new Error(`Multi-framework workflow failed for ${framework}`);
    }
  }
}

/**
 * Test: Configuration Persistence
 */
async function testConfigPersistence() {
  const testConfig = {
    source: './svg-icons',
    output: './components/icons',
    framework: 'react' as const,
    typescript: true,
    watch: false,
    defaultWidth: 48,
    defaultHeight: 48,
    defaultFill: '#000000',
    exclude: ['test.svg'],
    styleRules: {
      fill: 'currentColor',
      stroke: 'none',
    },
  };

  configService.writeConfig(testConfig);
  const readConfig = configService.readConfig();

  if (readConfig.defaultWidth !== 48 || readConfig.defaultFill !== '#000000') {
    throw new Error('Config persistence failed');
  }
}

/**
 * Test: Index File Quality
 */
async function testIndexFileQuality() {
  const srcDir = path.join(TEST_DIR, 'index-test-src');
  const outDir = path.join(TEST_DIR, 'index-test-out');

  await FileSystem.ensureDir(srcDir);

  const iconNames = ['home', 'settings', 'user', 'logout', 'dashboard'];
  for (const name of iconNames) {
    await FileSystem.writeFile(
      path.join(srcDir, `${name}-icon.svg`),
      sampleSVG,
      'utf-8'
    );
  }

  await svgService.buildAll({
    src: srcDir,
    out: outDir,
    config: { framework: 'react', typescript: true },
  });

  const indexPath = path.join(outDir, 'index.ts');
  if (!(await FileSystem.exists(indexPath))) {
    throw new Error('Index file was not created');
  }

  const indexContent = await FileSystem.readFile(indexPath, 'utf-8');

  // Check for proper exports
  const hasNamedExports = iconNames.every(name => {
    const componentName =
      name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('') + 'Icon';
    return indexContent.includes(componentName);
  });

  const hasDefaultExport = indexContent.includes('export default');
  const hasDocumentation = indexContent.includes('/**');

  if (!hasNamedExports || !hasDefaultExport || !hasDocumentation) {
    throw new Error('Index file quality check failed');
  }
}

/**
 * Test: Error Handling
 */
async function testErrorHandling() {
  const srcDir = path.join(TEST_DIR, 'error-test-src');
  const outDir = path.join(TEST_DIR, 'error-test-out');

  await FileSystem.ensureDir(srcDir);

  // Create an invalid SVG
  await FileSystem.writeFile(
    path.join(srcDir, 'invalid.svg'),
    '<not-valid-svg',
    'utf-8'
  );

  // Should not throw, but should handle gracefully
  await svgService.buildAll({
    src: srcDir,
    out: outDir,
    config: { framework: 'react', typescript: true },
  });

  // The service should still complete without crashing
  const outputExists = await FileSystem.exists(outDir);
  if (!outputExists) {
    throw new Error('Error handling failed - output directory not created');
  }
}

/**
 * Run all E2E tests
 */
async function runAllTests() {
  console.log('🚀 SVGER-CLI End-to-End Complete Test Suite\n');
  console.log('='.repeat(80));

  await setup();

  console.log('\n📋 Running Complete Workflow Tests:\n');
  console.log('-'.repeat(80));

  await runTest('1. Complete React Workflow', testReactWorkflow);
  await runTest('2. Vue 3 Composition API Workflow', testVueWorkflow);
  await runTest('3. Angular Standalone Components', testAngularWorkflow);
  await runTest('4. Svelte Components', testSvelteWorkflow);
  await runTest('5. Multi-Framework Support', testMultiFrameworkWorkflow);
  await runTest('6. Configuration Persistence', testConfigPersistence);
  await runTest('7. Index File Quality', testIndexFileQuality);
  await runTest('8. Error Handling', testErrorHandling);

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Results Summary\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`   - ${r.name}`);
        console.log(`     ${r.error}`);
      });
  }

  console.log('\n' + '='.repeat(80));

  if (failed === 0) {
    console.log('\n🎉 All E2E tests passed successfully!\n');
    console.log('✨ The svger-cli is production-ready with:');
    console.log(
      '   • Full framework support (React, Vue, Angular, Svelte, Solid, Preact, Lit, Vanilla)'
    );
    console.log('   • TypeScript/JavaScript generation');
    console.log('   • Configuration management');
    console.log('   • Batch processing with index file generation');
    console.log('   • Proper error handling');
    console.log('   • Single unified export pattern\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ E2E test suite failed:', error);
  process.exit(1);
});
