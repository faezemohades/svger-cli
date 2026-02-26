#!/usr/bin/env node

import { OptimizerPipeline, OptLevel, basicCleaningStage } from './dist/optimizers/index.js';
import { treeOptimizationStage } from './dist/optimizers/tree-stages.js';

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="used"><stop offset="0%" stop-color="#f00"/></linearGradient>
    <linearGradient id="unused"><stop offset="100%" stop-color="#00f"/></linearGradient>
    <filter id="f1"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g style="display:none"><circle cx="100" cy="100" r="50"/></g>
  <rect x="10" y="10" width="50" height="50" style="visibility:hidden"/>
  <g><g><circle cx="50" cy="50" r="20" fill="url(#used)"/></g></g>
  <g>
    <rect x="0" y="0" width="10" height="10" fill="red" opacity="0.5"/>
    <rect x="20" y="0" width="10" height="10" fill="red" opacity="0.5"/>
    <rect x="40" y="0" width="10" height="10" fill="red" opacity="0.5"/>
  </g>
  <text></text>
  <g></g>
  <path d="M 10 10 L 20 20" fill="blue" stroke="black"/>
</svg>`;

console.log('Original:', svg.length, 'bytes\n');

// BASIC
const basicPipe = new OptimizerPipeline({ level: OptLevel.BASIC });
basicPipe.registerStage('basic-cleaning', basicCleaningStage);
const basicResult = await basicPipe.optimize(svg);
console.log('BASIC:', basicResult.optimizedSvg.length, 'bytes');

// BALANCED
const balancedPipe = new OptimizerPipeline({ level: OptLevel.BALANCED });
balancedPipe.registerStage('basic-cleaning', basicCleaningStage);
balancedPipe.registerStage('tree-optimization', treeOptimizationStage);
const balancedResult = await balancedPipe.optimize(svg);
console.log('BALANCED:', balancedResult.optimizedSvg.length, 'bytes');
console.log('Output:', balancedResult.optimizedSvg);
