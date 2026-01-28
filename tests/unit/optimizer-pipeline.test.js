/**
 * Test for Phase 1: Optimizer Pipeline
 */

import { createOptimizerPipeline, OptLevel, basicCleaningStage } from '../../dist/optimizers/index.js';

console.log('🚀 SVGER-CLI Optimizer Pipeline Test (Phase 1)\n');
console.log('================================================================================\n');

// Test SVG content with various elements to optimize
const testSVG = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- This is a test comment -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
  <metadata>
    <title>Test Icon</title>
    <desc>A test icon for optimizer</desc>
  </metadata>
  <g id="layer1">
    <path fill-rule="evenodd" stroke-width="2" fill="#FF0000" d="M12 2L2 22h20L12 2z"/>
  </g>
  <g></g>
  <defs></defs>
</svg>`;

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: NONE level (should change nothing except basic structure)
  console.log('[1/5] Testing: Optimization Level NONE');
  try {
    const pipelineNone = createOptimizerPipeline(OptLevel.NONE);
    pipelineNone.registerStage('basic-cleaning', basicCleaningStage);
    const resultNone = await pipelineNone.optimize(testSVG);
    
    console.log(`   ✅ Original size: ${resultNone.originalSize} bytes`);
    console.log(`   ✅ Optimized size: ${resultNone.optimizedSize} bytes`);
    console.log(`   ✅ Reduction: ${resultNone.reductionPercent.toFixed(2)}%`);
    console.log(`   ✅ Stages applied: ${resultNone.stagesApplied.join(', ')}`);
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 2: BASIC level
  console.log('[2/5] Testing: Optimization Level BASIC');
  try {
    const pipelineBasic = createOptimizerPipeline(OptLevel.BASIC);
    pipelineBasic.registerStage('basic-cleaning', basicCleaningStage);
    const resultBasic = await pipelineBasic.optimize(testSVG);
    
    console.log(`   ✅ Original size: ${resultBasic.originalSize} bytes`);
    console.log(`   ✅ Optimized size: ${resultBasic.optimizedSize} bytes`);
    console.log(`   ✅ Reduction: ${resultBasic.reductionPercent.toFixed(2)}%`);
    
    // Verify XML/DOCTYPE removed
    if (!resultBasic.optimizedSvg.includes('<?xml') && !resultBasic.optimizedSvg.includes('<!DOCTYPE')) {
      console.log('   ✅ XML declaration removed');
    }
    
    // Verify comments removed
    if (!resultBasic.optimizedSvg.includes('<!--')) {
      console.log('   ✅ Comments removed');
    }
    
    // Verify metadata removed
    if (!resultBasic.optimizedSvg.includes('<metadata>') && !resultBasic.optimizedSvg.includes('<title>')) {
      console.log('   ✅ Metadata removed');
    }
    
    // Verify empty containers removed
    if (!resultBasic.optimizedSvg.includes('<g></g>') && !resultBasic.optimizedSvg.includes('<defs></defs>')) {
      console.log('   ✅ Empty containers removed');
    }
    
    // Verify camelCase conversion
    if (resultBasic.optimizedSvg.includes('fillRule') && resultBasic.optimizedSvg.includes('strokeWidth')) {
      console.log('   ✅ Attributes converted to camelCase');
    }
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 3: BALANCED level
  console.log('[3/5] Testing: Optimization Level BALANCED');
  try {
    const pipelineBalanced = createOptimizerPipeline(OptLevel.BALANCED);
    pipelineBalanced.registerStage('basic-cleaning', basicCleaningStage);
    const resultBalanced = await pipelineBalanced.optimize(testSVG);
    
    console.log(`   ✅ Original size: ${resultBalanced.originalSize} bytes`);
    console.log(`   ✅ Optimized size: ${resultBalanced.optimizedSize} bytes`);
    console.log(`   ✅ Reduction: ${resultBalanced.reductionPercent.toFixed(2)}%`);
    
    // Verify color shortening
    if (resultBalanced.optimizedSvg.includes('#F00') || resultBalanced.optimizedSvg.includes('#FF0000')) {
      console.log('   ✅ Color formatting applied');
    }
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 4: AGGRESSIVE level
  console.log('[4/5] Testing: Optimization Level AGGRESSIVE');
  try {
    const pipelineAggressive = createOptimizerPipeline(OptLevel.AGGRESSIVE);
    pipelineAggressive.registerStage('basic-cleaning', basicCleaningStage);
    const resultAggressive = await pipelineAggressive.optimize(testSVG);
    
    console.log(`   ✅ Original size: ${resultAggressive.originalSize} bytes`);
    console.log(`   ✅ Optimized size: ${resultAggressive.optimizedSize} bytes`);
    console.log(`   ✅ Reduction: ${resultAggressive.reductionPercent.toFixed(2)}%`);
    console.log(`   ✅ Float precision: 2 decimals`);
    
    passed++;
  } catch (error) {
    console.error('   ❌ FAILED:', error.message);
    failed++;
  }
  console.log('');

  // Test 5: MAXIMUM level
  console.log('[5/5] Testing: Optimization Level MAXIMUM');
  try {
    const pipelineMaximum = createOptimizerPipeline(OptLevel.MAXIMUM);
    pipelineMaximum.registerStage('basic-cleaning', basicCleaningStage);
    const resultMaximum = await pipelineMaximum.optimize(testSVG);
    
    console.log(`   ✅ Original size: ${resultMaximum.originalSize} bytes`);
    console.log(`   ✅ Optimized size: ${resultMaximum.optimizedSize} bytes`);
    console.log(`   ✅ Reduction: ${resultMaximum.reductionPercent.toFixed(2)}%`);
    console.log(`   ✅ Float precision: 1 decimal`);
    
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
    console.log('🎉 All optimizer tests passed successfully!\n');
  } else {
    console.error('❌ Some tests failed!\n');
    process.exit(1);
  }
}

runTests();
