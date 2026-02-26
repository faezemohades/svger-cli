/**
 * Phase 6.3: Visual Diff Testing - Test Suite
 * 
 * Tests the visual-diff module to ensure:
 * 1. Identical SVGs return 0% difference
 * 2. Shape conversions (rect → path) are visually identical
 * 3. Path simplification preserves appearance
 * 4. Threshold enforcement works correctly
 * 5. Diff images are generated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  compareVisually,
  formatDiffResult,
  batchCompare,
} from '../../dist/utils/visual-diff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Test SVG Samples
// ============================================================================

const SVG_SAMPLES = {
  // Simple rectangle
  rect: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="red"/></svg>',
  
  // Equivalent path (should be visually identical)
  rectAsPath: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M10 10h80v80h-80z" fill="red"/></svg>',
  
  // Rounded rectangle
  roundedRect: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" rx="10" fill="blue"/></svg>',
  
  // Different color (should fail threshold)
  rectBlue: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>',
  
  // Circle
  circle: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="green"/></svg>',
  
  // Polygon (triangle)
  polygon: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><polygon points="50,10 90,90 10,90" fill="purple"/></svg>',
  
  // Equivalent path
  polygonAsPath: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M50 10L90 90L10 90z" fill="purple"/></svg>',
  
  // Complex illustration
  complex: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect x="20" y="20" width="160" height="160" fill="#f0f0f0" stroke="#333" stroke-width="2"/>
    <circle cx="100" cy="70" r="30" fill="#ff6b6b"/>
    <ellipse cx="100" cy="150" rx="40" ry="20" fill="#4ecdc4"/>
    <polygon points="100,90 120,130 80,130" fill="#ffe66d"/>
    <line x1="50" y1="100" x2="150" y2="100" stroke="#333" stroke-width="2"/>
  </svg>`,
  
  // Optimized version (whitespace removed)
  complexOptimized: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="20" y="20" width="160" height="160" fill="#f0f0f0" stroke="#333" stroke-width="2"/><circle cx="100" cy="70" r="30" fill="#ff6b6b"/><ellipse cx="100" cy="150" rx="40" ry="20" fill="#4ecdc4"/><polygon points="100,90 120,130 80,130" fill="#ffe66d"/><line x1="50" y1="100" x2="150" y2="100" stroke="#333" stroke-width="2"/></svg>',
};

// ============================================================================
// Test Runner
// ============================================================================

async function runTests() {
  console.log('🧪 Phase 6.3: Visual Diff Testing\n');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  const diffDir = path.join(__dirname, 'test-output', 'visual-diffs');
  
  // Ensure output directory exists
  await fs.mkdir(diffDir, { recursive: true });
  
  // Test 1: Identical SVGs
  console.log('\n📋 Test 1: Identical SVGs (0% difference expected)');
  try {
    const result = await compareVisually(SVG_SAMPLES.rect, SVG_SAMPLES.rect);
    if (result.passed && result.mismatchPercent === 0) {
      console.log('✅ PASSED:', formatDiffResult(result));
      passed++;
    } else {
      console.log('❌ FAILED:', formatDiffResult(result));
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
    failed++;
  }
  
  // Test 2: Rect → Path conversion (visually identical)
  console.log('\n📋 Test 2: Rectangle → Path Conversion (0% difference expected)');
  try {
    const result = await compareVisually(
      SVG_SAMPLES.rect,
      SVG_SAMPLES.rectAsPath,
      {
        saveDiffImage: path.join(diffDir, 'rect-to-path-diff.png'),
      }
    );
    if (result.passed && result.mismatchPercent < 0.01) {
      console.log('✅ PASSED:', formatDiffResult(result));
      passed++;
    } else {
      console.log('❌ FAILED:', formatDiffResult(result));
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
    failed++;
  }
  
  // Test 3: Polygon → Path conversion
  console.log('\n📋 Test 3: Polygon → Path Conversion (0% difference expected)');
  try {
    const result = await compareVisually(
      SVG_SAMPLES.polygon,
      SVG_SAMPLES.polygonAsPath,
      {
        saveDiffImage: path.join(diffDir, 'polygon-to-path-diff.png'),
      }
    );
    if (result.passed && result.mismatchPercent < 0.01) {
      console.log('✅ PASSED:', formatDiffResult(result));
      passed++;
    } else {
      console.log('❌ FAILED:', formatDiffResult(result));
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
    failed++;
  }
  
  // Test 4: Whitespace optimization (visually identical)
  console.log('\n📋 Test 4: Whitespace Optimization (0% difference expected)');
  try {
    const result = await compareVisually(
      SVG_SAMPLES.complex,
      SVG_SAMPLES.complexOptimized
    );
    if (result.passed && result.mismatchPercent === 0) {
      console.log('✅ PASSED:', formatDiffResult(result));
      passed++;
    } else {
      console.log('❌ FAILED:', formatDiffResult(result));
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
    failed++;
  }
  
  // Test 5: Color change (should fail threshold)
  console.log('\n📋 Test 5: Color Change Detection (should FAIL threshold)');
  try {
    const result = await compareVisually(
      SVG_SAMPLES.rect,
      SVG_SAMPLES.rectBlue,
      {
        diff: { maxDiffPercent: 0.1 },
        saveDiffImage: path.join(diffDir, 'color-diff.png'),
      }
    );
    if (!result.passed && result.mismatchPercent > 5) {
      console.log('✅ PASSED (correctly detected difference):', formatDiffResult(result));
      passed++;
    } else {
      console.log('❌ FAILED (should have detected difference):', formatDiffResult(result));
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
    failed++;
  }
  
  // Test 6: Permissive threshold
  console.log('\n📋 Test 6: Permissive Threshold (allow 50% difference)');
  try {
    const result = await compareVisually(
      SVG_SAMPLES.rect,
      SVG_SAMPLES.rectBlue,
      {
        diff: { maxDiffPercent: 50 },
      }
    );
    if (result.passed && result.mismatchPercent < 50) {
      console.log('✅ PASSED (within permissive threshold):', formatDiffResult(result));
      passed++;
    } else {
      console.log('❌ FAILED:', formatDiffResult(result));
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
    failed++;
  }
  
  // Test 7: Batch comparison
  console.log('\n📋 Test 7: Batch Comparison (3 pairs)');
  try {
    const pairs = [
      { name: 'rect→path', before: SVG_SAMPLES.rect, after: SVG_SAMPLES.rectAsPath },
      { name: 'polygon→path', before: SVG_SAMPLES.polygon, after: SVG_SAMPLES.polygonAsPath },
      { name: 'whitespace-opt', before: SVG_SAMPLES.complex, after: SVG_SAMPLES.complexOptimized },
    ];
    
    const results = await batchCompare(pairs);
    
    const allPassed = results.every(r => r.result.passed);
    if (allPassed && results.length === 3) {
      console.log('✅ PASSED: All 3 comparisons passed');
      results.forEach(({ name, result }) => {
        console.log(`  - ${name}: ${result.mismatchPercent.toFixed(4)}% diff`);
      });
      passed++;
    } else {
      console.log('❌ FAILED: Some comparisons failed');
      results.forEach(({ name, result }) => {
        const status = result.passed ? '✓' : '✗';
        console.log(`  ${status} ${name}: ${result.mismatchPercent.toFixed(4)}% diff`);
      });
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
    failed++;
  }
  
  // Test 8: Custom render config
  console.log('\n📋 Test 8: Custom Render Config (400x300 @ 72dpi)');
  try {
    const result = await compareVisually(
      SVG_SAMPLES.rect,
      SVG_SAMPLES.rectAsPath,
      {
        render: {
          width: 400,
          height: 300,
          density: 72,
        },
      }
    );
    if (result.passed && result.mismatchPercent < 0.01) {
      console.log('✅ PASSED:', formatDiffResult(result));
      console.log(`  Total pixels: ${result.totalPixels.toLocaleString()}`);
      passed++;
    } else {
      console.log('❌ FAILED:', formatDiffResult(result));
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary:`);
  console.log(`  ✅ Passed: ${passed}/8`);
  console.log(`  ❌ Failed: ${failed}/8`);
  console.log(`  📁 Diff images saved to: ${diffDir}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Visual diff testing is working correctly.\n');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Please review.\n`);
    process.exit(1);
  }
}

// ============================================================================
// Run Tests
// ============================================================================

runTests().catch((error) => {
  console.error('\n💥 Test suite failed:', error);
  process.exit(1);
});
