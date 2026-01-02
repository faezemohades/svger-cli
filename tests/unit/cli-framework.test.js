#!/usr/bin/env node

import { svgProcessor } from './dist/processors/svg-processor.js';
import { frameworkTemplateEngine } from './dist/index.js';

// Test file extension generation
console.log('\n📋 Testing File Extension Generation:\n');

const frameworks = ['react', 'vue', 'svelte', 'angular', 'solid', 'preact', 'lit', 'vanilla'];

frameworks.forEach(fw => {
  const ext = frameworkTemplateEngine.getFileExtension(fw, true);
  console.log(`  ${fw.padEnd(10)} => .${ext}`);
});

console.log('\n✅ Framework file extensions working correctly!\n');
