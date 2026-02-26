#!/usr/bin/env node

/**
 * Phase 3: Numeric Optimizer Tests
 */

import {
  roundNumber,
  optimizeColor,
  optimizeNumericValues,
} from './dist/optimizers/numeric-optimizer.js';
import { parseSVG } from './dist/optimizers/svg-tree-parser.js';
import { serializeSVGMinified } from './dist/optimizers/tree-serializer.js';

console.log('🧪 Phase 3: Numeric Optimizer Tests\n');
console.log('='.repeat(60));

// Test 1: Number rounding
console.log('\n📊 Test 1: Number Rounding');
console.log('-'.repeat(60));

const testNumbers = [
  [3.14159, 2, '3.14'],
  [3.14159, 3, '3.142'],
  [3.14159, 1, '3.1'],
  [10.0, 2, '10'],
  [10.00100, 3, '10.001'],
  [0.00001, 4, '0'],
  [0.00001, 5, '0.00001'],
  [-0.0, 2, '0'],
  [100.999, 2, '101'],
];

let passed = 0;
let failed = 0;

for (const [num, precision, expected] of testNumbers) {
  const result = roundNumber(num, precision);
  if (result === expected) {
    console.log(`✓ roundNumber(${num}, ${precision}) = ${result}`);
    passed++;
  } else {
    console.log(
      `✗ roundNumber(${num}, ${precision}) = ${result} (expected ${expected})`
    );
    failed++;
  }
}

// Test 2: Color optimization
console.log('\n📊 Test 2: Color Optimization');
console.log('-'.repeat(60));

const testColors = [
  ['#ffffff', '#fff'],
  ['#FFFFFF', '#fff'],
  ['#ff0000', '#f00'],
  ['#ff6347', '#ff6347'], // Can't shorten (tomato)
  ['white', '#fff'],
  ['red', '#f00'],
  ['rgb(255, 0, 0)', '#f00'],
  ['rgb(255, 99, 71)', '#ff6347'],
  ['rgba(255, 0, 0, 1)', '#f00'],
  ['rgba(255, 0, 0, 1.0)', '#f00'],
  ['#808080', 'gray'], // Named is shorter
];

for (const [input, expected] of testColors) {
  const result = optimizeColor(input);
  if (result === expected) {
    console.log(`✓ optimizeColor('${input}') = '${result}'`);
    passed++;
  } else {
    console.log(
      `✗ optimizeColor('${input}') = '${result}' (expected '${expected}')`
    );
    failed++;
  }
}

// Test 3: Full SVG optimization
console.log('\n📊 Test 3: Full SVG Numeric Optimization');
console.log('-'.repeat(60));

const testSVG = `<svg width="200.000" height="100.500" viewBox="0 0 200.000 100.500">
  <circle cx="50.12345" cy="50.67890" r="20.00000" fill="#FF0000" stroke="black" opacity="1" />
  <rect x="100.999" y="10.001" width="50" height="30.5" fill="rgb(0, 255, 0)" stroke="none" />
  <path d="M 10.123 20.456 L 30.789 40.012" stroke="#ffffff" stroke-width="2.0000" />
  <polygon points="150.5 10.25 160.75 30.5 140.25 30.5" fill="white" />
</svg>`;

const tree = parseSVG(testSVG);
const config = {
  floatPrecision: 2,
  removeUnnecessaryAttrs: true,
  shortenColors: true,
};

console.log('Input size:', testSVG.length, 'bytes');

const stats = optimizeNumericValues(tree, config);
console.log('Optimized attributes:', stats.optimizedAttributes);
console.log('Removed defaults:', stats.removedDefaults);

const optimized = serializeSVGMinified(tree);
console.log('Output size:', optimized.length, 'bytes');
console.log(
  'Reduction:',
  (((testSVG.length - optimized.length) / testSVG.length) * 100).toFixed(2) +
    '%'
);

console.log('\nOptimized SVG:');
console.log(optimized);

// Expected optimizations:
console.log('\nExpected optimizations:');
console.log('  ✓ 200.000 → 200');
console.log('  ✓ 100.500 → 100.5');
console.log('  ✓ 50.12345 → 50.12');
console.log('  ✓ 20.00000 → 20');
console.log('  ✓ #FF0000 → #f00');
console.log('  ✓ opacity="1" → removed (default)');
console.log('  ✓ rgb(0, 255, 0) → #0f0');
console.log('  ✓ stroke="none" → removed (default)');
console.log('  ✓ #ffffff → #fff');
console.log('  ✓ 2.0000 → 2');
console.log('  ✓ white → #fff');
console.log('  ✓ Points list optimized');

// Test 4: Path data optimization
console.log('\n📊 Test 4: Path Data Optimization');
console.log('-'.repeat(60));

const pathTestSVG = `<svg>
  <path d="M 10.12345 20.67890 L 30.11111 40.99999 C 50.00000 60.12345 70.5 80.25 90.0 100.0 Z" />
</svg>`;

const pathTree = parseSVG(pathTestSVG);
const pathConfig = { floatPrecision: 2, removeUnnecessaryAttrs: false };

console.log('Input:', pathTestSVG.length, 'bytes');
optimizeNumericValues(pathTree, pathConfig);
const pathOptimized = serializeSVGMinified(pathTree);
console.log('Output:', pathOptimized.length, 'bytes');
console.log('Result:', pathOptimized);

// Summary
console.log('\n' + '='.repeat(60));
console.log('📈 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Passed: ${passed}/${passed + failed} tests`);

if (failed === 0) {
  console.log('\n✅ All numeric optimization tests passed!');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed`);
}
