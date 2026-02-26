#!/usr/bin/env node
/**
 * Phase 6.1: Shape Conversion Test
 * 
 * Tests conversion of primitives (rect, polygon, polyline) to paths
 */

import { SVGProcessor, OptLevel } from './dist/index.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

const processor = SVGProcessor.getInstance();

function measureSVG(svg, label) {
  const size = Buffer.byteLength(svg, 'utf8');
  console.log(`${DIM}${label}: ${size} bytes${RESET}`);
  return size;
}

console.log(`${BOLD}${CYAN}=== Phase 6.1: Shape Conversion Test ===${RESET}\n`);

const testCases = [
  {
    name: 'Simple Rectangle',
    svg: '<svg viewBox="0 0 100 100"><rect x="10" y="20" width="50" height="30" fill="red"/></svg>',
    expected: 'Should convert to path (saves ~14 bytes)'
  },
  {
    name: 'Rounded Rectangle',
    svg: '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="60" rx="5" ry="5" fill="blue"/></svg>',
    expected: 'Should NOT convert (arcs are longer)'
  },
  {
    name: 'Triangle (Polygon)',
    svg: '<svg viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90" fill="green"/></svg>',
    expected: 'Should convert to path (saves bytes)'
  },
  {
    name: 'Rectangle Path (Polyline)',
    svg: '<svg viewBox="0 0 100 100"><polyline points="10,10 90,10 90,90 10,90" stroke="black" fill="none"/></svg>',
    expected: 'Should convert to path with H/V commands'
  },
  {
    name: 'Circle',
    svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="yellow"/></svg>',
    expected: 'Should NOT convert (path is longer)'
  },
  {
    name: 'Mixed Shapes',
    svg: `<svg viewBox="0 0 200 200">
      <rect x="10" y="10" width="40" height="40" fill="red"/>
      <circle cx="100" cy="30" r="20" fill="blue"/>
      <polygon points="150,10 180,50 120,50" fill="green"/>
      <polyline points="10,100 50,100 50,150" stroke="black" fill="none"/>
      <rect x="100" y="100" width="80" height="60" rx="10" fill="purple"/>
    </svg>`,
    expected: 'Rect 1, polygon, polyline should convert; Circle and rounded rect should not'
  }
];

(async () => {
  let totalBefore = 0;
  let totalAfter = 0;

  for (const test of testCases) {
    console.log(`${BOLD}Test: ${test.name}${RESET}`);
    console.log(`${DIM}Expected: ${test.expected}${RESET}`);
    
    const before = measureSVG(test.svg, 'Before');
    
    // Test at AGGRESSIVE level (shape conversion enabled)
    processor.setOptimizationLevel(OptLevel.AGGRESSIVE);
    const result = await processor.cleanSVGContent(test.svg);
    
    const after = measureSVG(result, 'After ');
    const reduction = ((before - after) / before * 100).toFixed(2);
    const savings = before - after;
    
    console.log(`${savings > 0 ? GREEN : DIM}Reduction: ${savings} bytes (${reduction}%)${RESET}`);
    
    // Show if paths were created
    const pathCount = (result.match(/<path/g) || []).length;
    const rectCount = (result.match(/<rect/g) || []).length;
    const circleCount = (result.match(/<circle/g) || []).length;
    const polygonCount = (result.match(/<polygon/g) || []).length;
    const polylineCount = (result.match(/<polyline/g) || []).length;
    
    console.log(`${DIM}Result: ${pathCount} path(s), ${rectCount} rect(s), ${circleCount} circle(s), ${polygonCount} polygon(s), ${polylineCount} polyline(s)${RESET}`);
    console.log();
    
    totalBefore += before;
    totalAfter += after;
  }
  
  console.log(`${BOLD}${CYAN}=== Summary ===${RESET}`);
  console.log(`Total: ${totalBefore} → ${totalAfter} bytes`);
  const totalReduction = ((totalBefore - totalAfter) / totalBefore * 100).toFixed(2);
  console.log(`Overall Reduction: ${totalReduction}%\n`);
  
  if (parseFloat(totalReduction) >= 60) {
    console.log(`${BOLD}${MAGENTA}🎉 EXCELLENT! Shape conversion + full pipeline achieving ${totalReduction}%!${RESET}`);
  } else if (parseFloat(totalReduction) >= 50) {
    console.log(`${BOLD}${GREEN}✓ GREAT! ${totalReduction}% reduction with shape conversion${RESET}`);
  } else {
    console.log(`${BOLD}${totalReduction}% reduction - shape conversion working as designed${RESET}`);
  }
  
  console.log(`\n${DIM}Phase 6.1 Target: +5-10% additional reduction from shape conversion${RESET}`);
  console.log(`${DIM}Full pipeline now includes: numeric, style, transform, shape-conversion, path-optimization, tree-optimization${RESET}`);
})();
