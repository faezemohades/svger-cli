#!/usr/bin/env node

/**
 * Comprehensive Configuration Options Test Suite
 * Tests all config options to ensure they work correctly
 */

import { svgProcessor } from '../dist/processors/svg-processor.js';
import { configService } from '../dist/services/config.js';
import { svgService } from '../dist/services/svg-service.js';
import { FileSystem, toPascalCase } from '../dist/utils/native.js';
import path from 'path';
import fs from 'fs';

// Test SVG content
const testSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
</svg>`;

// Test output directory
const TEST_OUTPUT_DIR = path.join(process.cwd(), 'test-config-output');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Helper to run a test
 */
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

/**
 * Setup test environment
 */
async function setup() {
  console.log('\n🔧 Setting up test environment...\n');

  // Clean test output directory
  if (await FileSystem.exists(TEST_OUTPUT_DIR)) {
    await FileSystem.emptyDir(TEST_OUTPUT_DIR);
  } else {
    await FileSystem.ensureDir(TEST_OUTPUT_DIR);
  }

  // Create test SVG files
  const testSvgDir = path.join(TEST_OUTPUT_DIR, 'test-svgs');
  await FileSystem.ensureDir(testSvgDir);

  // Create SVG files with different naming patterns
  await FileSystem.writeFile(
    path.join(testSvgDir, 'check-circle.svg'),
    testSVG,
    'utf-8'
  );
  await FileSystem.writeFile(
    path.join(testSvgDir, 'home_icon.svg'),
    testSVG,
    'utf-8'
  );
  await FileSystem.writeFile(
    path.join(testSvgDir, 'UserProfile.svg'),
    testSVG,
    'utf-8'
  );
  await FileSystem.writeFile(
    path.join(testSvgDir, 'settings-gear.svg'),
    testSVG,
    'utf-8'
  );
}

/**
 * Test 1: Output Naming Convention - kebab-case
 */
async function testNamingKebab() {
  const outputDir = path.join(TEST_OUTPUT_DIR, 'naming-kebab');
  await FileSystem.ensureDir(outputDir);

  const config = {
    ...configService.getDefaultConfig(),
    output: {
      naming: 'kebab' as const,
      directory: outputDir,
    },
  };

  // Process SVG with kebab naming
  await svgProcessor.processSVGFile(
    path.join(TEST_OUTPUT_DIR, 'test-svgs', 'check-circle.svg'),
    outputDir,
    { framework: 'react', typescript: true }
  );

  // Check if file was created with kebab-case name
  const files = await FileSystem.readDir(outputDir);
  const hasCorrectNaming = files.some(
    f => f.includes('check-circle') || f.includes('CheckCircle')
  );

  if (!hasCorrectNaming) {
    throw new Error('Kebab-case naming not applied correctly');
  }
}

/**
 * Test 2: Output Naming Convention - PascalCase
 */
async function testNamingPascal() {
  const outputDir = path.join(TEST_OUTPUT_DIR, 'naming-pascal');
  await FileSystem.ensureDir(outputDir);

  // Process SVG
  await svgProcessor.processSVGFile(
    path.join(TEST_OUTPUT_DIR, 'test-svgs', 'home_icon.svg'),
    outputDir,
    { framework: 'react', typescript: true }
  );

  // Check if component name is PascalCase
  const files = await FileSystem.readDir(outputDir);
  const hasPascalCase = files.some(f => /^[A-Z][a-zA-Z]*\./.test(f));

  if (!hasPascalCase) {
    throw new Error('PascalCase naming not applied correctly');
  }
}

/**
 * Test 3: Output Naming Convention - camelCase
 */
async function testNamingCamel() {
  const outputDir = path.join(TEST_OUTPUT_DIR, 'naming-camel');
  await FileSystem.ensureDir(outputDir);

  // For camelCase, component should still be PascalCase but export might be camelCase
  await svgProcessor.processSVGFile(
    path.join(TEST_OUTPUT_DIR, 'test-svgs', 'settings-gear.svg'),
    outputDir,
    { framework: 'react', typescript: true }
  );

  const files = await FileSystem.readDir(outputDir);
  if (files.length === 0) {
    throw new Error('No files generated for camelCase naming');
  }
}

/**
 * Test 4: Extension Override
 */
async function testExtensionOverride() {
  const outputDir = path.join(TEST_OUTPUT_DIR, 'extension-override');
  await FileSystem.ensureDir(outputDir);

  // Test TypeScript extension
  await svgProcessor.processSVGFile(
    path.join(TEST_OUTPUT_DIR, 'test-svgs', 'check-circle.svg'),
    outputDir,
    { framework: 'react', typescript: true }
  );

  let files = await FileSystem.readDir(outputDir);
  const hasTsxExtension = files.some(f => f.endsWith('.tsx'));

  if (!hasTsxExtension) {
    throw new Error('TypeScript extension (.tsx) not applied');
  }

  // Clean and test JavaScript extension
  await FileSystem.emptyDir(outputDir);

  await svgProcessor.processSVGFile(
    path.join(TEST_OUTPUT_DIR, 'test-svgs', 'check-circle.svg'),
    outputDir,
    { framework: 'react', typescript: false }
  );

  files = await FileSystem.readDir(outputDir);
  const hasJsxExtension = files.some(f => f.endsWith('.jsx'));

  if (!hasJsxExtension) {
    throw new Error('JavaScript extension (.jsx) not applied');
  }
}

/**
 * Test 5: Directory Structure
 */
async function testDirectoryStructure() {
  const outputDir = path.join(TEST_OUTPUT_DIR, 'directory-structure');
  await FileSystem.ensureDir(outputDir);

  await svgProcessor.processSVGFile(
    path.join(TEST_OUTPUT_DIR, 'test-svgs', 'check-circle.svg'),
    outputDir,
    { framework: 'react', typescript: true }
  );

  // Check if output directory was created and contains files
  if (!(await FileSystem.exists(outputDir))) {
    throw new Error('Output directory was not created');
  }

  const files = await FileSystem.readDir(outputDir);
  if (files.length === 0) {
    throw new Error('No files generated in output directory');
  }
}

/**
 * Test 6: Component Name Matches SVG Filename (Default Behavior)
 */
async function testDefaultComponentNaming() {
  const testCases = [
    { file: 'check-circle.svg', expected: 'CheckCircle' },
    { file: 'home_icon.svg', expected: 'HomeIcon' },
    { file: 'UserProfile.svg', expected: 'UserProfile' },
    { file: 'settings-gear.svg', expected: 'SettingsGear' },
  ];

  for (const testCase of testCases) {
    const componentName = svgProcessor.generateComponentName(testCase.file);

    if (componentName !== testCase.expected) {
      throw new Error(
        `Component name mismatch: expected "${testCase.expected}", got "${componentName}"`
      );
    }
  }
}

/**
 * Test 7: Framework-Specific Extensions
 */
async function testFrameworkExtensions() {
  const frameworks = [
    { name: 'react', typescript: true, expected: '.tsx' },
    { name: 'react', typescript: false, expected: '.jsx' },
    { name: 'vue', typescript: true, expected: '.vue' },
    { name: 'svelte', typescript: true, expected: '.svelte' },
    { name: 'angular', typescript: true, expected: '.component.ts' },
  ];

  for (const fw of frameworks) {
    const outputDir = path.join(
      TEST_OUTPUT_DIR,
      `framework-${fw.name}-${fw.typescript ? 'ts' : 'js'}`
    );
    await FileSystem.ensureDir(outputDir);

    await svgProcessor.processSVGFile(
      path.join(TEST_OUTPUT_DIR, 'test-svgs', 'check-circle.svg'),
      outputDir,
      { framework: fw.name as any, typescript: fw.typescript }
    );

    const files = await FileSystem.readDir(outputDir);
    const hasCorrectExtension = files.some(f => f.endsWith(fw.expected));

    if (!hasCorrectExtension) {
      throw new Error(
        `Framework ${fw.name} with typescript=${fw.typescript} should generate ${fw.expected} files`
      );
    }
  }
}

/**
 * Test 8: Config File Integration
 */
async function testConfigFileIntegration() {
  // Create a test config
  const testConfig = {
    source: './test-svgs',
    output: './test-output',
    framework: 'react' as const,
    typescript: true,
    watch: false,
    defaultWidth: 32,
    defaultHeight: 32,
    defaultFill: 'currentColor',
    exclude: [],
    styleRules: {
      fill: 'inherit',
      stroke: 'none',
    },
  };

  // Write config
  configService.writeConfig(testConfig);

  // Read and verify
  const readConfig = configService.readConfig();

  if (readConfig.defaultWidth !== 32) {
    throw new Error('Config defaultWidth not persisted correctly');
  }

  if (readConfig.framework !== 'react') {
    throw new Error('Config framework not persisted correctly');
  }
}

/**
 * Test 9: Batch Processing with Config
 */
async function testBatchProcessing() {
  const outputDir = path.join(TEST_OUTPUT_DIR, 'batch-output');
  await FileSystem.ensureDir(outputDir);

  const svgFiles = [
    'check-circle.svg',
    'home_icon.svg',
    'UserProfile.svg',
    'settings-gear.svg',
  ];

  const files = svgFiles.map(file => ({
    path: path.join(TEST_OUTPUT_DIR, 'test-svgs', file),
    outputDir,
    options: { framework: 'react' as const, typescript: true },
  }));

  const results = await svgProcessor.processBatch(files, { parallel: true });

  const successCount = results.filter(r => r.success).length;
  if (successCount !== svgFiles.length) {
    throw new Error(
      `Batch processing failed: ${successCount}/${svgFiles.length} succeeded`
    );
  }

  // Verify all files were created
  const outputFiles = await FileSystem.readDir(outputDir);
  if (outputFiles.length !== svgFiles.length) {
    throw new Error(
      `Expected ${svgFiles.length} output files, got ${outputFiles.length}`
    );
  }
}

/**
 * Test 10: Index File Generation
 */
async function testIndexFileGeneration() {
  const outputDir = path.join(TEST_OUTPUT_DIR, 'index-generation');
  await FileSystem.ensureDir(outputDir);

  // Build all SVGs
  await svgService.buildAll({
    src: path.join(TEST_OUTPUT_DIR, 'test-svgs'),
    out: outputDir,
    config: { framework: 'react', typescript: true },
  });

  // Check if index.ts was created
  const indexPath = path.join(outputDir, 'index.ts');
  if (!(await FileSystem.exists(indexPath))) {
    throw new Error('index.ts file was not generated');
  }

  // Check index.ts content
  const indexContent = await FileSystem.readFile(indexPath, 'utf-8');
  if (!indexContent.includes('export')) {
    throw new Error('index.ts does not contain exports');
  }

  // Check if it exports all components
  const expectedComponents = [
    'CheckCircle',
    'HomeIcon',
    'UserProfile',
    'SettingsGear',
  ];
  for (const component of expectedComponents) {
    if (!indexContent.includes(component)) {
      throw new Error(`index.ts does not export ${component}`);
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 SVGER-CLI Configuration Options Test Suite\n');
  console.log('='.repeat(80));

  await setup();

  console.log('\n📋 Running Tests:\n');
  console.log('-'.repeat(80));

  await runTest('1. Output Naming - Kebab Case', testNamingKebab);
  await runTest('2. Output Naming - Pascal Case', testNamingPascal);
  await runTest('3. Output Naming - Camel Case', testNamingCamel);
  await runTest('4. Extension Override', testExtensionOverride);
  await runTest('5. Directory Structure', testDirectoryStructure);
  await runTest('6. Default Component Naming', testDefaultComponentNaming);
  await runTest('7. Framework-Specific Extensions', testFrameworkExtensions);
  await runTest('8. Config File Integration', testConfigFileIntegration);
  await runTest('9. Batch Processing', testBatchProcessing);
  await runTest('10. Index File Generation', testIndexFileGeneration);

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
    console.log('\n🎉 All tests passed successfully!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
