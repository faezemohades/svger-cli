/**
 * Test: Locked Files Index Generation
 *
 * This test verifies that locked SVG files are still included in the auto-generated
 * index.ts file, even though they are not regenerated during build.
 */

import { svgService } from '../src/services/svg-service.js';
import { FileSystem } from '../src/utils/native.js';
import path from 'path';
import fs from 'fs';

const TEST_DIR = path.resolve('test-locked-files');
const SRC_DIR = path.join(TEST_DIR, 'src');
const OUT_DIR = path.join(TEST_DIR, 'out');

// Simple SVG files for testing
const SVG_CONTENT_1 = '<circle cx="12" cy="12" r="10" />';
const SVG_CONTENT_2 = '<rect x="0" y="0" width="24" height="24" />';
const SVG_CONTENT_3 = '<path d="M12 2L2 7l10 5 10-5-10-5z" />';

async function setup() {
  console.log('🔧 Setting up test environment...\n');

  // Clean up any existing test directories
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }

  // Create fresh directories
  await FileSystem.ensureDir(SRC_DIR);
  await FileSystem.ensureDir(OUT_DIR);

  // Create test SVG files
  await FileSystem.writeFile(
    path.join(SRC_DIR, 'logo.svg'),
    SVG_CONTENT_1,
    'utf-8'
  );
  await FileSystem.writeFile(
    path.join(SRC_DIR, 'icon.svg'),
    SVG_CONTENT_2,
    'utf-8'
  );
  await FileSystem.writeFile(
    path.join(SRC_DIR, 'badge.svg'),
    SVG_CONTENT_3,
    'utf-8'
  );
}

async function cleanup() {
  // Clean up test directories
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }

  // Clean up lock file
  if (fs.existsSync('.svg-lock')) {
    fs.unlinkSync('.svg-lock');
  }
}

