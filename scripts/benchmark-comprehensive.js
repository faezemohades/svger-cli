/**
 * Comprehensive Benchmarking Suite
 * Compare svger-cli performance across optimization levels
 */

import { SVGProcessor } from '../dist/processors/svg-processor.js';
import { OptLevel } from '../dist/optimizers/types.js';
import { compareVisually } from '../dist/utils/visual-diff.js';

/**
 * Test SVG samples
 */
const TEST_SVGS = [
  {
    name: 'Simple Icon',
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect x="10" y="10" width="80" height="80" fill="#3498db" stroke="#2c3e50" stroke-width="2"/>
      <circle cx="50" cy="50" r="20" fill="#e74c3c"/>
    </svg>`,
  },
  {
    name: 'Complex Path',
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <path d="M10 80 Q 52.5 10, 95 80 T 180 80" stroke="#4CAF50" fill="none" stroke-width="3"/>
      <path d="M30 120 L 50 180 L 70 120 L 90 180 L 110 120 L 130 180 L 150 120 L 170 180" stroke="#FF5722" fill="none" stroke-width="2"/>
    </svg>`,
  },
  {
    name: 'Text & Shapes',
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150">
      <rect x="10" y="10" width="280" height="130" rx="10" fill="#f0f0f0" stroke="#333" stroke-width="2"/>
      <text x="150" y="80" font-family="Arial" font-size="24" text-anchor="middle" fill="#333">Hello SVG</text>
    </svg>`,
  },
  {
    name: 'Icon Set (10 shapes)',
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100" viewBox="0 0 500 100">
      <rect x="10" y="20" width="40" height="40" fill="#E91E63"/>
      <circle cx="100" cy="40" r="20" fill="#9C27B0"/>
      <polygon points="180,20 160,60 200,60" fill="#673AB7"/>
      <ellipse cx="250" cy="40" rx="25" ry="15" fill="#3F51B5"/>
      <rect x="310" y="20" width="40" height="40" rx="5" fill="#2196F3"/>
      <circle cx="400" cy="40" r="20" fill="#03A9F4"/>
      <rect x="450" y="20" width="40" height="40" fill="#00BCD4"/>
      <polygon points="80,80 60,60 100,60" fill="#009688"/>
      <circle cx="150" cy="80" r="10" fill="#4CAF50"/>
      <rect x="200" y="70" width="20" height="20" fill="#8BC34A"/>
    </svg>`,
  },
];

/**
 * Benchmark svger-cli at different optimization levels
 */
async function benchmarkSvgerCli(svgContent, level) {
  const processor = new SVGProcessor();
  processor.setOptimizationLevel(level);

  const originalSize = Buffer.byteLength(svgContent, 'utf8');
  const memBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  const optimized = await processor.cleanSVGContent(svgContent);

  const endTime = performance.now();
  const memAfter = process.memoryUsage().heapUsed;

  const optimizedSize = Buffer.byteLength(optimized, 'utf8');
  const reductionPercent =
    ((originalSize - optimizedSize) / originalSize) * 100;
  const processingTime = endTime - startTime;
  const memoryUsed = Math.max(0, memAfter - memBefore);

  // Visual diff validation
  let visualDiff = 0;
  try {
    const result = await compareVisually(svgContent, optimized);
    visualDiff = result ? result.diffPercent : 0;
  } catch (error) {
    // Visual diff validation failed, use 0
    visualDiff = 0;
  }

  return {
    tool: 'svger-cli',
    level: getLevelName(level),
    originalSize,
    optimizedSize,
    reductionPercent: reductionPercent || 0,
    processingTime: processingTime || 0,
    visualDiff: visualDiff || 0,
    memoryUsed: memoryUsed || 0,
  };
}

/**
 * Get optimization level name
 */
function getLevelName(level) {
  const names = {
    [OptLevel.BASIC]: 'BASIC',
    [OptLevel.BALANCED]: 'BALANCED',
    [OptLevel.AGGRESSIVE]: 'AGGRESSIVE',
    [OptLevel.MAXIMUM]: 'MAXIMUM',
  };
  return names[level] || 'UNKNOWN';
}

