/**
 * Enhanced Plugin Manager Tests
 * Comprehensive test suite for plugin system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  EnhancedPluginManager,
  getPluginManager,
  resetPluginManager,
} from '../core/enhanced-plugin-manager.js';
import type {
  EnhancedPlugin,
  PluginHookContext,
} from '../types/plugin-system.js';
import { OptLevel, getDefaultOptConfig } from '../optimizers/types.js';

describe('EnhancedPluginManager', () => {
  let manager: EnhancedPluginManager;

  beforeEach(() => {
    resetPluginManager();
    manager = getPluginManager();
  });

  afterEach(() => {
    manager.clearPlugins();
  });

  describe('Plugin Registration', () => {
    it('should register a valid plugin', () => {
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin);
      expect(manager.hasPlugin('test-plugin')).toBe(true);
      expect(manager.pluginCount).toBe(1);
    });

    it('should reject plugin without name or version', () => {
      const plugin = {
        name: '',
        version: '1.0.0',
        hooks: {},
      } as EnhancedPlugin;

      expect(() => manager.registerPlugin(plugin)).toThrow();
    });

    it('should reject plugin with no hooks', () => {
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {},
      } as EnhancedPlugin;

      expect(() => manager.registerPlugin(plugin)).toThrow();
    });

    it('should reject plugin with invalid hook type', () => {
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'invalid-hook': async (ctx: PluginHookContext) => ({
            content: ctx.content,
          }),
        },
      } as unknown as EnhancedPlugin;

      expect(() => manager.registerPlugin(plugin)).toThrow();
    });

    it('should call plugin init on registration', async () => {
      let initialized = false;
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
        init: async () => {
          initialized = true;
        },
      };

      await manager.registerPlugin(plugin);
      expect(initialized).toBe(true);
    });

    it('should not register duplicate plugins', () => {
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin);
      expect(() => manager.registerPlugin(plugin)).toThrow(); // Duplicate
    });
  });

  describe('Plugin Unregistration', () => {
    it('should unregister a plugin', () => {
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin);
      expect(manager.hasPlugin('test-plugin')).toBe(true);

      manager.unregisterPlugin('test-plugin');
      expect(manager.hasPlugin('test-plugin')).toBe(false);
      expect(manager.pluginCount).toBe(0);
    });

    it('should call plugin cleanup on unregistration', async () => {
      let cleanedUp = false;
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
        cleanup: async () => {
          cleanedUp = true;
        },
      };

      await manager.registerPlugin(plugin);
      await manager.unregisterPlugin('test-plugin');
      expect(cleanedUp).toBe(true);
    });
  });

  describe('Hook Execution', () => {
    it('should execute plugins for a specific hook', async () => {
      let executed = false;
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => {
            executed = true;
            return { content: ctx.content };
          },
        },
      };

      manager.registerPlugin(plugin);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      await manager.executeHook('after-parse', context);
      expect(executed).toBe(true);
    });

    it('should not execute plugins for hooks they do not implement', async () => {
      let executed = false;
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => {
            executed = true;
            return { content: ctx.content };
          },
        },
      };

      manager.registerPlugin(plugin);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      await manager.executeHook('before-parse', context);
      expect(executed).toBe(false);
    });

    it('should pass context through plugin chain', async () => {
      const plugin1: EnhancedPlugin = {
        name: 'plugin-1',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({
            content: ctx.content + '<!-- plugin1 -->',
          }),
        },
      };

      const plugin2: EnhancedPlugin = {
        name: 'plugin-2',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({
            content: ctx.content + '<!-- plugin2 -->',
          }),
        },
      };

      manager.registerPlugin(plugin1);
      manager.registerPlugin(plugin2);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      const result = await manager.executeHook('after-parse', context);
      expect(result.content).toBe(
        '<svg></svg><!-- plugin1 --><!-- plugin2 -->'
      );
    });

    it('should support skipRemaining flag', async () => {
      let plugin2Executed = false;

      const plugin1: EnhancedPlugin = {
        name: 'plugin-1',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({
            content: ctx.content,
            skipRemaining: true,
          }),
        },
      };

      const plugin2: EnhancedPlugin = {
        name: 'plugin-2',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => {
            plugin2Executed = true;
            return { content: ctx.content };
          },
        },
      };

      manager.registerPlugin(plugin1);
      manager.registerPlugin(plugin2);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      await manager.executeHook('after-parse', context);
      expect(plugin2Executed).toBe(false);
    });

    it('should handle plugin errors gracefully', async () => {
      const plugin1: EnhancedPlugin = {
        name: 'plugin-1',
        version: '1.0.0',
        hooks: {
          'after-parse': async () => {
            throw new Error('Plugin error');
          },
        },
      };

      const plugin2: EnhancedPlugin = {
        name: 'plugin-2',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({
            content: ctx.content + '<!-- plugin2 -->',
          }),
        },
      };

      manager.registerPlugin(plugin1);
      manager.registerPlugin(plugin2);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      const result = await manager.executeHook('after-parse', context);
      // Plugin 2 should still execute even if plugin 1 fails
      expect(result.content).toBe('<svg></svg><!-- plugin2 -->');
    });

    it('should update metadata through plugin chain', async () => {
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({
            content: ctx.content,
            metadata: { processedBy: 'test-plugin' },
          }),
        },
      };

      manager.registerPlugin(plugin);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      const result = await manager.executeHook('after-parse', context);
      expect(result.metadata).toEqual({ processedBy: 'test-plugin' });
    });
  });

  describe('Metrics Tracking', () => {
    it('should track execution metrics', async () => {
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      await manager.executeHook('after-parse', context);

      const metrics = manager.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].pluginName).toBe('test-plugin');
      expect(metrics[0].hookType).toBe('after-parse');
      expect(metrics[0].executionTime).toBeGreaterThan(0);
    });

    it('should clear metrics', async () => {
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      await manager.executeHook('after-parse', context);
      expect(manager.getMetrics()).toHaveLength(1);

      manager.clearMetrics();
      expect(manager.getMetrics()).toHaveLength(0);
    });

    it('should generate metrics summary', async () => {
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin);

      const context: PluginHookContext = {
        content: '<svg></svg>',
        config: getDefaultOptConfig(OptLevel.BASIC),
        metadata: new Map(),
      };

      await manager.executeHook('after-parse', context);
      await manager.executeHook('after-parse', context);

      const summary = manager.getMetricsSummary();
      expect(summary.totalPlugins).toBe(1);
      expect(summary.totalExecutions).toBe(2);
      expect(summary.totalExecutionTime).toBeGreaterThan(0);
      expect(summary.averageExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Plugin Listing', () => {
    it('should list all registered plugins', () => {
      const plugin1: EnhancedPlugin = {
        name: 'plugin-1',
        version: '1.0.0',
        description: 'Test plugin 1',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      const plugin2: EnhancedPlugin = {
        name: 'plugin-2',
        version: '2.0.0',
        description: 'Test plugin 2',
        hooks: {
          'before-parse': async ctx => ({ content: ctx.content }),
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin1);
      manager.registerPlugin(plugin2);

      const plugins = manager.listPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('plugin-1');
      expect(plugins[0].hooks).toEqual(['after-parse']);
      expect(plugins[1].name).toBe('plugin-2');
      expect(plugins[1].hooks).toEqual(['before-parse', 'after-parse']);
    });

    it('should get specific plugin', () => {
      const plugin: EnhancedPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin);

      const retrieved = manager.getPlugin('test-plugin');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-plugin');
    });
  });

  describe('Visual Validation Control', () => {
    it('should allow enabling/disabling visual validation', () => {
      manager.setVisualValidation(false);
      // Validation state is internal, but we can test it doesn't crash
      expect(manager.pluginCount).toBe(0);

      manager.setVisualValidation(true);
      expect(manager.pluginCount).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getPluginManager();
      const instance2 = getPluginManager();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getPluginManager();
      resetPluginManager();
      const instance2 = getPluginManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Clear All Plugins', () => {
    it('should clear all plugins and metrics', () => {
      const plugin1: EnhancedPlugin = {
        name: 'plugin-1',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      const plugin2: EnhancedPlugin = {
        name: 'plugin-2',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
      };

      manager.registerPlugin(plugin1);
      manager.registerPlugin(plugin2);
      expect(manager.pluginCount).toBe(2);

      manager.clearPlugins();
      expect(manager.pluginCount).toBe(0);
      expect(manager.getMetrics()).toHaveLength(0);
    });

    it('should call cleanup for all plugins when clearing', async () => {
      let cleanup1Called = false;
      let cleanup2Called = false;

      const plugin1: EnhancedPlugin = {
        name: 'plugin-1',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
        cleanup: async () => {
          cleanup1Called = true;
        },
      };

      const plugin2: EnhancedPlugin = {
        name: 'plugin-2',
        version: '1.0.0',
        hooks: {
          'after-parse': async ctx => ({ content: ctx.content }),
        },
        cleanup: async () => {
          cleanup2Called = true;
        },
      };

      await manager.registerPlugin(plugin1);
      await manager.registerPlugin(plugin2);

      await manager.clearPlugins();
      expect(cleanup1Called).toBe(true);
      expect(cleanup2Called).toBe(true);
    });
  });
});
