#!/usr/bin/env node

import { parseSVG } from './dist/optimizers/svg-tree-parser.js';
import { styleOptimizationStage } from './dist/optimizers/style-optimizer.js';
import { serializeSVG } from './dist/optimizers/tree-serializer.js';

console.log('🎨 Style Optimizer Tests\n');

// Test 1: CSS Minification
console.log('Test 1: CSS Minification');
const svgWithStyle = `<svg xmlns="http://www.w3.org/2000/svg">
  <style>
    /* Comment to remove */
    .cls-1 {
      fill: red;
      stroke: blue;
    }
    .cls-2   {   stroke-width  :  2px  ;   opacity  :  0.5  ;  }
  </style>
  <rect class="cls-1" width="100" height="100"/>
</svg>`;

let root = parseSVG(svgWithStyle);
let result = styleOptimizationStage(root, {});
let output = serializeSVG(root);

console.log(`Input size: ${svgWithStyle.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svgWithStyle.length) * 100).toFixed(2)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 2: Convert style to attributes (should save space)
console.log('Test 2: Convert style → attributes');
const svgStyleToAttrs = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect style="fill:red;stroke:blue;stroke-width:2" width="100" height="100"/>
</svg>`;

root = parseSVG(svgStyleToAttrs);
result = styleOptimizationStage(root, { inlineStyles: false });
output = serializeSVG(root);

console.log(`Input size: ${svgStyleToAttrs.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svgStyleToAttrs.length) * 100).toFixed(2)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 3: Convert attributes to style (when beneficial)
console.log('Test 3: Convert attributes → style (when beneficial)');
const svgAttrsToStyle = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect fill="red" stroke="blue" stroke-width="2" opacity="0.8" width="100" height="100"/>
</svg>`;

root = parseSVG(svgAttrsToStyle);
result = styleOptimizationStage(root, { inlineStyles: true });
output = serializeSVG(root);

console.log(`Input size: ${svgAttrsToStyle.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / svgAttrsToStyle.length) * 100).toFixed(2)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 4: Auto mode (choose best)
console.log('Test 4: Auto mode (choose best representation)');
const svgAuto1 = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect fill="red" stroke="blue" width="100" height="100"/>
</svg>`;

root = parseSVG(svgAuto1);
result = styleOptimizationStage(root, {}); // Auto mode
output = serializeSVG(root);

console.log(`Input size: ${svgAuto1.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Change: ${output.length - svgAuto1.length > 0 ? '+' : ''}${output.length - svgAuto1.length} bytes`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

// Test 5: Complex SVG with multiple elements
console.log('Test 5: Complex SVG with styles + attributes');
const complexSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <style>
    /* Header comment */
    .shape   {   fill  :  #ff0000  ;   stroke  :  #0000ff  ;  }
    .text    {    font-size   :   16px   ;   }
  </style>
  <rect class="shape" x="10" y="10" width="80" height="80" opacity="0.5"/>
  <circle style="fill:green;stroke:yellow;stroke-width:3" cx="100" cy="100" r="40"/>
  <text class="text" x="50" y="180" fill="black">Hello</text>
</svg>`;

root = parseSVG(complexSVG);
result = styleOptimizationStage(root, {});
output = serializeSVG(root);

console.log(`Input size: ${complexSVG.length} bytes`);
console.log(`Output size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / complexSVG.length) * 100).toFixed(2)}%`);
console.log(`Modified: ${result.modified}`);
console.log(`Stats:`, result.stats);
console.log(`Output:\n${output}\n`);

console.log('✅ All style optimizer tests completed!');
