/**
 * Plugin System Integration Example
 * Demonstrates how to use the Enhanced Plugin Manager with the optimizer pipeline
 */

import { OptimizerPipeline } from '../src/optimizers/optimizer-pipeline.js';
import { OptLevel, getDefaultOptConfig } from '../src/optimizers/types.js';
import { getPluginManager } from '../src/core/enhanced-plugin-manager.js';
import type {
  EnhancedPlugin,
  PluginHookContext,
} from '../src/types/plugin-system.js';
import { basicCleaningStage } from '../src/optimizers/basic-cleaner.js';
import { logger } from '../src/core/logger.js';

/**
 * Example: Color replacement plugin
 */
const colorReplacerPlugin: EnhancedPlugin = {
  name: 'color-replacer-example',
  version: '1.0.0',
  description: 'Replace colors in SVG files',
  hooks: {
    'after-parse': async (context: PluginHookContext) => {
      logger.info('🎨 Color Replacer: Processing SVG');

      // Replace black with blue
      const modifiedContent = context.content
        .replace(/fill="black"/g, 'fill="blue"')
        .replace(/stroke="black"/g, 'stroke="blue"');

      return {
        content: modifiedContent,
        metadata: {
          colorsReplaced: (context.content.match(/black/g) || []).length,
        },
      };
    },
  },
  validation: {
    enabled: true,
    maxDiffPercent: 100, // Color changes are expected
    options: {
      diff: { threshold: 0.1 },
    },
  },
};

/**
 * Example: Comment remover plugin
 */
const commentRemoverPlugin: EnhancedPlugin = {
  name: 'comment-remover-example',
  version: '1.0.0',
  description: 'Remove all comments from SVG',
  hooks: {
    'before-serialize': async (context: PluginHookContext) => {
      logger.info('🗑️  Comment Remover: Cleaning comments');

      // Remove HTML/XML comments
      const modifiedContent = context.content.replace(/<!--[\s\S]*?-->/g, '');

      const commentsRemoved = (context.content.match(/<!--/g) || []).length;

      return {
        content: modifiedContent,
        metadata: {
          commentsRemoved,
        },
      };
    },
  },
  validation: {
    enabled: true,
    maxDiffPercent: 0.1, // Comments shouldn't change visual output
    options: {
      diff: { threshold: 0.1 },
    },
  },
};

/**
 * Integrate plugins with optimizer pipeline
 */
export async function optimizeWithPlugins(
  svgContent: string,
  level: OptLevel = OptLevel.BALANCED
): Promise<{
  optimizedSvg: string;
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
  pluginMetrics: any;
}> {
  // Get plugin manager
  const pluginManager = getPluginManager();

  // Register plugins
  pluginManager.registerPlugin(colorReplacerPlugin);
  pluginManager.registerPlugin(commentRemoverPlugin);

  // Create optimizer pipeline
  const optimizer = new OptimizerPipeline({ level });
  optimizer.registerStage('basic-cleaning', basicCleaningStage);

  // Create plugin context
  const config = getDefaultOptConfig(level);
  const metadata = new Map<string, any>();

  // 1. Execute before-parse hooks
  logger.info('📋 Step 1: Executing before-parse hooks');
  let currentContext: PluginHookContext = {
    content: svgContent,
    config,
    originalContent: svgContent,
    metadata,
  };

  currentContext = await pluginManager.executeHook(
    'before-parse',
    currentContext
  );

  // 2. Execute after-parse hooks (before optimization)
  logger.info('📋 Step 2: Executing after-parse hooks');
  currentContext = await pluginManager.executeHook(
    'after-parse',
    currentContext
  );

  // 3. Run optimizer pipeline
  logger.info('📋 Step 3: Running optimizer pipeline');
  const optimizerResult = await optimizer.optimize(currentContext.content);

  // 4. Execute before-serialize hooks
  logger.info('📋 Step 4: Executing before-serialize hooks');
  currentContext.content = optimizerResult.optimizedSvg;
  currentContext = await pluginManager.executeHook(
    'before-serialize',
    currentContext
  );

  // 5. Execute after-serialize hooks
  logger.info('📋 Step 5: Executing after-serialize hooks');
  currentContext = await pluginManager.executeHook(
    'after-serialize',
    currentContext
  );

  // Get plugin metrics
  const pluginMetrics = pluginManager.getMetricsSummary();

  logger.info('✅ Optimization with plugins complete');
  logger.info(
    `📊 Plugins executed: ${pluginMetrics.totalExecutions} times in ${pluginMetrics.totalExecutionTime.toFixed(2)}ms`
  );

  // Calculate final stats
  const originalSize = Buffer.byteLength(svgContent, 'utf8');
  const optimizedSize = Buffer.byteLength(currentContext.content, 'utf8');
  const reductionPercent =
    ((originalSize - optimizedSize) / originalSize) * 100;

  return {
    optimizedSvg: currentContext.content,
    originalSize,
    optimizedSize,
    reductionPercent,
    pluginMetrics,
  };
}

/**
 * Example usage demonstration
 */
export async function demonstratePluginSystem(): Promise<void> {
  logger.info('🚀 Plugin System Integration Demo');
  logger.info('='.repeat(60));

  const exampleSVG = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <!-- This is a comment -->
  <rect x="0" y="0" width="50" height="50" fill="black" />
  <circle cx="75" cy="75" r="20" stroke="black" fill="none" />
  <!-- Another comment -->
</svg>`;

  logger.info(
    `📝 Original SVG (${Buffer.byteLength(exampleSVG, 'utf8')} bytes):`
  );
  logger.info(exampleSVG);
  logger.info('');

  // Optimize with plugins
  const result = await optimizeWithPlugins(exampleSVG, OptLevel.BALANCED);

  logger.info(
    `📦 Optimized SVG (${result.optimizedSize} bytes, ${result.reductionPercent.toFixed(2)}% reduction):`
  );
  logger.info(result.optimizedSvg);
  logger.info('');

  logger.info('📊 Plugin Execution Summary:');
  logger.info(`  Total plugins: ${result.pluginMetrics.totalPlugins}`);
  logger.info(`  Total executions: ${result.pluginMetrics.totalExecutions}`);
  logger.info(
    `  Average execution time: ${result.pluginMetrics.averageExecutionTime.toFixed(2)}ms`
  );
  logger.info(
    `  Validations passed: ${result.pluginMetrics.validationsPassed}`
  );
  logger.info(
    `  Validations failed: ${result.pluginMetrics.validationsFailed}`
  );
  logger.info('='.repeat(60));

  // Get plugin manager and list plugins
  const pluginManager = getPluginManager();
  const plugins = pluginManager.listPlugins();

  logger.info('📋 Registered Plugins:');
  plugins.forEach(plugin => {
    logger.info(`  - ${plugin.name} v${plugin.version}`);
    logger.info(`    Hooks: ${plugin.hooks.join(', ')}`);
    if (plugin.description) {
      logger.info(`    Description: ${plugin.description}`);
    }
  });

  // Cleanup
  pluginManager.clearPlugins();
  logger.info('');
  logger.info('✅ Demo complete - plugins cleared');
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstratePluginSystem().catch(error => {
    logger.error('Demo failed:', error);
    process.exit(1);
  });
}
