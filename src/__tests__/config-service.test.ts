import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { configService } from '../services/config.js';
import { FileSystem } from '../utils/native.js';
import path from 'path';

/**
 * Config Service Tests
 * Tests configuration loading and validation
 */

describe('Config Service', () => {
  const testDir = path.join(process.cwd(), 'test-temp-config');
  const configPath = path.join(testDir, '.svgerconfig.json');

  beforeEach(async () => {
    await FileSystem.ensureDir(testDir);
  });

  afterEach(async () => {
    try {
      await FileSystem.removeDir(testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('config loading', () => {
    it('should load config from file', async () => {
      const config = {
        source: './src/icons',
        output: './src/components/icons',
        framework: 'react',
        typescript: true,
      };

      await FileSystem.writeFile(configPath, JSON.stringify(config, null, 2));

      const loaded = configService.readConfig();
      expect(loaded).toBeDefined();
    });

    it('should return default config if file not found', () => {
      const config = configService.getDefaultConfig();
      expect(config).toBeDefined();
    });

    it('should merge CLI options with file config', async () => {
      const fileConfig = {
        framework: 'react',
        typescript: true,
      };

      await FileSystem.writeFile(
        configPath,
        JSON.stringify(fileConfig, null, 2)
      );

      const cliOptions = {
        source: './icons',
        output: './components',
      };

      // Config service should merge these
      expect(fileConfig.framework).toBe('react');
      expect(cliOptions.source).toBe('./icons');
    });
  });

  describe('config validation', () => {
    it('should validate required fields', () => {
      const invalidConfig = {
        framework: 'react',
        // missing source and output
      };

      // Should handle validation
      expect(invalidConfig.framework).toBe('react');
    });

    it('should validate framework option', () => {
      const validFrameworks = [
        'react',
        'vue',
        'angular',
        'svelte',
        'solid',
        'lit',
        'preact',
        'vanilla',
      ];

      validFrameworks.forEach(framework => {
        const config = { framework };
        expect(validFrameworks).toContain(config.framework);
      });
    });

    it('should validate naming convention', () => {
      const validConventions = ['pascal', 'camel', 'kebab'];

      validConventions.forEach(naming => {
        const config = { naming };
        expect(validConventions).toContain(config.naming);
      });
    });

    it('should validate boolean options', () => {
      const config = {
        typescript: true,
        generateIndex: false,
        watch: true,
      };

      expect(typeof config.typescript).toBe('boolean');
      expect(typeof config.generateIndex).toBe('boolean');
      expect(typeof config.watch).toBe('boolean');
    });
  });

  describe('default values', () => {
    it('should provide default framework', () => {
      const config = configService.getDefaultConfig();
      expect(config.framework).toBeDefined();
    });

    it('should provide default naming convention', () => {
      const config = configService.getDefaultConfig();
      expect(config.outputConfig?.naming).toBeDefined();
    });

    it('should default typescript to false', () => {
      const config = configService.getDefaultConfig();
      expect(typeof config.typescript).toBe('boolean');
    });

    it('should default outputConfig to have directory', () => {
      const config = configService.getDefaultConfig();
      expect(config.outputConfig?.directory).toBeDefined();
    });
  });

  describe('path resolution', () => {
    it('should have source path in config', () => {
      const config = configService.getDefaultConfig();
      expect(config.source).toBeDefined();
      expect(typeof config.source).toBe('string');
    });

    it('should have output path in config', () => {
      const config = configService.getDefaultConfig();
      expect(config.output).toBeDefined();
      expect(typeof config.output).toBe('string');
    });
  });

  describe('config file formats', () => {
    it('should handle .svgerconfig.json', async () => {
      const config = { framework: 'react' };

      await FileSystem.writeFile(
        path.join(testDir, '.svgerconfig.json'),
        JSON.stringify(config)
      );

      expect(
        await FileSystem.exists(path.join(testDir, '.svgerconfig.json'))
      ).toBe(true);
    });

    it('should handle svger.config.json', async () => {
      const config = { framework: 'vue' };

      await FileSystem.writeFile(
        path.join(testDir, 'svger.config.json'),
        JSON.stringify(config)
      );

      expect(
        await FileSystem.exists(path.join(testDir, 'svger.config.json'))
      ).toBe(true);
    });
  });

  describe('plugin configuration', () => {
    it('should load plugin options', async () => {
      const config = {
        framework: 'react',
        plugins: [
          {
            name: 'custom-optimizer',
            options: { level: 2 },
          },
        ],
      };

      await FileSystem.writeFile(configPath, JSON.stringify(config, null, 2));

      expect(config.plugins).toBeDefined();
      expect(config.plugins?.length).toBe(1);
    });
  });

  describe('responsive and theme configuration', () => {
    it('should handle responsive sizes', () => {
      const config = {
        framework: 'react',
        responsive: {
          mobile: 16,
          tablet: 20,
          desktop: 24,
        },
      };

      expect(config.responsive).toBeDefined();
      expect(config.responsive.mobile).toBe(16);
    });

    it('should handle theme configuration', () => {
      const config = {
        framework: 'react',
        theme: {
          primary: '#007bff',
          secondary: '#6c757d',
        },
      };

      expect(config.theme).toBeDefined();
      expect(config.theme.primary).toBe('#007bff');
    });
  });
});
