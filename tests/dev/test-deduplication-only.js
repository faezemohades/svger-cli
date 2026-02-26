#!/usr/bin/env node
/**
 * Test path deduplication in ISOLATION (no other optimizations)
 * This proves deduplication works best on unoptimized SVGs
 */

import { pathDeduplicationStage } from './dist/optimizers/path-deduplicator.js';
import { OptLevel } from './dist/optimizers/types.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';

console.log(`${BOLD}${CYAN}=== Pure Deduplication Test (No Other Optimizations) ===${RESET}\n`);

// Create icon library with 50 duplicates (unoptimized)
const iconTemplates = [
  '<circle cx="12" cy="12" r="10" fill="#FF6B6B"/>',
  '<rect x="5" y="5" width="14" height="14" rx="2" fill="#4ECDC4"/>',
  '<path d="M12,2 L15,10 L23,10 L17,15 L19,23 L12,18 L5,23 L7,15 L1,10 L9,10 Z" fill="#FFD93D"/>',
  '<polygon points="12,2 19,22 5,9 19,9 5,22" fill="#95E1D3"/>',
  '<path d="M8,12 L12,16 L16,12 L12,8 Z" fill="#6C5CE7"/>',
  '<ellipse cx="12" cy="12" rx="10" ry="6" fill="#A8E6CF"/>',
  '<path d="M4,12 L20,12 M12,4 L12,20" stroke="#74B9FF" stroke-width="2" fill="none"/>',
  '<rect x="8" y="8" width="8" height="8" transform="rotate(45 12 12)" fill="#F093FB"/>',
  '<path d="M12,4 Q16,8 12,12 Q8,8 12,4 M12,12 Q16,16 12,20 Q8,16 12,12" fill="#4FACFE"/>',
  '<circle cx="12" cy="8" r="4" fill="#FA709A"/><circle cx="8" cy="16" r="3" fill="#FA709A"/><circle cx="16" cy="16" r="3" fill="#FA709A"/>',
];

let iconLibrary = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">\n';

for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 10; col++) {
    const iconTemplate = iconTemplates[col];
    const x = col * 120;
    const y = row * 120;
    iconLibrary += `  <g transform="translate(${x},${y})">\n`;
    iconLibrary += `    ${iconTemplate}\n`;
    iconLibrary += `  </g>\n`;
  }
}

iconLibrary += '</svg>';

const before = Buffer.byteLength(iconLibrary, 'utf8');
console.log(`${DIM}Before: ${before} bytes${RESET}`);

// Apply ONLY deduplication (no other optimizations)
const config = { 
  optimizationLevel: OptLevel.MAXIMUM,
  mergePaths: true 
};

const result = await pathDeduplicationStage(iconLibrary, config);
const after = Buffer.byteLength(result, 'utf8');

console.log(`${DIM}After: ${after} bytes${RESET}`);

const reduction = ((before - after) / before * 100).toFixed(2);
const color = reduction >= 70 ? MAGENTA : reduction >= 50 ? GREEN : DIM;

console.log(`\n${BOLD}${color}Pure Deduplication: ${before} → ${after} bytes (${reduction}%)${RESET}\n`);

if (reduction >= 70) {
  console.log(`${BOLD}${MAGENTA}🎯 70%+ REDUCTION ACHIEVED!${RESET}`);
  console.log(`${DIM}This proves Phase 4.5 delivers on unoptimized SVGs!${RESET}`);
} else if (reduction >= 50) {
  console.log(`${BOLD}${GREEN}✓ 50%+ reduction on pure deduplication${RESET}`);
} else if (reduction >= 30) {
  console.log(`${BOLD}✓ 30%+ reduction${RESET}`);
} else {
  console.log(`${BOLD}Note: ${reduction}% reduction${RESET}`);
  console.log(`${DIM}For 70%+ reduction, SVGs must have significant duplication${RESET}`);
}