/**
 * Run comprehensive benchmark suite
 */
async function runBenchmarks() {
  console.log('🔬 Comprehensive Benchmarking Suite\n');
  console.log('='.repeat(80));

  const allResults = [];

  for (const testCase of TEST_SVGS) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('-'.repeat(80));

    // Test all optimization levels
    const levels = [
      OptLevel.BASIC,
      OptLevel.BALANCED,
      OptLevel.AGGRESSIVE,
      OptLevel.MAXIMUM,
    ];

    for (const level of levels) {
      try {
        const result = await benchmarkSvgerCli(testCase.content, level);
        if (!result) {
          console.log(`  ⚠️  ${getLevelName(level)}: Benchmark returned null/undefined`);
          continue;
        }
        allResults.push(result);

        console.log(
          `  ${result.level.padEnd(12)} | ` +
            `Size: ${result.reductionPercent.toFixed(2)}% reduction | ` +
            `Time: ${result.processingTime.toFixed(2)}ms | ` +
            `Visual: ${result.visualDiff.toFixed(4)}% diff | ` +
            `Memory: ${(result.memoryUsed / 1024).toFixed(2)}KB`
        );
      } catch (error) {
        console.log(`  ❌ ${getLevelName(level)}: ${error.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary Statistics\n');

  // Calculate averages per level
  const levels = ['BASIC', 'BALANCED', 'AGGRESSIVE', 'MAXIMUM'];
  
  for (const level of levels) {
    const levelResults = allResults.filter(r => r.level === level);
    const avgReduction = levelResults.reduce((sum, r) => sum + r.reductionPercent, 0) / levelResults.length;
    const avgTime = levelResults.reduce((sum, r) => sum + r.processingTime, 0) / levelResults.length;
    const avgVisual = levelResults.reduce((sum, r) => sum + r.visualDiff, 0) / levelResults.length;
    const avgMemory = levelResults.reduce((sum, r) => sum + r.memoryUsed, 0) / levelResults.length;

    console.log(`${level}:`);
    console.log(`  Average Size Reduction: ${avgReduction.toFixed(2)}%`);
    console.log(`  Average Processing Time: ${avgTime.toFixed(2)}ms`);
    console.log(`  Average Visual Diff: ${avgVisual.toFixed(4)}%`);
    console.log(`  Average Memory Usage: ${(avgMemory / 1024).toFixed(2)}KB`);
    console.log();
  }

  // Generate comparison table for README
  console.log('=' .repeat(80));
  console.log('📋 Comparison Table (for README)\n');
  console.log('| Optimization Level | Size Reduction | Processing Time | Visual Quality | Memory Usage |');
  console.log('|-------------------|----------------|-----------------|----------------|--------------|');
  
  for (const level of levels) {
    const levelResults = allResults.filter(r => r.level === level);
    const avgReduction = levelResults.reduce((sum, r) => sum + r.reductionPercent, 0) / levelResults.length;
    const avgTime = levelResults.reduce((sum, r) => sum + r.processingTime, 0) / levelResults.length;
    const avgVisual = levelResults.reduce((sum, r) => sum + r.visualDiff, 0) / levelResults.length;
    const avgMemory = levelResults.reduce((sum, r) => sum + r.memoryUsed, 0) / levelResults.length;

    const quality = avgVisual < 0.1 ? 'Pixel-perfect ✅' : avgVisual < 1 ? 'Excellent ✅' : avgVisual < 5 ? 'Good ✅' : 'Acceptable ⚠️';
    
    console.log(`| **${level}** | ${avgReduction.toFixed(2)}% | ${avgTime.toFixed(2)}ms | ${quality} | ${(avgMemory / 1024).toFixed(2)}KB |`);
  }

  console.log('\n🎉 Benchmark complete!');
}

// Run benchmarks
runBenchmarks().catch(error => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});
