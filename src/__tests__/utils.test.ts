import { describe, it, expect } from '@jest/globals';
import {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  FileSystem,
} from '../utils/native.js';
import path from 'path';

/**
 * Utility Functions Tests
 * Tests native utility functions
 */

describe('String Utilities', () => {
  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('hello-world')).toBe('HelloWorld');
      expect(toPascalCase('arrow-left')).toBe('ArrowLeft');
      expect(toPascalCase('user-profile-icon')).toBe('UserProfileIcon');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('hello_world')).toBe('HelloWorld');
      expect(toPascalCase('user_icon')).toBe('UserIcon');
    });

    it('should convert space-separated to PascalCase', () => {
      expect(toPascalCase('hello world')).toBe('HelloWorld');
      expect(toPascalCase('user profile')).toBe('UserProfile');
    });

    it('should preserve existing PascalCase', () => {
      expect(toPascalCase('HelloWorld')).toBe('HelloWorld');
      expect(toPascalCase('ArrowBendDownLeft')).toBe('ArrowBendDownLeft');
    });

    it('should handle single word', () => {
      expect(toPascalCase('hello')).toBe('Hello');
      expect(toPascalCase('icon')).toBe('Icon');
    });

    it('should handle empty string', () => {
      expect(toPascalCase('')).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld');
      expect(toCamelCase('user-icon')).toBe('userIcon');
    });

    it('should convert PascalCase to camelCase', () => {
      expect(toCamelCase('HelloWorld')).toBe('helloWorld');
      expect(toCamelCase('UserIcon')).toBe('userIcon');
    });

    it('should handle single word', () => {
      expect(toCamelCase('hello')).toBe('hello');
      expect(toCamelCase('Icon')).toBe('icon');
    });
  });

  describe('toKebabCase', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('HelloWorld')).toBe('hello-world');
      expect(toKebabCase('UserProfileIcon')).toBe('user-profile-icon');
    });

    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('helloWorld')).toBe('hello-world');
      expect(toKebabCase('userIcon')).toBe('user-icon');
    });

    it('should convert snake_case to kebab-case', () => {
      expect(toKebabCase('hello_world')).toBe('hello-world');
    });

    it('should convert spaces to kebab-case', () => {
      expect(toKebabCase('hello world')).toBe('hello-world');
    });

    it('should handle already kebab-case', () => {
      expect(toKebabCase('hello-world')).toBe('hello-world');
    });
  });
});

describe('FileSystem Utilities', () => {
  const testDir = path.join(process.cwd(), 'test-temp-fs');
  const testFile = path.join(testDir, 'test.txt');

  afterEach(async () => {
    try {
      await FileSystem.removeDir(testDir);
    } catch {}
  });

  describe('ensureDir', () => {
    it('should create directory if not exists', async () => {
      await FileSystem.ensureDir(testDir);
      expect(await FileSystem.exists(testDir)).toBe(true);
    });

    it('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'level1', 'level2');
      await FileSystem.ensureDir(nestedDir);
      expect(await FileSystem.exists(nestedDir)).toBe(true);
    });

    it('should not fail if directory exists', async () => {
      await FileSystem.ensureDir(testDir);
      await expect(FileSystem.ensureDir(testDir)).resolves.not.toThrow();
    });
  });

  describe('writeFile and readFile', () => {
    it('should write and read text file', async () => {
      await FileSystem.ensureDir(testDir);
      const content = 'Hello, World!';

      await FileSystem.writeFile(testFile, content);
      const read = await FileSystem.readFile(testFile);

      expect(read).toBe(content);
    });

    it('should handle UTF-8 content', async () => {
      await FileSystem.ensureDir(testDir);
      const content = '你好世界 🚀';

      await FileSystem.writeFile(testFile, content);
      const read = await FileSystem.readFile(testFile);

      expect(read).toBe(content);
    });
  });

  describe('exists', () => {
    it('should return true for existing path', async () => {
      await FileSystem.ensureDir(testDir);
      expect(await FileSystem.exists(testDir)).toBe(true);
    });

    it('should return false for non-existing path', async () => {
      const nonExistent = path.join(testDir, 'does-not-exist');
      expect(await FileSystem.exists(nonExistent)).toBe(false);
    });
  });

  describe('removeDir', () => {
    it('should remove empty directory', async () => {
      await FileSystem.ensureDir(testDir);
      await FileSystem.removeDir(testDir);
      expect(await FileSystem.exists(testDir)).toBe(false);
    });

    it('should remove directory with files', async () => {
      await FileSystem.ensureDir(testDir);
      await FileSystem.writeFile(testFile, 'test');

      await FileSystem.removeDir(testDir);
      expect(await FileSystem.exists(testDir)).toBe(false);
    });
  });

  describe('emptyDir', () => {
    it('should empty directory content', async () => {
      await FileSystem.ensureDir(testDir);
      await FileSystem.writeFile(testFile, 'test');

      await FileSystem.emptyDir(testDir);

      expect(await FileSystem.exists(testDir)).toBe(true);
      expect(await FileSystem.exists(testFile)).toBe(false);
    });

    it('should handle non-existing directory', async () => {
      await expect(FileSystem.emptyDir(testDir)).resolves.not.toThrow();
    });
  });
});
