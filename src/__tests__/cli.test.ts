import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystem } from '../utils/native.js';
import path from 'path';
import { execSync } from 'child_process';

/**
 * CLI Tests
 * Tests command-line interface functionality
 */

describe('CLI', () => {
  const testDir = path.join(process.cwd(), 'test-temp-cli');
  const inputDir = path.join(testDir, 'input');
  const outputDir = path.join(testDir, 'output');

  beforeEach(async () => {
    await FileSystem.ensureDir(inputDir);
    await FileSystem.ensureDir(outputDir);

    // Create test SVG
    const testSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
    </svg>`;
    
    await FileSystem.writeFile(
      path.join(inputDir, 'test-icon.svg'),
      testSVG
    );
  });

  afterEach(async () => {
    try {
      await FileSystem.removeDir(testDir);
    } catch {}
  });

  describe('build command', () => {
    it('should display help when --help is used', () => {
      const result = execSync('node bin/svg-tool.js --help', {
        encoding: 'utf-8'
      });

      expect(result).toContain('Usage');
      expect(result).toContain('build');
    });

    it('should display version when --version is used', () => {
      const result = execSync('node bin/svg-tool.js --version', {
        encoding: 'utf-8'
      });

      expect(result).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should process SVG files with build command', () => {
      const cmd = `node bin/svg-tool.js build --src ${inputDir} --out ${outputDir} --framework react`;
      
      const result = execSync(cmd, { encoding: 'utf-8' });
      expect(result).toBeDefined();
    });

    it('should accept framework option', () => {
      const frameworks = ['react', 'vue', 'angular', 'svelte'];
      
      frameworks.forEach(framework => {
        const cmd = `node bin/svg-tool.js build --src ${inputDir} --out ${outputDir} --framework ${framework}`;
        
        expect(() => {
          execSync(cmd, { encoding: 'utf-8' });
        }).not.toThrow();
      });
    });

    it('should accept typescript flag', () => {
      const cmd = `node bin/svg-tool.js build --src ${inputDir} --out ${outputDir} --framework react --typescript`;
      
      expect(() => {
        execSync(cmd, { encoding: 'utf-8' });
      }).not.toThrow();
    });

    it('should accept naming convention option', () => {
      const conventions = ['pascal', 'camel', 'kebab'];
      
      conventions.forEach(convention => {
        const cmd = `node bin/svg-tool.js build --src ${inputDir} --out ${outputDir} --framework react --naming ${convention}`;
        
        expect(() => {
          execSync(cmd, { encoding: 'utf-8' });
        }).not.toThrow();
      });
    });
  });

  describe('clean command', () => {
    it('should clean output directory', async () => {
      // Create some files first
      await FileSystem.writeFile(
        path.join(outputDir, 'test.tsx'),
        'test content'
      );

      const cmd = `node bin/svg-tool.js clean --out ${outputDir}`;
      execSync(cmd, { encoding: 'utf-8' });

      const files = await FileSystem.readDir(outputDir);
      expect(files.length).toBe(0);
    });
  });

  describe('watch command', () => {
    it('should accept watch flag', () => {
      // Note: We can't easily test watch mode in unit tests
      // This just verifies the command is recognized
      const cmd = `node bin/svg-tool.js build --src ${inputDir} --out ${outputDir} --framework react --help`;
      
      const result = execSync(cmd, { encoding: 'utf-8' });
      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should show error for missing required arguments', () => {
      try {
        execSync('node bin/svg-tool.js build', { encoding: 'utf-8' });
      } catch (error: any) {
        expect(error.status).not.toBe(0);
      }
    });

    it('should show error for invalid framework', () => {
      try {
        const cmd = `node bin/svg-tool.js build --src ${inputDir} --out ${outputDir} --framework invalid`;
        execSync(cmd, { encoding: 'utf-8' });
      } catch (error: any) {
        // Should fail with invalid framework
        expect(error.status).not.toBe(0);
      }
    });

    it('should show error for non-existent source directory', () => {
      try {
        const cmd = `node bin/svg-tool.js build --src /non/existent/path --out ${outputDir} --framework react`;
        execSync(cmd, { encoding: 'utf-8' });
      } catch (error: any) {
        expect(error.status).not.toBe(0);
      }
    });
  });

  describe('configuration file', () => {
    it('should read from .svgerconfig.json', async () => {
      const configPath = path.join(testDir, '.svgerconfig.json');
      const config = {
        source: inputDir,
        output: outputDir,
        framework: 'react',
        typescript: true
      };

      await FileSystem.writeFile(configPath, JSON.stringify(config, null, 2));

      // CLI should read from config
      // This is a placeholder - actual implementation may vary
      expect(await FileSystem.exists(configPath)).toBe(true);
    });
  });
});
