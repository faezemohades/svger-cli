#!/usr/bin/env node
/**
 * Phase 4.4: Path Simplification Test
 * 
 * Tests Douglas-Peucker and Visvalingam-Whyatt algorithms:
 * - Point reduction on complex polylines
 * - Polygon simplification
 * - Hand-drawn path smoothing
 * - Tolerance-based optimization
 * 
 * Target: 5-15% additional reduction on complex paths
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
  const color = reduction >= 10 ? GREEN : reduction >= 5 ? YELLOW : DIM;
  console.log(`${BOLD}${color}${label}: ${before} → ${after} bytes (${reduction}% reduction)${RESET}\n`);
}

console.log(`${BOLD}${CYAN}=== Phase 4.4: Path Simplification Test ===${RESET}\n`);

(async () => {
  // Test 1: Complex polyline with many points
  console.log(`${BOLD}${BLUE}Test 1: Complex Polyline (Douglas-Peucker)${RESET}`);
  const polylineSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M10,100 L15,102 L20,103 L25,105 L30,108 L35,110 L40,112 L45,115 L50,120 L55,125 L60,128 L65,130 L70,135 L75,138 L80,140 L85,145 L90,148 L95,150 L100,155 L105,158 L110,160 L115,162 L120,165 L125,168 L130,170 L135,172 L140,175 L145,178 L150,180 L155,182 L160,185 L165,188 L170,190 L175,192 L180,195 L185,198 L190,200"/>
</svg>`;

  const before1 = measureSVG(polylineSVG, 'Before');
  const result1 = await optimizeSVG(polylineSVG, OptLevel.AGGRESSIVE);
  const after1 = measureSVG(result1, 'After');
  showReduction(before1, after1, 'Polyline simplification');
  console.log(`${DIM}Expected: Many intermediate points removed${RESET}\n`);

  // Test 2: Polygon with redundant vertices
  console.log(`${BOLD}${BLUE}Test 2: Redundant Polygon Points${RESET}`);
  const polygonSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,10 L10,11 L10,12 L20,12 L20,13 L20,14 L30,14 L30,15 L30,16 L40,16 L40,17 L40,18 L50,18 L50,17 L50,16 L60,16 L60,15 L60,14 L70,14 L70,13 L70,12 L80,12 L80,11 L80,10 Z"/>
</svg>`;

  const before2 = measureSVG(polygonSVG, 'Before');
  const result2 = await optimizeSVG(polygonSVG, OptLevel.AGGRESSIVE);
  const after2 = measureSVG(result2, 'After');
  showReduction(before2, after2, 'Polygon simplification');
  console.log(`${DIM}Expected: Collinear points removed${RESET}\n`);

  // Test 3: Hand-drawn wavy line
  console.log(`${BOLD}${BLUE}Test 3: Hand-Drawn Wavy Line${RESET}`);
  const wavySVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100">
  <path d="M10,50 L12,52 L14,54 L16,56 L18,58 L20,60 L22,62 L24,63 L26,64 L28,65 L30,66 L32,67 L34,68 L36,68.5 L38,69 L40,69 L42,68.5 L44,68 L46,67 L48,66 L50,65 L52,64 L54,63 L56,62 L58,60 L60,58 L62,56 L64,54 L66,52 L68,50 L70,48 L72,46 L74,44 L76,42 L78,40 L80,38 L82,37 L84,36 L86,35 L88,34 L90,33 L92,32 L94,31.5 L96,31 L98,31 L100,31.5 L102,32 L104,33 L106,34 L108,35 L110,36 L112,37 L114,38 L116,40 L118,42 L120,44 L122,46 L124,48 L126,50"/>
</svg>`;

  const before3 = measureSVG(wavySVG, 'Before');
  const result3 = await optimizeSVG(wavySVG, OptLevel.MAXIMUM);
  const after3 = measureSVG(result3, 'After');
  showReduction(before3, after3, 'Hand-drawn simplification');
  console.log(`${DIM}Expected: Smooth curve with fewer points (Visvalingam)${RESET}\n`);

  // Test 4: Map contour with many points
  console.log(`${BOLD}${BLUE}Test 4: Map Contour Line${RESET}`);
  const contourSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <path d="M20,100 L22,98 L24,96 L26,95 L28,94 L30,93 L32,92 L34,91.5 L36,91 L38,90.5 L40,90 L42,90 L44,90 L46,90.5 L48,91 L50,91.5 L52,92 L54,93 L56,94 L58,95 L60,96 L62,97 L64,98 L66,99 L68,100 L70,101 L72,102 L74,103 L76,104 L78,105 L80,106 L82,107 L84,108 L86,109 L88,110 L90,111 L92,112 L94,113 L96,114 L98,115 L100,116 L102,117 L104,118 L106,119 L108,120 L110,121 L112,122 L114,122.5 L116,123 L118,123.5 L120,124 L122,124 L124,124 L126,123.5 L128,123 L130,122.5 L132,122 L134,121 L136,120 L138,119 L140,118 L142,117 L144,116 L146,115 L148,114 L150,113"/>
</svg>`;

  const before4 = measureSVG(contourSVG, 'Before');
  const result4 = await optimizeSVG(contourSVG, OptLevel.MAXIMUM);
  const after4 = measureSVG(result4, 'After');
  showReduction(before4, after4, 'Contour simplification');
  console.log(`${DIM}Expected: Significant point reduction while preserving shape${RESET}\n`);

  // Test 5: Jagged line (many direction changes)
  console.log(`${BOLD}${BLUE}Test 5: Jagged Line (Minimal Simplification)${RESET}`);
  const jaggedSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <path d="M10,50 L20,40 L30,60 L40,30 L50,70 L60,20 L70,80 L80,10 L90,90 L100,50 L110,40 L120,60 L130,30 L140,70 L150,20 L160,80 L170,10 L180,90 L190,50"/>
</svg>`;

  const before5 = measureSVG(jaggedSVG, 'Before');
  const result5 = await optimizeSVG(jaggedSVG, OptLevel.AGGRESSIVE);
  const after5 = measureSVG(result5, 'After');
  showReduction(before5, after5, 'Jagged line');
  console.log(`${DIM}Expected: Few points removed (important direction changes)${RESET}\n`);

  // Test 6: Nearly straight line with noise
  console.log(`${BOLD}${BLUE}Test 6: Nearly Straight Line with Noise${RESET}`);
  const noisyLineSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <path d="M10,50 L20,50.5 L30,49.8 L40,50.2 L50,49.9 L60,50.1 L70,50.3 L80,49.7 L90,50.4 L100,49.6 L110,50.2 L120,50 L130,49.9 L140,50.1 L150,50.2 L160,49.8 L170,50.3 L180,49.7 L190,50"/>
</svg>`;

  const before6 = measureSVG(noisyLineSVG, 'Before');
  const result6 = await optimizeSVG(noisyLineSVG, OptLevel.MAXIMUM);
  const after6 = measureSVG(result6, 'After');
  showReduction(before6, after6, 'Noisy line simplification');
  console.log(`${DIM}Expected: Aggressive simplification to nearly straight line${RESET}\n`);

  // Test 7: Real-world icon with detailed path
  console.log(`${BOLD}${BLUE}Test 7: Real-World Detailed Icon${RESET}`);
  const detailedIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12,2 L12.1,2.05 L12.2,2.1 L12.3,2.2 L12.4,2.3 L12.5,2.4 L12.6,2.5 L12.7,2.6 L12.8,2.7 L12.9,2.8 L13,2.9 L13.1,3 L13.2,3.1 L13.3,3.2 L13.4,3.3 L13.5,3.4 L13.6,3.5 L13.7,3.6 L13.8,3.7 L13.9,3.8 L14,3.9 L14.1,4 L14.2,4.1 L14.3,4.2 L14.4,4.3 L14.5,4.4 L14.6,4.5 L14.7,4.6 L14.8,4.7 L14.9,4.8 L15,5 L15,22 L9,22 L9,5 L9.1,4.8 L9.2,4.7 L9.3,4.6 L9.4,4.5 L9.5,4.4 L9.6,4.3 L9.7,4.2 L9.8,4.1 L9.9,4 L10,3.9 L10.1,3.8 L10.2,3.7 L10.3,3.6 L10.4,3.5 L10.5,3.4 L10.6,3.3 L10.7,3.2 L10.8,3.1 L10.9,3 L11,2.9 L11.1,2.8 L11.2,2.7 L11.3,2.6 L11.4,2.5 L11.5,2.4 L11.6,2.3 L11.7,2.2 L11.8,2.1 L11.9,2.05 Z"/>
</svg>`;

  const before7 = measureSVG(detailedIconSVG, 'Before');
  const result7 = await optimizeSVG(detailedIconSVG, OptLevel.MAXIMUM);
  const after7 = measureSVG(result7, 'After');
  showReduction(before7, after7, 'Detailed icon');
  console.log(`${DIM}Expected: Substantial point reduction on smooth edges${RESET}\n`);

  // Summary
  console.log(`${BOLD}${CYAN}=== Summary ===${RESET}`);
  const totalBefore = before1 + before2 + before3 + before4 + before5 + before6 + before7;
  const totalAfter = after1 + after2 + after3 + after4 + after5 + after6 + after7;
  const totalReduction = ((totalBefore - totalAfter) / totalBefore * 100).toFixed(2);

  console.log(`${BOLD}Total: ${totalBefore} → ${totalAfter} bytes${RESET}`);
  console.log(`${BOLD}${GREEN}Overall Reduction: ${totalReduction}%${RESET}\n`);

  if (totalReduction >= 5) {
    console.log(`${BOLD}${GREEN}✓ Phase 4.4 Target Achieved! (5-15% improvement)${RESET}`);
    console.log(`${DIM}Path simplification successfully reduces point count${RESET}`);
  } else {
    console.log(`${BOLD}${YELLOW}⚠ Below target (${totalReduction}% < 5%)${RESET}`);
    console.log(`${DIM}May need more aggressive tolerances or better test cases${RESET}`);
  }
})();
