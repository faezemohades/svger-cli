#!/usr/bin/env node

/**
 * Phase 2 Tree-Based Optimization Test
 * Tests all optimization levels and measures improvements
 */

import { parseSVG } from './dist/optimizers/svg-tree-parser.js';
import { serializeSVGMinified } from './dist/optimizers/tree-serializer.js';
import { 
  removeUnusedDefs, 
  collapseUselessGroups, 
  moveAttributesToParent,
  removeHiddenAndEmptyElements 
} from './dist/optimizers/index.js';
import { OptimizerPipeline, OptLevel, basicCleaningStage } from './dist/optimizers/index.js';
import { treeOptimizationStage } from './dist/optimizers/tree-stages.js';

// Complex test SVG with optimization opportunities
const complexSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="usedGrad">
      <stop offset="0%" stop-color="#ff0000"/>
      <stop offset="100%" stop-color="#00ff00"/>
    </linearGradient>
    <linearGradient id="unusedGrad">
      <stop offset="0%" stop-color="#0000ff"/>
      <stop offset="100%" stop-color="#ff00ff"/>
    </linearGradient>
    <filter id="unusedFilter">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
  </defs>
  
  <!-- Hidden elements -->
  <g style="display:none">
    <circle cx="100" cy="100" r="50"/>
  </g>
  <rect x="10" y="10" width="50" height="50" style="visibility:hidden"/>
  
  <!-- Useless groups (no attributes, single child) -->
  <g>
    <g>
      <circle cx="50" cy="50" r="20" fill="url(#usedGrad)"/>
    </g>
  </g>
  
  <!-- Duplicate attributes that can be hoisted -->
  <g>
    <rect x="0" y="0" width="10" height="10" fill="red" opacity="0.5"/>
    <rect x="20" y="0" width="10" height="10" fill="red" opacity="0.5"/>
    <rect x="40" y="0" width="10" height="10" fill="red" opacity="0.5"/>
  </g>
  
  <!-- Empty elements -->
  <text></text>
  <g></g>
  
  <!-- Whitespace and comments -->
  <!-- This is a comment that should be removed -->
  <path d="M 10 10 L 20 20" fill="blue"   stroke="black"   />
  
