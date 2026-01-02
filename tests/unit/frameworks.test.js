#!/usr/bin/env node

/**
 * Framework Testing Script for SVGER-CLI
 * Tests all 9 supported frameworks: React, React Native, Vue, Svelte, Angular, Solid, Preact, Lit, Vanilla
 */

import { frameworkTemplateEngine } from './dist/index.js';
import fs from 'fs';
import path from 'path';

const testSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
</svg>`;

const frameworks = [
  { name: 'react', typescript: true, options: {} },
  { name: 'react-native', typescript: true, options: {} },
  { name: 'vue', typescript: true, options: { scriptSetup: true } },
  { name: 'vue', typescript: true, options: { scriptSetup: false } },
  { name: 'svelte', typescript: true, options: {} },
  { name: 'angular', typescript: true, options: { standalone: true } },
  { name: 'angular', typescript: true, options: { standalone: false } },
  { name: 'solid', typescript: true, options: {} },
  { name: 'preact', typescript: true, options: {} },
  { name: 'lit', typescript: true, options: {} },
  { name: 'vanilla', typescript: true, options: {} },
];

console.log('🚀 SVGER-CLI Framework Testing Suite\n');
console.log('='.repeat(80));

const testOutputDir = path.join(process.cwd(), 'test-output');
if (!fs.existsSync(testOutputDir)) {
  fs.mkdirSync(testOutputDir, { recursive: true });
}

let passed = 0;
let failed = 0;

frameworks.forEach((config, index) => {
  const { name, typescript, options } = config;
  const variant =
    options.scriptSetup !== undefined
      ? options.scriptSetup
        ? '-composition'
        : '-options'
      : options.standalone !== undefined
        ? options.standalone
          ? '-standalone'
          : '-module'
        : '';

  const testName = `${name}${variant}`;

  try {
    console.log(
      `\n[${index + 1}/${frameworks.length}] Testing: ${testName.toUpperCase()}`
    );
    console.log('-'.repeat(80));

    const componentOptions = {
      framework: name,
      componentName: 'TestIcon',
      svgContent: testSVG,
      typescript,
      frameworkOptions: options,
    };

    // Generate component
    const component =
      frameworkTemplateEngine.generateComponent(componentOptions);

    // Validate component
    if (!component || component.length === 0) {
      throw new Error('Generated component is empty');
    }

    // Get file extension
    const extension = frameworkTemplateEngine.getFileExtension(
      name,
      typescript
    );

    // Save to file
    const fileName = `TestIcon-${testName}.${extension}`;
    const filePath = path.join(testOutputDir, fileName);
    fs.writeFileSync(filePath, component, 'utf8');

    // Framework-specific validation
    switch (name) {
      case 'react':
      case 'react-native':
      case 'preact':
      case 'solid':
        if (!component.includes('export default')) {
          throw new Error('Missing default export');
        }
        if (!component.includes('interface')) {
          throw new Error('Missing TypeScript interface');
        }
        if (name === 'react-native') {
          if (!component.includes('react-native-svg')) {
            throw new Error('Missing react-native-svg import');
          }
          if (!component.includes('Svg')) {
            throw new Error('Missing Svg component');
          }
        }
        break;

      case 'vue':
        if (!component.includes('<template>')) {
          throw new Error('Missing Vue template section');
        }
        if (!component.includes('<script')) {
          throw new Error('Missing Vue script section');
        }
        if (options.scriptSetup && !component.includes('setup')) {
          throw new Error('Missing composition API setup');
        }
        break;

      case 'svelte':
        if (!component.includes('<script')) {
          throw new Error('Missing Svelte script section');
        }
        if (!component.includes('export let')) {
          throw new Error('Missing Svelte props');
        }
        break;

      case 'angular':
        if (!component.includes('@Component')) {
          throw new Error('Missing Angular decorator');
        }
        if (!component.includes('selector:')) {
          throw new Error('Missing component selector');
        }
        if (options.standalone && !component.includes('standalone: true')) {
          throw new Error('Missing standalone flag');
        }
        break;

      case 'lit':
        if (!component.includes('@customElement')) {
          throw new Error('Missing Lit decorator');
        }
        if (!component.includes('extends LitElement')) {
          throw new Error('Not extending LitElement');
        }
        break;

      case 'vanilla':
        if (!component.includes('export function')) {
          throw new Error('Missing function export');
        }
        if (!component.includes('document.createElementNS')) {
          throw new Error('Missing DOM manipulation');
        }
        break;
    }

    console.log(`✅ SUCCESS: Generated valid ${name.toUpperCase()} component`);
    console.log(`   📄 File: ${fileName}`);
    console.log(`   📏 Size: ${component.length} characters`);
    console.log(`   📝 Extension: .${extension}`);

    passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${testName.toUpperCase()}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
});

console.log('\n' + '='.repeat(80));
console.log('\n📊 Test Results Summary\n');
console.log(`   Total Tests: ${frameworks.length}`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📂 Output: ${testOutputDir}\n`);

if (failed === 0) {
  console.log('🎉 All framework tests passed successfully!\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the errors above.\n');
  process.exit(1);
}
