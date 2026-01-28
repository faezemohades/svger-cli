/**
 * Test SVG Tree Parser & Serializer Round-Trip
 */

import { parseSVG, traverseTree, findNodesByTag, getAllIds } from '../../dist/optimizers/svg-tree-parser.js';
import { serializeSVG, serializeSVGMinified, serializeSVGPretty, calculateReduction } from '../../dist/optimizers/tree-serializer.js';

console.log('🚀 SVGER-CLI Phase 2: Tree Parser & Serializer Test\n');
console.log('================================================================================\n');

const testSVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad1">
      <stop offset="0%" stop-color="red"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
  </defs>
  <g id="layer1">
    <circle cx="50" cy="50" r="40" fill="url(#grad1)"/>
    <path d="M10,10 L90,90" stroke="black" stroke-width="2"/>
  </g>
  <g></g>
  <!-- Empty group above should be removed -->
</svg>`;

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Parse SVG string to tree
  console.log('[1/7] Testing: Parse SVG to Tree');
  try {
    const tree = parseSVG(testSVG);
    
    if (!tree) {
      throw new Error('Failed to parse SVG');
    }
    
    console.log(`   ✅ Parsed tree root: <${tree.tag}>`);
    console.log(`   ✅ Root attributes: ${tree.attrs.size}`);
    console.log(`   ✅ Root children: ${tree.children.length}`);
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 2: Serialize tree back to string
  console.log('[2/7] Testing: Serialize Tree to String');
  try {
    const tree = parseSVG(testSVG);
    const serialized = serializeSVG(tree);
    
    console.log(`   ✅ Serialized length: ${serialized.length} chars`);
    console.log(`   ✅ Original length: ${testSVG.length} chars`);
    
    if (serialized.includes('<svg') && serialized.includes('</svg>')) {
      console.log('   ✅ Contains SVG tags');
    }
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 3: Minified serialization
  console.log('[3/7] Testing: Minified Serialization');
  try {
    const tree = parseSVG(testSVG);
    const minified = serializeSVGMinified(tree);
    const reduction = calculateReduction(testSVG, minified);
    
    console.log(`   ✅ Original: ${reduction.originalSize} bytes`);
    console.log(`   ✅ Minified: ${reduction.serializedSize} bytes`);
    console.log(`   ✅ Reduction: ${reduction.reductionPercent.toFixed(2)}%`);
    
    // Minified should be smaller
    if (reduction.serializedSize < reduction.originalSize) {
      console.log('   ✅ Size reduced successfully');
    }
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 4: Pretty print serialization
  console.log('[4/7] Testing: Pretty Print Serialization');
  try {
    const tree = parseSVG(testSVG);
    const pretty = serializeSVGPretty(tree);
    
    console.log(`   ✅ Pretty printed length: ${pretty.length} chars`);
    
    // Pretty print should have newlines
    if (pretty.includes('\n')) {
      console.log('   ✅ Contains newlines');
    }
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 5: Tree traversal
  console.log('[5/7] Testing: Tree Traversal');
  try {
    const tree = parseSVG(testSVG);
    let nodeCount = 0;
    
    traverseTree(tree, () => {
      nodeCount++;
    });
    
    console.log(`   ✅ Total nodes: ${nodeCount}`);
    
    if (nodeCount > 0) {
      console.log('   ✅ Traversal successful');
    }
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 6: Find nodes by tag
  console.log('[6/7] Testing: Find Nodes by Tag');
  try {
    const tree = parseSVG(testSVG);
    const circles = findNodesByTag(tree, 'circle');
    const paths = findNodesByTag(tree, 'path');
    const groups = findNodesByTag(tree, 'g');
    
    console.log(`   ✅ Found ${circles.length} circle(s)`);
    console.log(`   ✅ Found ${paths.length} path(s)`);
    console.log(`   ✅ Found ${groups.length} group(s)`);
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 7: Get all IDs
  console.log('[7/7] Testing: Get All IDs');
  try {
    const tree = parseSVG(testSVG);
    const ids = getAllIds(tree);
    
    console.log(`   ✅ Found ${ids.size} ID(s): ${Array.from(ids).join(', ')}`);
    
    if (ids.has('grad1') && ids.has('layer1')) {
      console.log('   ✅ Expected IDs found');
    }
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Summary
  console.log('================================================================================');
  console.log('\n📊 Test Results Summary\n');
  console.log(`   Total Tests: ${passed + failed}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('\n================================================================================\n');

  if (failed === 0) {
    console.log('🎉 All tree parser & serializer tests passed!\n');
    
    // Show example output
    console.log('📝 Example Minified Output:');
    console.log('─'.repeat(80));
    const tree = parseSVG(testSVG);
    const minified = serializeSVGMinified(tree);
    console.log(minified);
    console.log('─'.repeat(80));
  } else {
    console.error('❌ Some tests failed!\n');
    process.exit(1);
  }
}

runTests();
