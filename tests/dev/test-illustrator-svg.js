#!/usr/bin/env node

import { parseSVG } from './dist/optimizers/svg-tree-parser.js';
import { transformCollapsingStage } from './dist/optimizers/transform-collapsing.js';
import { serializeSVG } from './dist/optimizers/tree-serializer.js';

console.log('🎨 Real-World Illustrator SVG Test\n');

// Typical Illustrator export with nested groups
const illustratorSVG = `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="translate(50,50)">
    <g transform="scale(0.8)">
      <g id="icon-layer-1">
        <g transform="translate(-10,-10)">
          <rect x="0" y="0" width="20" height="20" fill="#FF5733"/>
        </g>
        <g transform="translate(10,10)">
          <circle cx="0" cy="0" r="8" fill="#33FF57"/>
        </g>
      </g>
    </g>
  </g>
  <g transform="translate(0,0)">
    <g transform="scale(1)">
      <rect x="10" y="10" width="30" height="30" fill="#3357FF"/>
    </g>
  </g>
</svg>`;

console.log('Input (Typical Illustrator Export):');
console.log(`Size: ${illustratorSVG.length} bytes`);
console.log('- Multiple nested groups');
console.log('- Identity transforms (translate(0,0), scale(1))');
console.log('- Redundant nesting from layer structure\n');

let root = parseSVG(illustratorSVG);
let result = transformCollapsingStage(root, {});
let output = serializeSVG(root);

console.log('Output (After Transform Collapsing):');
console.log(`Size: ${output.length} bytes`);
console.log(`Reduction: ${((1 - output.length / illustratorSVG.length) * 100).toFixed(1)}%`);
console.log(`Savings: ${illustratorSVG.length - output.length} bytes\n`);

console.log('Stats:');
console.log(`- Collapsed Groups: ${result.stats.collapsedGroups}`);
console.log(`- Baked Transforms: ${result.stats.bakedTransforms}`);
console.log(`- Removed Identity: ${result.stats.removedIdentity}\n`);

console.log('Optimized SVG:');
console.log(output);

console.log('\n✅ Real-world Illustrator SVG optimization complete!');
console.log('This demonstrates the power of transform collapsing on exported designs.');
