#!/usr/bin/env node

import {
  parsePath,
  serializePath,
  toAbsolute,
  toRelative,
  compareAbsoluteRelativeSize,
} from './dist/optimizers/path-parser.js';

console.log('🛤️  Path Parser Tests\n');

// Test 1: Basic path parsing
console.log('Test 1: Parse simple path');
const simplePath = 'M10 20 L30 40 L50 60 Z';
let parsed = parsePath(simplePath);
console.log(`Input: ${simplePath}`);
console.log(`Commands parsed: ${parsed.commands.length}`);
console.log('Commands:', parsed.commands.map(c => `${c.type}(${c.values.join(',')})`).join(' '));
console.log();

// Test 2: Mixed absolute/relative
console.log('Test 2: Mixed absolute/relative');
const mixedPath = 'M10 20 l10 10 L50 60 h20 V100 z';
parsed = parsePath(mixedPath);
console.log(`Input: ${mixedPath}`);
console.log(`Commands parsed: ${parsed.commands.length}`);
parsed.commands.forEach(cmd => {
  const abs = cmd.absolutePosition;
  console.log(`  ${cmd.type}(${cmd.values.join(',')}) → pos: (${abs.x}, ${abs.y})`);
});
console.log();

// Test 3: Cubic Bézier curves
console.log('Test 3: Cubic Bézier curves');
const curvePath = 'M10 10 C20 20, 40 20, 50 10 S70 0, 80 10';
parsed = parsePath(curvePath);
console.log(`Input: ${curvePath}`);
console.log(`Commands parsed: ${parsed.commands.length}`);
parsed.commands.forEach(cmd => {
  console.log(`  ${cmd.type}(${cmd.values.join(', ')})`);
});
console.log();

// Test 4: Absolute to relative conversion
console.log('Test 4: Convert absolute → relative');
const absPath = 'M10 20 L30 40 L50 60';
parsed = parsePath(absPath);
let prevX = 0;
let prevY = 0;
const relativeCommands = [];
for (const cmd of parsed.commands) {
  const relCmd = toRelative(cmd, prevX, prevY);
  relativeCommands.push(relCmd);
  prevX = cmd.absolutePosition.x;
  prevY = cmd.absolutePosition.y;
}
const relativeSerialized = serializePath(relativeCommands, 2);
console.log(`Absolute: ${absPath}`);
console.log(`Relative: ${relativeSerialized}`);
console.log(`Size: ${absPath.length} → ${relativeSerialized.length} bytes (${((1 - relativeSerialized.length / absPath.length) * 100).toFixed(1)}% reduction)`);
console.log();

// Test 5: Relative to absolute conversion
console.log('Test 5: Convert relative → absolute');
const relPath = 'm10 20 l20 20 l20 20';
parsed = parsePath(relPath);
prevX = 0;
prevY = 0;
const absoluteCommands = [];
for (const cmd of parsed.commands) {
  const absCmd = toAbsolute(cmd, prevX, prevY);
  absoluteCommands.push(absCmd);
  prevX = cmd.absolutePosition.x;
  prevY = cmd.absolutePosition.y;
}
const absoluteSerialized = serializePath(absoluteCommands, 2);
console.log(`Relative: ${relPath}`);
console.log(`Absolute: ${absoluteSerialized}`);
console.log(`Size: ${relPath.length} → ${absoluteSerialized.length} bytes`);
console.log();

// Test 6: Size comparison
console.log('Test 6: Smart absolute/relative size comparison');
const testPath = 'M100 200 L110 210 L120 220';
parsed = parsePath(testPath);
prevX = 0;
prevY = 0;
for (let i = 0; i < parsed.commands.length; i++) {
  const cmd = parsed.commands[i];
  const diff = compareAbsoluteRelativeSize(cmd, prevX, prevY, 2);
  
  console.log(`  Command ${i + 1} (${cmd.type}):`);
  console.log(`    Absolute: ${serializePath([toAbsolute(cmd, prevX, prevY)], 2)}`);
  console.log(`    Relative: ${serializePath([toRelative(cmd, prevX, prevY)], 2)}`);
  console.log(`    Shorter: ${diff > 0 ? 'relative' : diff < 0 ? 'absolute' : 'same'} (diff: ${Math.abs(diff)} bytes)`);
  
  prevX = cmd.absolutePosition.x;
  prevY = cmd.absolutePosition.y;
}
console.log();

// Test 7: Arc commands
console.log('Test 7: Arc commands');
const arcPath = 'M10 10 A5 5 0 0 1 20 10';
parsed = parsePath(arcPath);
console.log(`Input: ${arcPath}`);
console.log(`Commands parsed: ${parsed.commands.length}`);
parsed.commands.forEach(cmd => {
  console.log(`  ${cmd.type}(${cmd.values.join(', ')})`);
});
console.log();

// Test 8: Horizontal/Vertical lines
console.log('Test 8: Horizontal and vertical lines');
const hvPath = 'M10 10 H50 V50 h20 v20';
parsed = parsePath(hvPath);
console.log(`Input: ${hvPath}`);
console.log(`Commands parsed: ${parsed.commands.length}`);
parsed.commands.forEach(cmd => {
  const abs = cmd.absolutePosition;
  console.log(`  ${cmd.type}(${cmd.values.join(',')}) → pos: (${abs.x}, ${abs.y})`);
});
console.log();

// Test 9: Compact path (no spaces)
console.log('Test 9: Compact path (no spaces)');
const compactPath = 'M10,20L30,40L50,60Z';
parsed = parsePath(compactPath);
console.log(`Input: ${compactPath}`);
console.log(`Commands parsed: ${parsed.commands.length}`);
const serialized = serializePath(parsed.commands, 2);
console.log(`Serialized: ${serialized}`);
console.log(`Size: ${compactPath.length} → ${serialized.length} bytes`);
console.log();

// Test 10: Scientific notation
console.log('Test 10: Scientific notation');
const scientificPath = 'M1.5e2 2.5e2 L1.6e2 2.6e2';
parsed = parsePath(scientificPath);
console.log(`Input: ${scientificPath}`);
console.log(`Commands parsed: ${parsed.commands.length}`);
console.log('Parsed values:', parsed.commands.map(c => c.values));
const serialized2 = serializePath(parsed.commands, 1);
console.log(`Serialized: ${serialized2}`);
console.log();

// Test 11: Complex real-world path
console.log('Test 11: Complex real-world path');
const complexPath = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
parsed = parsePath(complexPath);
console.log(`Input: ${complexPath} (${complexPath.length} bytes)`);
console.log(`Commands parsed: ${parsed.commands.length}`);
const serialized3 = serializePath(parsed.commands, 2);
console.log(`Serialized: ${serialized3} (${serialized3.length} bytes)`);
console.log(`Reduction: ${((1 - serialized3.length / complexPath.length) * 100).toFixed(1)}%`);
console.log();

console.log('✅ All path parser tests completed!');
