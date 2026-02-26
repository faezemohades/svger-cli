#!/usr/bin/env node

import { OptimizerPipeline } from './dist/optimizers/optimizer-pipeline.js';
import { OptLevel } from './dist/optimizers/types.js';
import { basicCleaningStage } from './dist/optimizers/basic-cleaner.js';
import { treeOptimizationStage } from './dist/optimizers/tree-stages.js';
import {
  numericStage,
  styleStage,
  transformStage,
  pathOptimizationStage,
  advancedOptimizationStage,
} from './dist/optimizers/advanced-stages.js';

console.log('🚀 Optimization Level Integration Test\n');

// Sample SVG with various optimization opportunities
const testSVG = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 24.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g transform="translate(100,100)">
    <g transform="scale(0.8)">
      <g id="icon-layer">
        <g transform="translate(-10,-10)">
          <rect x="0.000" y="0.000" width="20.000" height="20.000" fill="#FF5733" stroke="#000000"/>
        </g>
        <g transform="translate(10,10)">
          <circle cx="0.000" cy="0.000" r="8.000" fill="#33FF57"/>
        </g>
      </g>
    </g>
  </g>
  <g transform="translate(0,0)">
    <path d="M 10 10 L 20 10 L 20 20 L 10 20 Z" fill="#3357FF"/>
  </g>
  <g>
    <rect x="50" y="50" width="30" height="30" fill="rgb(255, 0, 0)" stroke-width="2px"/>
  </g>
</svg>`;

console.log('Input SVG:', testSVG.length, 'bytes\n');
console.log('Optimization opportunities:');
console.log('- Multiple nested groups with transforms');
console.log('- Identity transform (translate(0,0))');
console.log('- Decimal precision (0.000)');
console.log('- Color formats (#FF5733, rgb(255,0,0))');
console.log('- Path that could use H/V commands');
console.log('- Units that could be removed (px)');
console.log('- XML comments and metadata\n');

// Test BASIC level
console.log('═'.repeat(70));
console.log('LEVEL: BASIC (minimal, safe optimizations)');
console.log('═'.repeat(70));
const basicOptimizer = new OptimizerPipeline({ level: OptLevel.BASIC });
basicOptimizer.registerStage('basic-cleaning', basicCleaningStage);

const basicResult = await basicOptimizer.optimize(testSVG);
console.log(`Original: ${basicResult.originalSize} bytes`);
console.log(`Optimized: ${basicResult.optimizedSize} bytes`);
console.log(`Reduction: ${basicResult.reductionPercent.toFixed(2)}%`);
console.log(`Stages: ${basicResult.stagesApplied.join(', ')}\n`);

// Test BALANCED level
console.log('═'.repeat(70));
console.log('LEVEL: BALANCED (Numeric + Style, safe and fast)');
console.log('═'.repeat(70));
const balancedOptimizer = new OptimizerPipeline({ level: OptLevel.BALANCED });
balancedOptimizer.registerStage('basic-cleaning', basicCleaningStage);
balancedOptimizer.registerStage('numeric', numericStage);
balancedOptimizer.registerStage('style', styleStage);
balancedOptimizer.registerStage('tree-optimization', treeOptimizationStage);

const balancedResult = await balancedOptimizer.optimize(testSVG);
console.log(`Original: ${balancedResult.originalSize} bytes`);
console.log(`Optimized: ${balancedResult.optimizedSize} bytes`);
console.log(`Reduction: ${balancedResult.reductionPercent.toFixed(2)}%`);
console.log(`Stages: ${balancedResult.stagesApplied.join(', ')}`);
console.log(`\nOutput preview (first 300 chars):`);
console.log(balancedResult.optimizedSvg.substring(0, 300) + '...\n');

// Test AGGRESSIVE level
console.log('═'.repeat(70));
console.log('LEVEL: AGGRESSIVE (+ Transform + Path optimization)');
console.log('═'.repeat(70));
const aggressiveOptimizer = new OptimizerPipeline({ level: OptLevel.AGGRESSIVE });
aggressiveOptimizer.registerStage('basic-cleaning', basicCleaningStage);
aggressiveOptimizer.registerStage('numeric', numericStage);
aggressiveOptimizer.registerStage('style', styleStage);
aggressiveOptimizer.registerStage('transform', transformStage);
aggressiveOptimizer.registerStage('tree-optimization', treeOptimizationStage);
aggressiveOptimizer.registerStage('path-optimization', pathOptimizationStage);

const aggressiveResult = await aggressiveOptimizer.optimize(testSVG);
console.log(`Original: ${aggressiveResult.originalSize} bytes`);
console.log(`Optimized: ${aggressiveResult.optimizedSize} bytes`);
console.log(`Reduction: ${aggressiveResult.reductionPercent.toFixed(2)}%`);
console.log(`Stages: ${aggressiveResult.stagesApplied.join(', ')}`);
console.log(`\nOutput preview (first 300 chars):`);
console.log(aggressiveResult.optimizedSvg.substring(0, 300) + '...\n');

// Test MAXIMUM level
console.log('═'.repeat(70));
console.log('LEVEL: MAXIMUM (Everything enabled, most aggressive)');
console.log('═'.repeat(70));
const maximumOptimizer = new OptimizerPipeline({ level: OptLevel.MAXIMUM });
maximumOptimizer.registerStage('basic-cleaning', basicCleaningStage);
maximumOptimizer.registerStage('advanced-optimization', advancedOptimizationStage);
maximumOptimizer.registerStage('tree-optimization', treeOptimizationStage);

const maximumResult = await maximumOptimizer.optimize(testSVG);
console.log(`Original: ${maximumResult.originalSize} bytes`);
console.log(`Optimized: ${maximumResult.optimizedSize} bytes`);
console.log(`Reduction: ${maximumResult.reductionPercent.toFixed(2)}%`);
console.log(`Stages: ${maximumResult.stagesApplied.join(', ')}`);
console.log(`\nOutput preview (full):`);
console.log(maximumResult.optimizedSvg + '\n');

// Summary comparison
console.log('═'.repeat(70));
console.log('SUMMARY COMPARISON');
console.log('═'.repeat(70));
console.log('Level        | Size (bytes) | Reduction | Stages');
console.log('-'.repeat(70));
console.log(`ORIGINAL     | ${testSVG.length.toString().padEnd(12)} | -         | -`);
console.log(`BASIC        | ${basicResult.optimizedSize.toString().padEnd(12)} | ${basicResult.reductionPercent.toFixed(2)}%    | ${basicResult.stagesApplied.length}`);
console.log(`BALANCED     | ${balancedResult.optimizedSize.toString().padEnd(12)} | ${balancedResult.reductionPercent.toFixed(2)}%    | ${balancedResult.stagesApplied.length}`);
console.log(`AGGRESSIVE   | ${aggressiveResult.optimizedSize.toString().padEnd(12)} | ${aggressiveResult.reductionPercent.toFixed(2)}%    | ${aggressiveResult.stagesApplied.length}`);
console.log(`MAXIMUM      | ${maximumResult.optimizedSize.toString().padEnd(12)} | ${maximumResult.reductionPercent.toFixed(2)}%    | ${maximumResult.stagesApplied.length}`);

console.log('\n✅ Optimization level integration test complete!');
console.log('\nConfiguration summary:');
console.log('- BASIC: Minimal cleaning only (comments, whitespace)');
console.log('- BALANCED: + Numeric + Style (safe, fast, recommended)');
console.log('- AGGRESSIVE: + Transform + Path optimization (medium precision)');
console.log('- MAXIMUM: Everything enabled (lowest precision, most aggressive)');
