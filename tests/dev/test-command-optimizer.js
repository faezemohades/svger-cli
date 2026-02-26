#!/usr/bin/env node
/**
 * Phase 4.3: Command Optimizer Test
 * 
 * Tests curve shortening and smart command substitution:
 * - C→S (smooth cubic)
 * - C→Q (cubic to quadratic)
 * - Q→T (smooth quadratic)
 * - C/Q→L (curve to line)
 * - abs/rel re-evaluation
 * 
 * Target: 10-25% additional reduction on complex paths
 */

import { SVGProcessor, OptLevel } from './dist/index.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

const processor = SVGProcessor.getInstance();

// Helper to optimize SVG with specific level
async function optimizeSVG(svg, optLevel) {
  processor.setOptimizationLevel(optLevel);
  return await processor.cleanSVGContent(svg);
}

function measureSVG(svg, label) {
  const size = Buffer.byteLength(svg, 'utf8');
  console.log(`${DIM}${label}: ${size} bytes${RESET}`);
  return size;
}

function showReduction(before, after, label) {
  const reduction = ((before - after) / before * 100).toFixed(2);
  const color = reduction >= 15 ? GREEN : reduction >= 10 ? YELLOW : DIM;
  console.log(`${BOLD}${color}${label}: ${before} → ${after} bytes (${reduction}% reduction)${RESET}\n`);
}

console.log(`${BOLD}${CYAN}=== Phase 4.3: Command Optimizer Test ===${RESET}\n`);

