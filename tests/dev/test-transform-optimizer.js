#!/usr/bin/env node

import { parseSVG } from './dist/optimizers/svg-tree-parser.js';
import { transformOptimizationStage } from './dist/optimizers/transform-optimizer.js';
import { serializeSVG } from './dist/optimizers/tree-serializer.js';

console.log('🔄 Transform Optimizer Tests\n');

// Test 1: Identity transform removal
console.log('Test 1: Remove identity transforms');
const svgIdentity = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect transform="translate(0 0)" width="100" height="100"/>
  <circle transform="scale(1)" cx="50" cy="50" r="20"/>
  <path transform="rotate(0)" d="M10 10 L20 20"/>
</svg>`;

let root = parseSVG(svgIdentity);
let result = transformOptimizationStage(root, { floatPrecision: 3 });
let output = serializeSVG(root);

console.log(`Input size: ${svgIdentity.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svgIdentity.length) * 100).toFixed(2)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 2: Round transform values
console.log('Test 2: Round transform values');
const svgRound = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect transform="translate(10.123456 20.987654)" width="100" height="100"/>
  <circle transform="rotate(45.123456)" cx="50" cy="50" r="20"/>
</svg>`;

root = parseSVG(svgRound);
result = transformOptimizationStage(root, { floatPrecision: 2 });
output = serializeSVG(root);

console.log(`Input size: ${svgRound.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svgRound.length) * 100).toFixed(2)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 3: Consolidate multiple transforms
console.log('Test 3: Consolidate multiple transforms');
const svgMultiple = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect transform="translate(10 20) scale(2) rotate(45)" width="100" height="100"/>
</svg>`;

root = parseSVG(svgMultiple);
result = transformOptimizationStage(root, { floatPrecision: 3 });
output = serializeSVG(root);

console.log(`Input size: ${svgMultiple.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Change: ${output.length - svgMultiple.length > 0 ? '+' : ''}${output.length - svgMultiple.length} bytes`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 4: Matrix decomposition
console.log('Test 4: Simplify matrix to simple transforms');
const svgMatrix = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect transform="matrix(1 0 0 1 10 20)" width="100" height="100"/>
  <circle transform="matrix(2 0 0 2 0 0)" cx="50" cy="50" r="20"/>
</svg>`;

root = parseSVG(svgMatrix);
result = transformOptimizationStage(root, { floatPrecision: 3 });
output = serializeSVG(root);

console.log(`Input size: ${svgMatrix.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svgMatrix.length) * 100).toFixed(2)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 5: Complex SVG with various transforms
console.log('Test 5: Complex SVG with transforms');
const complexSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g transform="translate(100 100)">
    <rect transform="rotate(45.123) scale(1.5)" x="-25" y="-25" width="50" height="50" fill="red"/>
    <circle transform="matrix(1 0 0 1 0 0)" cx="0" cy="0" r="10" fill="blue"/>
    <path transform="translate(0.00001 0.00002)" d="M-20 0 L20 0" stroke="black"/>
  </g>
</svg>`;

root = parseSVG(complexSVG);
result = transformOptimizationStage(root, { floatPrecision: 2 });
output = serializeSVG(root);

console.log(`Input size: ${complexSVG.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / complexSVG.length) * 100).toFixed(2)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 6: Rotate with center point
console.log('Test 6: Rotate around center point');
const svgRotateCenter = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect transform="rotate(45 50 50)" width="100" height="100" fill="green"/>
</svg>`;

root = parseSVG(svgRotateCenter);
result = transformOptimizationStage(root, { floatPrecision: 3 });
output = serializeSVG(root);

console.log(`Input size: ${svgRotateCenter.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Change: ${output.length - svgRotateCenter.length > 0 ? '+' : ''}${output.length - svgRotateCenter.length} bytes`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

console.log('✅ All transform optimizer tests completed!');
