#!/usr/bin/env node

import { parsePath, serializePath } from './dist/optimizers/path-parser.js';
import {
  mergeConsecutiveCommands,
  convertLtoHV,
  optimizeAbsoluteRelative,
  removeRedundantCommands,
  shortenPath,
} from './dist/optimizers/path-shortener.js';

console.log('✂️  Path Shortener Tests\n');

// Test 1: Merge consecutive L commands
console.log('Test 1: Merge consecutive L commands');
const path1 = 'M10 20 L30 40 L50 60 L70 80';
let parsed = parsePath(path1);
let merged = mergeConsecutiveCommands(parsed.commands);
let result = serializePath(merged, 2);
console.log(`Input:  ${path1} (${path1.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path1.length - result.length} bytes (${((1 - result.length / path1.length) * 100).toFixed(1)}%)\n`);

// Test 2: Convert L to H/V
console.log('Test 2: Convert L to H/V (horizontal/vertical lines)');
const path2 = 'M10 20 L50 20 L50 80 L100 80';
parsed = parsePath(path2);
let optimized = convertLtoHV(parsed.commands, 2);
result = serializePath(optimized, 2);
console.log(`Input:  ${path2} (${path2.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path2.length - result.length} bytes (${((1 - result.length / path2.length) * 100).toFixed(1)}%)\n`);

// Test 3: Optimize absolute/relative
console.log('Test 3: Optimize absolute/relative conversions');
const path3 = 'M100 200 L110 210 L120 220 L130 230';
parsed = parsePath(path3);
optimized = optimizeAbsoluteRelative(parsed.commands, 2);
result = serializePath(optimized, 2);
console.log(`Input:  ${path3} (${path3.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path3.length - result.length} bytes (${((1 - result.length / path3.length) * 100).toFixed(1)}%)\n`);

// Test 4: Remove redundant commands
console.log('Test 4: Remove redundant commands (zero-length moves/lines)');
const path4 = 'M10 20 M10 20 L30 40 L30 40 L50 60';
parsed = parsePath(path4);
optimized = removeRedundantCommands(parsed.commands);
result = serializePath(optimized, 2);
console.log(`Input:  ${path4} (${path4.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path4.length - result.length} bytes (${((1 - result.length / path4.length) * 100).toFixed(1)}%)\n`);

// Test 5: Full shortening pipeline
console.log('Test 5: Full shortening pipeline');
const path5 = 'M10 20 L30 40 L50 40 L50 80 L80 80 L80 110';
parsed = parsePath(path5);
const shortened = shortenPath(parsed.commands, 2);
result = serializePath(shortened.commands, 2);
console.log(`Input:  ${path5} (${path5.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path5.length - result.length} bytes (${((1 - result.length / path5.length) * 100).toFixed(1)}%)`);
console.log(`Stats:`, shortened.stats);
console.log();

// Test 6: Complex real-world path (star icon)
console.log('Test 6: Complex real-world path (star icon)');
const path6 = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
parsed = parsePath(path6);
const shortened6 = shortenPath(parsed.commands, 2);
result = serializePath(shortened6.commands, 2);
console.log(`Input:  ${path6} (${path6.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path6.length - result.length} bytes (${((1 - result.length / path6.length) * 100).toFixed(1)}%)`);
console.log(`Stats:`, shortened6.stats);
console.log();

// Test 7: Relative path optimization
console.log('Test 7: Relative path with small deltas');
const path7 = 'm10 20 l1 1 l1 1 l1 1 l1 1';
parsed = parsePath(path7);
const shortened7 = shortenPath(parsed.commands, 2);
result = serializePath(shortened7.commands, 2);
console.log(`Input:  ${path7} (${path7.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path7.length - result.length} bytes (${((1 - result.length / path7.length) * 100).toFixed(1)}%)`);
console.log(`Stats:`, shortened7.stats);
console.log();

// Test 8: Rectangle (should convert to H/V)
console.log('Test 8: Rectangle path (should use H/V)');
const path8 = 'M10 10 L100 10 L100 50 L10 50 Z';
parsed = parsePath(path8);
const shortened8 = shortenPath(parsed.commands, 2);
result = serializePath(shortened8.commands, 2);
console.log(`Input:  ${path8} (${path8.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path8.length - result.length} bytes (${((1 - result.length / path8.length) * 100).toFixed(1)}%)`);
console.log(`Stats:`, shortened8.stats);
console.log();

// Test 9: Path with curves (should not be affected)
console.log('Test 9: Path with curves (baseline - no L commands)');
const path9 = 'M10 10 C20 20 40 20 50 10 S70 0 80 10';
parsed = parsePath(path9);
const shortened9 = shortenPath(parsed.commands, 2);
result = serializePath(shortened9.commands, 2);
console.log(`Input:  ${path9} (${path9.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Change: ${result.length - path9.length} bytes`);
console.log(`Stats:`, shortened9.stats);
console.log();

// Test 10: Complex icon path
console.log('Test 10: Complex icon path (home icon)');
const path10 = 'M10 20 L10 14 L4 14 L12 6 L20 14 L14 14 L14 20 L10 20 Z';
parsed = parsePath(path10);
const shortened10 = shortenPath(parsed.commands, 2);
result = serializePath(shortened10.commands, 2);
console.log(`Input:  ${path10} (${path10.length} bytes)`);
console.log(`Output: ${result} (${result.length} bytes)`);
console.log(`Reduction: ${path10.length - result.length} bytes (${((1 - result.length / path10.length) * 100).toFixed(1)}%)`);
console.log(`Stats:`, shortened10.stats);
console.log();

console.log('✅ All path shortener tests completed!');