async function testLockedFilesInIndex() {
  const tests = [];

  console.log('📋 Running Locked Files Index Generation Tests:\n');
  console.log(
    '--------------------------------------------------------------------------------'
  );

  // Test 1: Initial build - all files should be in index
  try {
    await svgService.buildAll({
      src: SRC_DIR,
      out: OUT_DIR,
      config: {
        framework: 'react',
        typescript: true,
      },
    });

    const indexPath = path.join(OUT_DIR, 'index.ts');
    const indexExists = await FileSystem.exists(indexPath);

    if (!indexExists) {
      throw new Error('Index file was not generated');
    }

    const indexContent = await FileSystem.readFile(indexPath, 'utf-8');

    const hasLogo = indexContent.includes('Logo');
    const hasIcon = indexContent.includes('Icon');
    const hasBadge = indexContent.includes('Badge');

    if (!hasLogo || !hasIcon || !hasBadge) {
      throw new Error('Initial index file is missing some components');
    }

    console.log('✅ 1. Initial Build - All components in index');
    tests.push({ name: 'Initial Build', passed: true });
  } catch (error) {
    console.log(`❌ 1. Initial Build - Failed: ${(error as Error).message}`);
    tests.push({ name: 'Initial Build', passed: false, error });
  }

  // Test 2: Lock one file and rebuild - locked file should still be in index
  try {
    // Lock the logo file
    svgService.lockService.lockFiles([path.join(SRC_DIR, 'logo.svg')]);

    // Modify the logo component to verify it's not regenerated
    const logoPath = path.join(OUT_DIR, 'Logo.tsx');
    const originalLogo = await FileSystem.readFile(logoPath, 'utf-8');
    const modifiedLogo = originalLogo + '\n// LOCKED TEST MARKER\n';
    await FileSystem.writeFile(logoPath, modifiedLogo, 'utf-8');

    // Rebuild
    await svgService.buildAll({
      src: SRC_DIR,
      out: OUT_DIR,
      config: {
        framework: 'react',
        typescript: true,
      },
    });

    // Check that the locked file wasn't regenerated
    const currentLogo = await FileSystem.readFile(logoPath, 'utf-8');
    if (!currentLogo.includes('LOCKED TEST MARKER')) {
      throw new Error('Locked file was regenerated (should have been skipped)');
    }

    // Check that index still includes the locked file
    const indexPath = path.join(OUT_DIR, 'index.ts');
    const indexContent = await FileSystem.readFile(indexPath, 'utf-8');

    const hasLogo = indexContent.includes('Logo');
    const hasIcon = indexContent.includes('Icon');
    const hasBadge = indexContent.includes('Badge');

    if (!hasLogo) {
      throw new Error('Locked file (Logo) is missing from index.ts');
    }

    if (!hasIcon || !hasBadge) {
      throw new Error('Other files are missing from index.ts');
    }

    console.log('✅ 2. Locked File in Index - Logo locked but still exported');
    tests.push({ name: 'Locked File in Index', passed: true });
  } catch (error) {
    console.log(
      `❌ 2. Locked File in Index - Failed: ${(error as Error).message}`
    );
    tests.push({ name: 'Locked File in Index', passed: false, error });
  }

  // Test 3: Lock multiple files and rebuild
  try {
    // Lock another file
    svgService.lockService.lockFiles([path.join(SRC_DIR, 'icon.svg')]);

    // Rebuild
    await svgService.buildAll({
      src: SRC_DIR,
      out: OUT_DIR,
      config: {
        framework: 'react',
        typescript: true,
      },
    });

    // Check index includes all files
    const indexPath = path.join(OUT_DIR, 'index.ts');
    const indexContent = await FileSystem.readFile(indexPath, 'utf-8');

    const hasLogo = indexContent.includes('Logo');
    const hasIcon = indexContent.includes('Icon');
    const hasBadge = indexContent.includes('Badge');

    if (!hasLogo || !hasIcon || !hasBadge) {
      throw new Error('Index is missing locked components');
    }

    console.log(
      '✅ 3. Multiple Locked Files - Both locked files still exported'
    );
    tests.push({ name: 'Multiple Locked Files', passed: true });
  } catch (error) {
    console.log(
      `❌ 3. Multiple Locked Files - Failed: ${(error as Error).message}`
    );
    tests.push({ name: 'Multiple Locked Files', passed: false, error });
  }

  // Test 4: Unlock and verify everything still works
  try {
    // Unlock all files
    svgService.lockService.unlockFiles([
      path.join(SRC_DIR, 'logo.svg'),
      path.join(SRC_DIR, 'icon.svg'),
    ]);

    // Rebuild
    await svgService.buildAll({
      src: SRC_DIR,
      out: OUT_DIR,
      config: {
        framework: 'react',
        typescript: true,
      },
    });

    // Check that locked file marker is gone (file was regenerated)
    const logoPath = path.join(OUT_DIR, 'Logo.tsx');
    const currentLogo = await FileSystem.readFile(logoPath, 'utf-8');
    if (currentLogo.includes('LOCKED TEST MARKER')) {
      throw new Error('Unlocked file was not regenerated');
    }

    // Check index
    const indexPath = path.join(OUT_DIR, 'index.ts');
    const indexContent = await FileSystem.readFile(indexPath, 'utf-8');

    const hasLogo = indexContent.includes('Logo');
    const hasIcon = indexContent.includes('Icon');
    const hasBadge = indexContent.includes('Badge');

    if (!hasLogo || !hasIcon || !hasBadge) {
      throw new Error('Index is missing components after unlock');
    }

    console.log(
      '✅ 4. Unlock and Regenerate - All files regenerated and exported'
    );
    tests.push({ name: 'Unlock and Regenerate', passed: true });
  } catch (error) {
    console.log(
      `❌ 4. Unlock and Regenerate - Failed: ${(error as Error).message}`
    );
    tests.push({ name: 'Unlock and Regenerate', passed: false, error });
  }

  console.log(
    '\n================================================================================\n'
  );

  // Print summary
  const passed = tests.filter(t => t.passed).length;
  const total = tests.length;

  console.log('📊 Test Results Summary\n');
  console.log(`   Total Tests: ${total}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${total - passed}`);
  console.log(
    '\n================================================================================\n'
  );

  if (passed === total) {
    console.log('🎉 All locked files index generation tests passed!\n');
    console.log('✨ The lock mechanism now correctly:\n');
    console.log('   • Prevents regeneration of locked components');
    console.log('   • Includes locked components in index.ts exports');
    console.log('   • Works with multiple locked files');
    console.log('   • Allows unlocking and regeneration\n');
  } else {
    console.log('❌ Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
(async () => {
  try {
    await setup();
    await testLockedFilesInIndex();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
})();