(async () => {
  // Test 1: C→S (smooth cubic) - consecutive cubics with aligned control points
  console.log(`${BOLD}${BLUE}Test 1: C→S Conversion (Smooth Cubic)${RESET}`);
  const smoothCubicSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,50 C20,20 30,20 40,50 C50,80 60,80 70,50 C80,20 90,20 100,50"/>
</svg>`;

  const before1 = measureSVG(smoothCubicSVG, 'Before');
  const result1 = await optimizeSVG(smoothCubicSVG, OptLevel.AGGRESSIVE);
  const after1 = measureSVG(result1, 'After');
  showReduction(before1, after1, 'C→S conversion');
  console.log(`${DIM}Expected: Second and third C commands converted to S${RESET}\n`);

  // Test 2: C→Q (cubic to quadratic) - cubic with control points that can be quadratic
  console.log(`${BOLD}${BLUE}Test 2: C→Q Conversion (Cubic to Quadratic)${RESET}`);
  const cubicToQuadSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M20,80 C30,60 40,60 50,80 C60,100 70,100 80,80"/>
</svg>`;

  const before2 = measureSVG(cubicToQuadSVG, 'Before');
  const result2 = await optimizeSVG(cubicToQuadSVG, OptLevel.AGGRESSIVE);
  const after2 = measureSVG(result2, 'After');
  showReduction(before2, after2, 'C→Q conversion');
  console.log(`${DIM}Expected: Cubic commands converted to quadratic (Q) where possible${RESET}\n`);

  // Test 3: Q→T (smooth quadratic) - consecutive quadratics with aligned control points
  console.log(`${BOLD}${BLUE}Test 3: Q→T Conversion (Smooth Quadratic)${RESET}`);
  const smoothQuadSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,50 Q30,20 50,50 Q70,80 90,50"/>
</svg>`;

  const before3 = measureSVG(smoothQuadSVG, 'Before');
  const result3 = await optimizeSVG(smoothQuadSVG, OptLevel.AGGRESSIVE);
  const after3 = measureSVG(result3, 'After');
  showReduction(before3, after3, 'Q→T conversion');
  console.log(`${DIM}Expected: Second Q command converted to T${RESET}\n`);

  // Test 4: C→L (curve to line) - nearly straight cubic
  console.log(`${BOLD}${BLUE}Test 4: C→L Conversion (Curve to Line)${RESET}`);
  const curveToLineSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,50 C20,50.1 30,49.9 40,50 C50,50.05 60,49.95 70,50"/>
</svg>`;

  const before4 = measureSVG(curveToLineSVG, 'Before');
  const result4 = await optimizeSVG(curveToLineSVG, OptLevel.AGGRESSIVE);
  const after4 = measureSVG(result4, 'After');
  showReduction(before4, after4, 'C→L conversion');
  console.log(`${DIM}Expected: Nearly straight curves converted to L${RESET}\n`);

  // Test 5: Q→L (quadratic to line) - nearly straight quadratic
  console.log(`${BOLD}${BLUE}Test 5: Q→L Conversion (Quadratic to Line)${RESET}`);
  const quadToLineSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,50 Q30,50.1 50,50 Q70,49.9 90,50"/>
</svg>`;

  const before5 = measureSVG(quadToLineSVG, 'Before');
  const result5 = await optimizeSVG(quadToLineSVG, OptLevel.AGGRESSIVE);
  const after5 = measureSVG(result5, 'After');
  showReduction(before5, after5, 'Q→L conversion');
  console.log(`${DIM}Expected: Nearly straight quadratics converted to L${RESET}\n`);

  // Test 6: Complex icon with multiple optimizations
  console.log(`${BOLD}${BLUE}Test 6: Complex Material Icon (Heart)${RESET}`);
  const complexIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12,21.35 L10.55,20.03 C5.4,15.36 2,12.27 2,8.5 C2,5.41 4.42,3 7.5,3 C9.24,3 10.91,3.81 12,5.08 C13.09,3.81 14.76,3 16.5,3 C19.58,3 22,5.41 22,8.5 C22,12.27 18.6,15.36 13.45,20.03 L12,21.35 Z"/>
</svg>`;

  const before6 = measureSVG(complexIconSVG, 'Before');
  const result6 = await optimizeSVG(complexIconSVG, OptLevel.AGGRESSIVE);
  const after6 = measureSVG(result6, 'After');
  showReduction(before6, after6, 'Complex icon');
  console.log(`${DIM}Expected: Multiple optimizations (C→L, abs/rel)${RESET}\n`);

  // Test 7: Hand-drawn style with many curves
  console.log(`${BOLD}${BLUE}Test 7: Hand-Drawn Style Path${RESET}`);
  const handDrawnSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M50,100 C55,95 60,95 65,100 C70,105 75,105 80,100 C85,95 90,95 95,100 C100,105 105,105 110,100 C115,95 120,95 125,100 C130,105 135,105 140,100 C145,95 150,95 155,100"/>
</svg>`;

  const before7 = measureSVG(handDrawnSVG, 'Before');
  const result7 = await optimizeSVG(handDrawnSVG, OptLevel.MAXIMUM);
  const after7 = measureSVG(result7, 'After');
  showReduction(before7, after7, 'Hand-drawn path');
  console.log(`${DIM}Expected: Many C→S conversions (wavy line pattern)${RESET}\n`);

  // Test 8: Mixed absolute/relative re-evaluation
  console.log(`${BOLD}${BLUE}Test 8: Absolute/Relative Re-evaluation${RESET}`);
  const absRelSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <path d="M100,100 L900,100 L900,900 L100,900 Z"/>
</svg>`;

  const before8 = measureSVG(absRelSVG, 'Before');
  const result8 = await optimizeSVG(absRelSVG, OptLevel.AGGRESSIVE);
  const after8 = measureSVG(result8, 'After');
  showReduction(before8, after8, 'Abs/rel optimization');
  console.log(`${DIM}Expected: Large coordinates converted to relative${RESET}\n`);

  // Summary
  console.log(`${BOLD}${CYAN}=== Summary ===${RESET}`);
  const totalBefore = before1 + before2 + before3 + before4 + before5 + before6 + before7 + before8;
  const totalAfter = after1 + after2 + after3 + after4 + after5 + after6 + after7 + after8;
  const totalReduction = ((totalBefore - totalAfter) / totalBefore * 100).toFixed(2);

  console.log(`${BOLD}Total: ${totalBefore} → ${totalAfter} bytes${RESET}`);
  console.log(`${BOLD}${GREEN}Overall Reduction: ${totalReduction}%${RESET}\n`);

  if (totalReduction >= 10) {
    console.log(`${BOLD}${GREEN}✓ Phase 4.3 Target Achieved! (10-25% improvement)${RESET}`);
    console.log(`${DIM}Command optimizer successfully reduces path complexity${RESET}`);
  } else {
    console.log(`${BOLD}${YELLOW}⚠ Below target (${totalReduction}% < 10%)${RESET}`);
    console.log(`${DIM}May need more aggressive tolerances or better test cases${RESET}`);
  }
})();
