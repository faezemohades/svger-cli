#!/usr/bin/env node

/**
 * Interactive test utility for svger-cli
 * Allows users to quickly test the tool with sample SVGs
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ASSETS_DIR = join(__dirname, '../assets/svges');
const OUTPUT_DIR = join(process.cwd(), 'svger-test-output');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

async function main() {
  console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════════╗
║                    SVGER-CLI Test Utility                      ║
║                  Quick Test with Sample SVGs                   ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  // Check if assets directory exists
  if (!existsSync(ASSETS_DIR)) {
    console.error(`${colors.yellow}⚠️  Sample SVGs not found at: ${ASSETS_DIR}${colors.reset}`);
    console.log(`\nThe sample SVGs are available in the GitHub repository but not included in this installation.`);
    console.log(`\nYou can:`);
    console.log(`  1. Clone the repo: git clone https://github.com/faezemohades/svger-cli`);
    console.log(`  2. Try the online demo: https://faezemohades.github.io/svger-cli/#live-benchmark`);
    console.log(`  3. Use your own SVGs: svger-cli --input ./your-svgs --output ./components`);
    process.exit(1);
  }

  // Get all SVG files
  const files = await readdir(ASSETS_DIR);
  const svgFiles = files.filter(f => f.endsWith('.svg'));

  console.log(`${colors.green}✓ Found ${svgFiles.length} sample SVG files${colors.reset}\n`);

  // Show sample files (first 10)
  console.log(`${colors.bright}Sample SVGs (showing first 10):${colors.reset}`);
  svgFiles.slice(0, 10).forEach((file, i) => {
    console.log(`  ${i + 1}. ${file}`);
  });
  if (svgFiles.length > 10) {
    console.log(`  ... and ${svgFiles.length - 10} more\n`);
  }

  // Get test options from args
  const args = process.argv.slice(2);
  const framework = args.find(a => a.startsWith('--framework='))?.split('=')[1] || 'react';
  const count = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1]) || 10;
  const typescript = args.includes('--typescript');

  console.log(`${colors.bright}Test Configuration:${colors.reset}`);
  console.log(`  Framework: ${colors.cyan}${framework}${colors.reset}`);
  console.log(`  Files to process: ${colors.cyan}${Math.min(count, svgFiles.length)}${colors.reset}`);
  console.log(`  TypeScript: ${colors.cyan}${typescript ? 'Yes' : 'No'}${colors.reset}`);
  console.log(`  Output directory: ${colors.cyan}${OUTPUT_DIR}${colors.reset}\n`);

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Build command
  const cmd = [
    'svger-cli',
    '--input', ASSETS_DIR,
    '--output', OUTPUT_DIR,
    '--framework', framework,
    typescript ? '--typescript' : '',
    `--file-limit ${count}`,
  ].filter(Boolean).join(' ');

  console.log(`${colors.bright}Running command:${colors.reset}`);
  console.log(`  ${colors.blue}${cmd}${colors.reset}\n`);

  // Run the command
  const startTime = Date.now();
  try {
    execSync(cmd, { stdio: 'inherit' });
    const duration = Date.now() - startTime;

    console.log(`\n${colors.green}${colors.bright}✓ Test completed successfully!${colors.reset}`);
    console.log(`  Duration: ${colors.cyan}${duration}ms${colors.reset}`);
    console.log(`  Output: ${colors.cyan}${OUTPUT_DIR}${colors.reset}\n`);

    console.log(`${colors.bright}Next steps:${colors.reset}`);
    console.log(`  1. Check the output: ${colors.cyan}cd ${OUTPUT_DIR}${colors.reset}`);
    console.log(`  2. View generated files: ${colors.cyan}ls -la${colors.reset}`);
    console.log(`  3. Test with different framework: ${colors.cyan}test-svger --framework=vue${colors.reset}\n`);

    console.log(`${colors.bright}Try online demo:${colors.reset}`);
    console.log(`  ${colors.blue}https://faezemohades.github.io/svger-cli/#live-benchmark${colors.reset}\n`);

  } catch (error) {
    console.error(`\n${colors.yellow}❌ Test failed${colors.reset}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
${colors.bright}SVGER-CLI Test Utility${colors.reset}

Quick testing with sample SVG files included in the package.

${colors.bright}Usage:${colors.reset}
  test-svger [options]

${colors.bright}Options:${colors.reset}
  --framework=<name>     Framework to use (react, vue, angular, svelte, etc.)
                         Default: react
  
  --count=<number>       Number of SVG files to process
                         Default: 10
  
  --typescript           Generate TypeScript components
  
  --help, -h            Show this help message

${colors.bright}Examples:${colors.reset}
  # Test with React (default)
  test-svger

  # Test with Vue and TypeScript
  test-svger --framework=vue --typescript

  # Process 20 files with Angular
  test-svger --framework=angular --count=20

  # Test all available SVGs
  test-svger --count=999

${colors.bright}Online Demo:${colors.reset}
  Try the interactive benchmark in your browser:
  ${colors.blue}https://faezemohades.github.io/svger-cli/#live-benchmark${colors.reset}

${colors.bright}Documentation:${colors.reset}
  ${colors.blue}https://github.com/faezemohades/svger-cli${colors.reset}
`);
  process.exit(0);
}

main().catch(console.error);
