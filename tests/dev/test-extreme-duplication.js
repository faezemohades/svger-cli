#!/usr/bin/env node
/**
 * Extreme Duplication Test: 100+ instances of same shape
 * 
 * This tests the theoretical maximum for Phase 4.5
 */

import { pathDeduplicationStage } from './dist/optimizers/path-deduplicator.js';
import { OptLevel } from './dist/optimizers/types.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';

// Create SVG with 1 shape repeated 100 times
let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">\n';
const shape = '<circle cx="50" cy="50" r="40" fill="#FF6B6B" stroke="#333" stroke-width="2"/>';

for (let i = 0; i < 100; i++) {
  const x = (i % 10) * 100;
  const y = Math.floor(i / 10) * 100;
  svg += `  <g transform="translate(${x},${y})">\n`;
  svg += `    ${shape}\n`;
  svg += `  </g>\n`;
}
svg += '</svg>';

console.log(`${BOLD}${MAGENTA}=== Extreme Duplication Test ===${RESET}\n`);
console.log(`${DIM}Testing: 1 shape repeated 100 times${RESET}\n`);

const before = Buffer.byteLength(svg, 'utf8');
console.log(`${DIM}Before: ${before} bytes${RESET}`);

(async () => {
  const config = {
    optimizationLevel: OptLevel.MAXIMUM,
    mergePaths: true
  };
  
  const result = await pathDeduplicationStage(svg, config);
  const after = Buffer.byteLength(result, 'utf8');
  const reduction = ((before - after) / before * 100).toFixed(2);
  
  console.log(`${DIM}After: ${after} bytes${RESET}\n`);
  
  const color = parseFloat(reduction) >= 70 ? MAGENTA : GREEN;
  console.log(`${BOLD}${color}Reduction: ${before} → ${after} bytes (${reduction}%)${RESET}\n`);
  
  if (parseFloat(reduction) >= 70) {
    console.log(`${BOLD}${MAGENTA}🏆 70%+ TARGET ACHIEVED!${RESET}`);
    console.log(`${DIM}Phase 4.5 delivers extreme compression on high-duplication SVGs!${RESET}`);
  } else {
    console.log(`${BOLD}Analysis:${RESET}`);
    console.log(`${DIM}• 100 instances of same shape${RESET}`);
    console.log(`${DIM}• Deduplication extracts to <defs> + <use> references${RESET}`);
    console.log(`${DIM}• ${reduction}% reduction achieved${RESET}`);
    console.log(`${DIM}• 70-80% requires even more duplication OR larger shapes${RESET}`);
  }
})();
