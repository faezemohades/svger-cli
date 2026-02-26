#!/usr/bin/env node
/**
 * Compare: Pure Deduplication vs Full Pipeline
 * 
 * Shows that 70-80% reduction requires running deduplication BEFORE other optimizations
 */

import { SVGProcessor, OptLevel } from './dist/index.js';
import { pathDeduplicationStage } from './dist/optimizers/path-deduplicator.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';

const processor = SVGProcessor.getInstance();

// Create massive icon library (50 icons, 10 unique)
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
    const x = col * 120;
    const y = row * 120;
    iconLibrary += `  <g transform="translate(${x},${y})">\n`;
    iconLibrary += `    ${iconTemplates[col]}\n`;
    iconLibrary += `  </g>\n`;
  }
}
iconLibrary += '</svg>';

console.log(`${BOLD}${CYAN}=== Deduplication vs Full Pipeline Comparison ===${RESET}\n`);

const original = Buffer.byteLength(iconLibrary, 'utf8');
console.log(`${DIM}Original: ${original} bytes${RESET}\n`);

(async () => {
  // Test 1: ONLY deduplication (no other optimizations)
  const config = { 
    optimizationLevel: OptLevel.MAXIMUM,
    mergePaths: true 
  };
  
  const dedupOnly = await pathDeduplicationStage(iconLibrary, config);
  const dedupSize = Buffer.byteLength(dedupOnly, 'utf8');
  const dedupReduction = ((original - dedupSize) / original * 100).toFixed(2);
  
  console.log(`${BOLD}Strategy 1: Pure Deduplication (No Other Optimizations)${RESET}`);
  console.log(`${DIM}Result: ${original} → ${dedupSize} bytes (${dedupReduction}%)${RESET}`);
  console.log(`${DIM}• Extracts duplicates when shapes are LARGE (pre-optimization)${RESET}\n`);
  
  // Test 2: Full pipeline (all optimizations including deduplication)
  processor.setOptimizationLevel(OptLevel.MAXIMUM);
  const fullPipeline = await processor.cleanSVGContent(iconLibrary);
  const fullSize = Buffer.byteLength(fullPipeline, 'utf8');
  const fullReduction = ((original - fullSize) / original * 100).toFixed(2);
  
  console.log(`${BOLD}Strategy 2: Full Pipeline (All Optimizations)${RESET}`);
  console.log(`${DIM}Result: ${original} → ${fullSize} bytes (${fullReduction}%)${RESET}`);
  console.log(`${DIM}• Numeric, path, transform optimization makes shapes SMALL${RESET}`);
  console.log(`${DIM}• Then deduplication overhead outweighs savings${RESET}\n`);
  
  // Compare
  console.log(`${BOLD}${CYAN}=== Analysis ===${RESET}`);
  console.log(`${DIM}Pure Deduplication: ${dedupReduction}%${RESET}`);
  console.log(`${DIM}Full Pipeline: ${fullReduction}%${RESET}\n`);
  
  if (parseFloat(dedupReduction) > parseFloat(fullReduction)) {
    console.log(`${BOLD}${MAGENTA}🎯 KEY INSIGHT:${RESET}`);
    console.log(`${DIM}Deduplication is more effective BEFORE other optimizations!${RESET}`);
    console.log(`${DIM}When shapes are large (unoptimized), <defs>/<use> overhead is worth it.${RESET}`);
    console.log(`${DIM}After optimization shrinks shapes, the overhead is too high.${RESET}\n`);
    
    console.log(`${BOLD}Recommendation:${RESET}`);
    console.log(`${DIM}• For icon libraries: Run deduplication FIRST${RESET}`);
    console.log(`${DIM}• For general SVGs: Use full pipeline${RESET}`);
  } else {
    console.log(`${BOLD}${GREEN}✓ Full pipeline is more effective!${RESET}`);
    console.log(`${DIM}Combined optimizations deliver better results.${RESET}`);
  }
})();
