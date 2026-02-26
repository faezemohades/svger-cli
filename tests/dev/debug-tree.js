#!/usr/bin/env node

/**
 * Debug tree optimization to see what's being removed
 */

import { parseSVG } from './dist/optimizers/svg-tree-parser.js';
import { serializeSVGMinified, serializeSVGPretty } from './dist/optimizers/tree-serializer.js';
import { 
  removeUnusedDefs, 
  collapseUselessGroups, 
  moveAttributesToParent,
  removeHiddenAndEmptyElements 
} from './dist/optimizers/index.js';

const svg = `<svg width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="usedGrad">
      <stop offset="0%" stopColor="#f00"/>
      <stop offset="100%" stopColor="#0f0"/>
    </linearGradient>
    <linearGradient id="unusedGrad">
      <stop offset="0%" stopColor="#00f"/>
      <stop offset="100%" stopColor="#f0f"/>
    </linearGradient>
  </defs>
  <g style="display:none">
    <circle cx="100" cy="100" r="50"/>
  </g>
  <rect x="10" y="10" width="50" height="50" style="visibility:hidden"/>
  <g>
    <g>
      <circle cx="50" cy="50" r="20" fill="url(#usedGrad)"/>
    </g>
  </g>
  <g>
    <rect x="0" y="0" width="10" height="10" fill="red" opacity="0.5"/>
    <rect x="20" y="0" width="10" height="10" fill="red" opacity="0.5"/>
    <rect x="40" y="0" width="10" height="10" fill="red" opacity="0.5"/>
  </g>
  <text></text>
  <g></g>
  <path d="M 10 10 L 20 20" fill="blue" stroke="black"/>
</svg>`;

console.log('Original SVG:', svg.length, 'bytes\n');

// Parse
const tree = parseSVG(svg);
console.log('✓ Parsed tree');
console.log('Children of root:', tree.children.length);

// Serialize to see what we started with
const initial = serializeSVGMinified(tree);
console.log('Initial serialized:', initial.length, 'bytes');
console.log('Initial output (first 200 chars):', initial.substring(0, 200), '\n');

// Stage 1: Remove unused defs
console.log('Stage 1: Remove unused defs');
const defsResult = removeUnusedDefs(tree);
console.log('  Removed:', defsResult.removedCount, 'defs');
const afterDefs = serializeSVGMinified(tree);
console.log('  Size:', afterDefs.length, 'bytes');
console.log('  Output (first 200 chars):', afterDefs.substring(0, 200), '\n');

// Stage 2: Remove hidden/empty
console.log('Stage 2: Remove hidden/empty elements');
const hiddenResult = removeHiddenAndEmptyElements(tree);
console.log('  Removed:', hiddenResult.removedCount, 'elements');
console.log('  Details:', JSON.stringify(hiddenResult.removedNodes, null, 2));
const afterHidden = serializeSVGMinified(tree);
console.log('  Size:', afterHidden.length, 'bytes');
console.log('  Children of root:', tree.children.length);
console.log('  Output:', afterHidden, '\n');

// Stage 3: Collapse groups
console.log('Stage 3: Collapse useless groups');
const groupsResult = collapseUselessGroups(tree);
console.log('  Collapsed:', groupsResult.collapsedCount, 'groups');
const afterGroups = serializeSVGMinified(tree);
console.log('  Size:', afterGroups.length, 'bytes');
console.log('  Output:', afterGroups, '\n');

// Stage 4: Move attributes
console.log('Stage 4: Move attributes to parent');
const attrsResult = moveAttributesToParent(tree);
console.log('  Moved:', attrsResult.movedCount, 'attributes');
const final = serializeSVGMinified(tree);
console.log('  Final size:', final.length, 'bytes');
console.log('  Final output:', final);
