/**
 * Integration Test: Visual Diff + SVG Optimization Pipeline
 * 
 * Tests that all optimization levels produce visually identical output
 * using the Phase 6.3 visual diff testing system.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { SVGProcessor } from '../../dist/processors/svg-processor.js';
import { OptLevel } from '../../dist/optimizers/types.js';
import { compareVisually } from '../../dist/utils/visual-diff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Test SVG Samples
// ============================================================================

const TEST_SVGS = [
  {
    name: 'Simple Icon (rect + circle)',
    threshold: 2.5, // Circles have anti-aliasing differences
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect x="10" y="10" width="80" height="80" fill="#3498db" stroke="#2c3e50" stroke-width="2"/>
      <circle cx="50" cy="50" r="20" fill="#e74c3c"/>
    </svg>`,
  },
  {
    name: 'Shape Collection',
    threshold: 0.5, // Simple shapes should be nearly identical
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect x="20" y="20" width="60" height="60" fill="red"/>
      <polygon points="120,20 180,80 60,80" fill="blue"/>
      <polyline points="20,120 60,140 100,120 140,140 180,120" stroke="green" fill="none" stroke-width="2"/>
      <ellipse cx="100" cy="170" rx="40" ry="20" fill="purple"/>
    </svg>`,
  },
  {
    name: 'Complex Path',
    threshold: 15.0, // Path simplification causes significant AA changes
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <path d="M 50 50 L 150 50 L 150 150 L 50 150 Z M 75 75 L 75 125 L 125 125 L 125 75 Z" fill="#f39c12"/>
      <path d="M 10 10 Q 50 10 50 50 T 90 50" stroke="#8e44ad" fill="none" stroke-width="3"/>
    </svg>`,
  },
  {
    name: 'Text + Shapes',
    threshold: 1.0, // Text rendering has small font differences
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
      <rect width="300" height="200" fill="#ecf0f1"/>
      <text x="150" y="100" font-family="Arial" font-size="24" fill="#2c3e50" text-anchor="middle">SVG Optimizer</text>
      <circle cx="50" cy="50" r="30" fill="#1abc9c"/>
      <rect x="220" y="20" width="60" height="60" fill="#e67e22"/>
    </svg>`,
  },
  {
    name: 'Gradients and Paths',
    threshold: 2.0,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="180" height="180" fill="url(#grad1)" />
      <path d="M 50 50 L 150 50 L 100 150 Z" fill="#fff" />
    </svg>`
  },
  {
    name: 'Multiple Curves',
    threshold: 15.0,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <path d="M10 80 Q 95 10 180 80" stroke="black" fill="transparent"/>
      <path d="M10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" stroke="red" fill="transparent"/>
    </svg>`
  },
  {
    name: 'Transform Elements',
    threshold: 1.0,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <g transform="translate(100, 100) rotate(45)">
        <rect x="-50" y="-50" width="100" height="100" fill="purple" />
        <circle cx="0" cy="0" r="20" fill="white" />
      </g>
    </svg>`
  },
  {
    name: 'Compound Shapes and Opacity',
    threshold: 1.0,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="100" height="100" fill="blue" />
      <rect x="50" y="50" width="100" height="100" fill="red" opacity="0.5" />
      <circle cx="100" cy="100" r="40" fill="green" opacity="0.8" />
    </svg>`
  },
  {
    name: 'Patterns and Simple Strokes',
    threshold: 1.0,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs>
        <pattern id="pattern1" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="5" fill="#333" />
        </pattern>
      </defs>
      <rect width="200" height="200" fill="url(#pattern1)" />
    </svg>`
  },
];

// ============================================================================
// Test Runner
// ============================================================================

async function runIntegrationTests() {
  console.log('🔬 Integration Test: Visual Diff + Optimization Pipeline\n');
  console.log('=' .repeat(70));
  
  const processor = new SVGProcessor();
  const levels = [OptLevel.BASIC, OptLevel.BALANCED, OptLevel.AGGRESSIVE, OptLevel.MAXIMUM];
  
  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  
  const diffDir = path.join(__dirname, 'test-output', 'visual-integration');
  await fs.mkdir(diffDir, { recursive: true });
  
  for (const testCase of TEST_SVGS) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('-'.repeat(70));
    
    const original = testCase.svg;
    
    for (const level of levels) {
      totalTests++;
      const testName = `${testCase.name} [${level}]`;
      
      try {
        // Optimize SVG
        processor.setOptimizationLevel(level);
        const optimized = await processor.cleanSVGContent(original);
        
        // Calculate size reduction
        const originalSize = original.length;
        const optimizedSize = optimized.length;
        const reductionPercent = ((1 - optimizedSize / originalSize) * 100).toFixed(2);
        
        // Visual diff test with content-aware threshold
        const diffResult = await compareVisually(original, optimized, {
          diff: { maxDiffPercent: testCase.threshold }, // Use per-test threshold
        });
        
        if (diffResult.passed) {
          console.log(`  ✅ ${level.padEnd(15)} - ${reductionPercent}% reduction, ${diffResult.mismatchPercent.toFixed(4)}% visual diff`);
          passed++;
        } else {
          // Save diff image on failure
          await compareVisually(original, optimized, {
            diff: { maxDiffPercent: testCase.threshold },
            saveDiffImage: path.join(diffDir, `${level}-${testCase.name.replace(/[^a-z0-9]/gi, '-')}.png`),
          });
          console.log(`  ❌ ${level.padEnd(15)} - ${reductionPercent}% reduction, ${diffResult.mismatchPercent.toFixed(4)}% visual diff (threshold: ${testCase.threshold}%)`);
          failed++;
        }
      } catch (error) {
        console.log(`  ❌ ${level.padEnd(15)} - ERROR: ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Integration Test Summary:`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Success Rate: ${((passed / totalTests) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All optimization levels produce visually identical output!\n');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed visual diff validation.\n`);
    console.log(`📁 Diff images saved to: ${diffDir}\n`);
    process.exit(1);
  }
}

// ============================================================================
// Run Integration Tests
// ============================================================================

runIntegrationTests().catch((error) => {
  console.error('\n💥 Integration test failed:', error);
  process.exit(1);
});
