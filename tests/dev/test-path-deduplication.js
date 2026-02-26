#!/usr/bin/env node
/**
 * Phase 4.5: Path Merging + <use> Extraction Test
 * 
 * Tests deduplication and path merging on icon sets:
 * - Identical shape detection
 * - Extract to <defs> and replace with <use>
 * - Merge adjacent paths with same style
 * - Icon library optimization
 * 
 * Target: 70-80% reduction on icon sets with duplicates
 */

import { SVGProcessor, OptLevel } from './dist/index.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

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
  const color = reduction >= 70 ? MAGENTA : reduction >= 50 ? GREEN : reduction >= 30 ? YELLOW : DIM;
  console.log(`${BOLD}${color}${label}: ${before} → ${after} bytes (${reduction}% reduction)${RESET}\n`);
  return parseFloat(reduction);
}

console.log(`${BOLD}${CYAN}=== Phase 4.5: Path Deduplication Test ===${RESET}\n`);

(async () => {
  // Test 1: Simple duplicates (same shape 3 times)
  console.log(`${BOLD}${BLUE}Test 1: Simple Duplicate Shapes${RESET}`);
  const duplicatesSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100">
  <circle cx="50" cy="50" r="30" fill="#ff0000"/>
  <circle cx="150" cy="50" r="30" fill="#ff0000"/>
  <circle cx="250" cy="50" r="30" fill="#ff0000"/>
</svg>`;

  const before1 = measureSVG(duplicatesSVG, 'Before');
  const result1 = await optimizeSVG(duplicatesSVG, OptLevel.MAXIMUM);
  const after1 = measureSVG(result1, 'After');
  const reduction1 = showReduction(before1, after1, 'Simple duplicates');
  console.log(`${DIM}Expected: 3 identical circles → 1 <defs> + 3 <use>${RESET}\n`);

  // Test 2: Icon set with repeated star shape
  console.log(`${BOLD}${BLUE}Test 2: Icon Set with Repeated Stars${RESET}`);
  const starSetSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100">
  <path d="M25,10 L30,25 L45,25 L32,35 L38,50 L25,40 L12,50 L18,35 L5,25 L20,25 Z" fill="#ffd700"/>
  <path d="M75,10 L80,25 L95,25 L82,35 L88,50 L75,40 L62,50 L68,35 L55,25 L70,25 Z" fill="#ffd700"/>
  <path d="M125,10 L130,25 L145,25 L132,35 L138,50 L125,40 L112,50 L118,35 L105,25 L120,25 Z" fill="#ffd700"/>
  <path d="M175,10 L180,25 L195,25 L182,35 L188,50 L175,40 L162,50 L168,35 L155,25 L170,25 Z" fill="#ffd700"/>
  <path d="M225,10 L230,25 L245,25 L232,35 L238,50 L225,40 L212,50 L218,35 L205,25 L220,25 Z" fill="#ffd700"/>
  <path d="M275,10 L280,25 L295,25 L282,35 L288,50 L275,40 L262,50 L268,35 L255,25 L270,25 Z" fill="#ffd700"/>
  <path d="M325,10 L330,25 L345,25 L332,35 L338,50 L325,40 L312,50 L318,35 L305,25 L320,25 Z" fill="#ffd700"/>
  <path d="M375,10 L380,25 L395,25 L382,35 L388,50 L375,40 L362,50 L368,35 L355,25 L370,25 Z" fill="#ffd700"/>
</svg>`;

  const before2 = measureSVG(starSetSVG, 'Before');
  const result2 = await optimizeSVG(starSetSVG, OptLevel.MAXIMUM);
  const after2 = measureSVG(result2, 'After');
  const reduction2 = showReduction(before2, after2, 'Star icon set');
  console.log(`${DIM}Expected: 8 identical stars → 1 <defs> + 8 <use> = massive savings${RESET}\n`);

  // Test 3: Material Icons style (similar shapes, different positions)
  console.log(`${BOLD}${BLUE}Test 3: Material Icons Style (Multiple Duplicates)${RESET}`);
  const materialStyleSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200">
  <g transform="translate(50,50)">
    <circle cx="0" cy="0" r="20" fill="#000"/>
    <circle cx="0" cy="0" r="15" fill="#fff"/>
  </g>
  <g transform="translate(150,50)">
    <circle cx="0" cy="0" r="20" fill="#000"/>
    <circle cx="0" cy="0" r="15" fill="#fff"/>
  </g>
  <g transform="translate(250,50)">
    <circle cx="0" cy="0" r="20" fill="#000"/>
    <circle cx="0" cy="0" r="15" fill="#fff"/>
  </g>
  <g transform="translate(350,50)">
    <circle cx="0" cy="0" r="20" fill="#000"/>
    <circle cx="0" cy="0" r="15" fill="#fff"/>
  </g>
  <g transform="translate(450,50)">
    <circle cx="0" cy="0" r="20" fill="#000"/>
    <circle cx="0" cy="0" r="15" fill="#fff"/>
  </g>
  <g transform="translate(550,50)">
    <circle cx="0" cy="0" r="20" fill="#000"/>
    <circle cx="0" cy="0" r="15" fill="#fff"/>
  </g>
</svg>`;

  const before3 = measureSVG(materialStyleSVG, 'Before');
  const result3 = await optimizeSVG(materialStyleSVG, OptLevel.MAXIMUM);
  const after3 = measureSVG(result3, 'After');
  const reduction3 = showReduction(before3, after3, 'Material style icons');
  console.log(`${DIM}Expected: 2 unique shapes × 6 instances → 2 <defs> + 12 <use>${RESET}\n`);

  // Test 4: Adjacent paths with same style (should merge)
  console.log(`${BOLD}${BLUE}Test 4: Adjacent Path Merging${RESET}`);
  const adjacentPathsSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g>
    <path d="M10,10 L20,10 L20,20 Z" fill="#ff0000" stroke="#000"/>
    <path d="M30,10 L40,10 L40,20 Z" fill="#ff0000" stroke="#000"/>
    <path d="M50,10 L60,10 L60,20 Z" fill="#ff0000" stroke="#000"/>
    <path d="M70,10 L80,10 L80,20 Z" fill="#ff0000" stroke="#000"/>
  </g>
</svg>`;

  const before4 = measureSVG(adjacentPathsSVG, 'Before');
  const result4 = await optimizeSVG(adjacentPathsSVG, OptLevel.MAXIMUM);
  const after4 = measureSVG(result4, 'After');
  const reduction4 = showReduction(before4, after4, 'Adjacent path merging');
  console.log(`${DIM}Expected: 4 adjacent paths → 1 merged path${RESET}\n`);

  // Test 5: Font Awesome style icon set (complex repeated shapes)
  console.log(`${BOLD}${BLUE}Test 5: Font Awesome Style Icon Library${RESET}`);
  const fontAwesomeStyleSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200">
  <path d="M10,50 L30,30 L30,70 Z" fill="#333" transform="translate(0,0)"/>
  <path d="M10,50 L30,30 L30,70 Z" fill="#333" transform="translate(50,0)"/>
  <path d="M10,50 L30,30 L30,70 Z" fill="#333" transform="translate(100,0)"/>
  <path d="M10,50 L30,30 L30,70 Z" fill="#333" transform="translate(150,0)"/>
  <path d="M10,50 L30,30 L30,70 Z" fill="#333" transform="translate(200,0)"/>
  <rect x="10" y="10" width="30" height="30" fill="#666" transform="translate(0,50)"/>
  <rect x="10" y="10" width="30" height="30" fill="#666" transform="translate(50,50)"/>
  <rect x="10" y="10" width="30" height="30" fill="#666" transform="translate(100,50)"/>
  <rect x="10" y="10" width="30" height="30" fill="#666" transform="translate(150,50)"/>
  <rect x="10" y="10" width="30" height="30" fill="#666" transform="translate(200,50)"/>
  <circle cx="25" cy="25" r="15" fill="#999" transform="translate(0,100)"/>
  <circle cx="25" cy="25" r="15" fill="#999" transform="translate(50,100)"/>
  <circle cx="25" cy="25" r="15" fill="#999" transform="translate(100,100)"/>
  <circle cx="25" cy="25" r="15" fill="#999" transform="translate(150,100)"/>
  <circle cx="25" cy="25" r="15" fill="#999" transform="translate(200,100)"/>
</svg>`;

  const before5 = measureSVG(fontAwesomeStyleSVG, 'Before');
  const result5 = await optimizeSVG(fontAwesomeStyleSVG, OptLevel.MAXIMUM);
  const after5 = measureSVG(result5, 'After');
  const reduction5 = showReduction(before5, after5, 'Font Awesome style library');
  console.log(`${DIM}Expected: 3 unique shapes × 5 each = 15 instances → 3 <defs> + 15 <use>${RESET}\n`);

  // Test 6: Heroicons style (stroke-based icons)
  console.log(`${BOLD}${BLUE}Test 6: Heroicons Style (Stroke Icons)${RESET}`);
  const heroiconsStyleSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 100" fill="none">
  <path d="M10,10 L40,40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
  <path d="M40,10 L10,40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
  <path d="M60,10 L90,40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
  <path d="M90,10 L60,40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
  <path d="M110,10 L140,40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
  <path d="M140,10 L110,40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
  <path d="M160,10 L190,40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
  <path d="M190,10 L160,40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
</svg>`;

  const before6 = measureSVG(heroiconsStyleSVG, 'Before');
  const result6 = await optimizeSVG(heroiconsStyleSVG, OptLevel.MAXIMUM);
  const after6 = measureSVG(result6, 'After');
  const reduction6 = showReduction(before6, after6, 'Heroicons style');
  console.log(`${DIM}Expected: 2 unique strokes × 4 instances → 2 <defs> + 8 <use>${RESET}\n`);

  // Summary
  console.log(`${BOLD}${CYAN}=== Summary ===${RESET}`);
  const totalBefore = before1 + before2 + before3 + before4 + before5 + before6;
  const totalAfter = after1 + after2 + after3 + after4 + after5 + after6;
  const totalReduction = ((totalBefore - totalAfter) / totalBefore * 100).toFixed(2);
  const avgReduction = ((reduction1 + reduction2 + reduction3 + reduction4 + reduction5 + reduction6) / 6).toFixed(2);

  console.log(`${BOLD}Total: ${totalBefore} → ${totalAfter} bytes${RESET}`);
  console.log(`${BOLD}${GREEN}Overall Reduction: ${totalReduction}%${RESET}`);
  console.log(`${BOLD}${GREEN}Average Reduction: ${avgReduction}%${RESET}\n`);

  if (totalReduction >= 70) {
    console.log(`${BOLD}${MAGENTA}✓✓✓ Phase 4.5 TARGET EXCEEDED! (70-80% goal achieved)${RESET}`);
    console.log(`${DIM}Path deduplication is a game-changer for icon libraries!${RESET}`);
    console.log(`${DIM}svger-cli is now UNBEATABLE in SVG optimization! 🏆${RESET}`);
  } else if (totalReduction >= 50) {
    console.log(`${BOLD}${GREEN}✓✓ Phase 4.5 Strong Performance! (50%+)${RESET}`);
    console.log(`${DIM}Excellent reduction for icon sets with duplicates${RESET}`);
  } else if (totalReduction >= 30) {
    console.log(`${BOLD}${YELLOW}✓ Phase 4.5 Good Performance (30%+)${RESET}`);
    console.log(`${DIM}Solid deduplication on icon libraries${RESET}`);
  } else {
    console.log(`${BOLD}${YELLOW}⚠ Below target (${totalReduction}% < 70%)${RESET}`);
    console.log(`${DIM}Works best on icon sets with many duplicates${RESET}`);
  }

  // Show best individual result
  const reductions = [
    { name: 'Simple duplicates', value: reduction1 },
    { name: 'Star icon set', value: reduction2 },
    { name: 'Material style', value: reduction3 },
    { name: 'Adjacent paths', value: reduction4 },
    { name: 'Font Awesome style', value: reduction5 },
    { name: 'Heroicons style', value: reduction6 },
  ];
  const best = reductions.reduce((a, b) => (a.value > b.value ? a : b));
  
  console.log(`\n${BOLD}${MAGENTA}Best Result: ${best.name} (${best.value}% reduction)${RESET}`);
})();