</svg>`;

console.log('🧪 Phase 2: Tree-Based Optimization Test\n');
console.log('=' .repeat(60));

// Helper to calculate reduction
function calculateReduction(original, optimized) {
  const origSize = typeof original === 'number' ? original : original.length;
  const optSize = typeof optimized === 'number' ? optimized : optimized.length;
  const reduction = ((origSize - optSize) / origSize) * 100;
  return reduction.toFixed(2);
}

// Test 1: Baseline (no optimization)
console.log('\n📊 Test 1: Baseline (No Optimization)');
console.log('-'.repeat(60));
const originalSize = complexSVG.length;
console.log(`Original size: ${originalSize} bytes`);

// Test 2: Phase 1 (BASIC - regex only)
console.log('\n📊 Test 2: Phase 1 - BASIC Level (Regex Cleaning)');
console.log('-'.repeat(60));
const phase1Pipeline = new OptimizerPipeline({ level: OptLevel.BASIC });
phase1Pipeline.registerStage('basic-cleaning', basicCleaningStage);
const phase1ResultObj = await phase1Pipeline.optimize(complexSVG);
const phase1Result = phase1ResultObj.optimizedSvg;
console.log(`Phase 1 size: ${phase1Result.length} bytes`);
console.log(`Phase 1 reduction: ${calculateReduction(originalSize, phase1Result.length)}%`);
// Write to file to inspect
import('fs').then(fs => {
  fs.writeFileSync('/tmp/phase1-output.svg', phase1Result);
  console.log('Wrote Phase 1 output to /tmp/phase1-output.svg');
});

// Test 3: Phase 2 - BALANCED (regex + tree)
console.log('\n📊 Test 3: Phase 2 - BALANCED Level (Regex + Tree)');
console.log('-'.repeat(60));
const balancedPipeline = new OptimizerPipeline({ level: OptLevel.BALANCED });
balancedPipeline.registerStage('basic-cleaning', basicCleaningStage);
balancedPipeline.registerStage('tree-optimization', treeOptimizationStage);
const balancedResultObj = await balancedPipeline.optimize(complexSVG);
const balancedResult = balancedResultObj.optimizedSvg;
console.log(`Balanced size: ${balancedResult.length} bytes`);
console.log(`Balanced reduction: ${calculateReduction(originalSize, balancedResult.length)}%`);
console.log(`Improvement over Phase 1: ${calculateReduction(phase1Result.length, balancedResult.length)}%`);
// Write to file to inspect
import('fs').then(fs => {
  fs.writeFileSync('/tmp/balanced-output.svg', balancedResult);
  console.log('Wrote balanced output to /tmp/balanced-output.svg');
});

// Test 4: Individual tree optimization stages
console.log('\n📊 Test 4: Individual Tree Optimization Stages');
console.log('-'.repeat(60));

// Parse the SVG
const tree = parseSVG(complexSVG);
console.log(`✓ Parsed SVG into tree structure`);

// Stage 1: Remove unused defs
const defsResult = removeUnusedDefs(tree);
console.log(`✓ Remove unused defs: ${defsResult.stats?.removed || 0} items removed`);

// Stage 2: Collapse useless groups
const groupsResult = collapseUselessGroups(tree);
console.log(`✓ Collapse useless groups: ${groupsResult.stats?.collapsed || 0} groups collapsed`);

// Stage 3: Move attributes to parent
const attrsResult = moveAttributesToParent(tree);
console.log(`✓ Move attributes to parent: ${attrsResult.stats?.moved || 0} attributes hoisted`);

// Stage 4: Remove hidden/empty elements
const hiddenResult = removeHiddenAndEmptyElements(tree);
console.log(`✓ Remove hidden/empty: ${hiddenResult.stats?.removed || 0} elements removed`);

// Serialize the optimized tree
const manualOptimized = serializeSVGMinified(tree);
console.log(`\nManual optimization size: ${manualOptimized.length} bytes`);
console.log(`Manual optimization reduction: ${calculateReduction(originalSize, manualOptimized.length)}%`);

// Test 5: Aggressive level
console.log('\n📊 Test 5: Phase 2 - AGGRESSIVE Level');
console.log('-'.repeat(60));
const aggressivePipeline = new OptimizerPipeline({ level: OptLevel.AGGRESSIVE });
aggressivePipeline.registerStage('basic-cleaning', basicCleaningStage);
aggressivePipeline.registerStage('tree-optimization', treeOptimizationStage);
const aggressiveResultObj = await aggressivePipeline.optimize(complexSVG);
const aggressiveResult = aggressiveResultObj.optimizedSvg;
console.log(`Aggressive size: ${aggressiveResult.length} bytes`);
console.log(`Aggressive reduction: ${calculateReduction(originalSize, aggressiveResult.length)}%`);
console.log(`Improvement over Phase 1: ${calculateReduction(phase1Result.length, aggressiveResult.length)}%`);

// Test 6: Maximum level
console.log('\n📊 Test 6: Phase 2 - MAXIMUM Level');
console.log('-'.repeat(60));
const maximumPipeline = new OptimizerPipeline({ level: OptLevel.MAXIMUM });
maximumPipeline.registerStage('basic-cleaning', basicCleaningStage);
maximumPipeline.registerStage('tree-optimization', treeOptimizationStage);
const maximumResultObj = await maximumPipeline.optimize(complexSVG);
const maximumResult = maximumResultObj.optimizedSvg;
console.log(`Maximum size: ${maximumResult.length} bytes`);
console.log(`Maximum reduction: ${calculateReduction(originalSize, maximumResult.length)}%`);
console.log(`Improvement over Phase 1: ${calculateReduction(phase1Result.length, maximumResult.length)}%`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('📈 PHASE 2 SUMMARY');
console.log('='.repeat(60));
console.log(`Original size:        ${originalSize} bytes`);
console.log(`Phase 1 (BASIC):      ${phase1Result.length} bytes (-${calculateReduction(originalSize, phase1Result.length)}%)`);
console.log(`Phase 2 (BALANCED):   ${balancedResult.length} bytes (-${calculateReduction(originalSize, balancedResult.length)}%)`);
console.log(`Phase 2 (AGGRESSIVE): ${aggressiveResult.length} bytes (-${calculateReduction(originalSize, aggressiveResult.length)}%)`);
console.log(`Phase 2 (MAXIMUM):    ${maximumResult.length} bytes (-${calculateReduction(originalSize, maximumResult.length)}%)`);
console.log('\n🎯 TARGET: 20-40% improvement over Phase 1');

const balancedImprovement = parseFloat(calculateReduction(phase1Result.length, balancedResult.length));
const aggressiveImprovement = parseFloat(calculateReduction(phase1Result.length, aggressiveResult.length));
const maximumImprovement = parseFloat(calculateReduction(phase1Result.length, maximumResult.length));

console.log(`   BALANCED improvement:   ${balancedImprovement.toFixed(2)}%`);
console.log(`   AGGRESSIVE improvement: ${aggressiveImprovement.toFixed(2)}%`);
console.log(`   MAXIMUM improvement:    ${maximumImprovement.toFixed(2)}%`);

if (maximumImprovement >= 20) {
  console.log('\n✅ Phase 2 target ACHIEVED!');
} else {
  console.log('\n⚠️  Phase 2 target NOT MET (need more optimization)');
}

console.log('\n' + '='.repeat(60));
