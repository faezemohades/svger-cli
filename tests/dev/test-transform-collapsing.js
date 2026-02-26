#!/usr/bin/env node

import { parseSVG } from './dist/optimizers/svg-tree-parser.js';
import { transformCollapsingStage } from './dist/optimizers/transform-collapsing.js';
import { serializeSVG } from './dist/optimizers/tree-serializer.js';

console.log('🔄 Transform Collapsing Tests\n');

// Test 1: Simple group with transform
console.log('Test 1: Bake transform into rect');
const svg1 = `<svg xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(10, 20)">
    <rect x="5" y="10" width="100" height="50"/>
  </g>
</svg>`;

let root = parseSVG(svg1);
let result = transformCollapsingStage(root, {});
let output = serializeSVG(root);

console.log(`Input size: ${svg1.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svg1.length) * 100).toFixed(1)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 2: Nested transforms
console.log('Test 2: Collapse nested group transforms');
const svg2 = `<svg xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(10, 10)">
    <g transform="translate(5, 5)">
      <rect x="0" y="0" width="100" height="50"/>
    </g>
  </g>
</svg>`;

root = parseSVG(svg2);
result = transformCollapsingStage(root, {});
output = serializeSVG(root);

console.log(`Input size: ${svg2.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svg2.length) * 100).toFixed(1)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 3: Transform on circle (uniform scale)
console.log('Test 3: Bake uniform scale + translate into circle');
const svg3 = `<svg xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(50, 50) scale(2)">
    <circle cx="25" cy="25" r="10"/>
  </g>
</svg>`;

root = parseSVG(svg3);
result = transformCollapsingStage(root, {});
output = serializeSVG(root);

console.log(`Input size: ${svg3.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svg3.length) * 100).toFixed(1)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 4: Transform on line
console.log('Test 4: Bake transform into line coordinates');
const svg4 = `<svg xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(20, 30)">
    <line x1="0" y1="0" x2="100" y2="50"/>
  </g>
</svg>`;

root = parseSVG(svg4);
result = transformCollapsingStage(root, {});
output = serializeSVG(root);

console.log(`Input size: ${svg4.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svg4.length) * 100).toFixed(1)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 5: Transform on polygon
console.log('Test 5: Bake transform into polygon points');
const svg5 = `<svg xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(10, 20)">
    <polygon points="0 0, 50 0, 25 50"/>
  </g>
</svg>`;

root = parseSVG(svg5);
result = transformCollapsingStage(root, {});
output = serializeSVG(root);

console.log(`Input size: ${svg5.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svg5.length) * 100).toFixed(1)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 6: Identity transform removal
console.log('Test 6: Remove identity transforms');
const svg6 = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect transform="translate(0, 0)" x="10" y="20" width="100" height="50"/>
  <circle transform="scale(1)" cx="50" cy="50" r="20"/>
</svg>`;

root = parseSVG(svg6);
result = transformCollapsingStage(root, {});
output = serializeSVG(root);

console.log(`Input size: ${svg6.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svg6.length) * 100).toFixed(1)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 7: Complex Illustrator-style nested groups
console.log('Test 7: Complex nested transforms (Illustrator export style)');
const svg7 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g transform="translate(100, 100)">
    <g transform="scale(0.5)">
      <g transform="rotate(45)">
        <rect x="-25" y="-25" width="50" height="50" fill="red"/>
      </g>
    </g>
  </g>
</svg>`;

root = parseSVG(svg7);
result = transformCollapsingStage(root, {});
output = serializeSVG(root);

console.log(`Input size: ${svg7.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svg7.length) * 100).toFixed(1)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 8: Multiple shapes in one group
console.log('Test 8: Group with multiple shapes (no collapse)');
const svg8 = `<svg xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(10, 20)">
    <rect x="0" y="0" width="50" height="50"/>
    <circle cx="75" cy="25" r="20"/>
  </g>
</svg>`;

root = parseSVG(svg8);
result = transformCollapsingStage(root, {});
output = serializeSVG(root);

console.log(`Input size: ${svg8.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Change: ${output.length - svg8.length} bytes`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

console.log('✅ All transform collapsing tests completed!');
