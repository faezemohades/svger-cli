# Plugin Development Guide

**Version:** v3.2.0+  
**Status:** Phase 6.2 - Plugin System Foundation  
**Last Updated:** January 2, 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Plugin Architecture](#plugin-architecture)
3. [Quick Start](#quick-start)
4. [Plugin API Reference](#plugin-api-reference)
5. [Hook Types](#hook-types)
6. [Visual Validation](#visual-validation)
7. [Example Plugins](#example-plugins)
8. [Best Practices](#best-practices)
9. [Testing Your Plugin](#testing-your-plugin)
10. [Publishing Your Plugin](#publishing-your-plugin)

---

## Introduction

The svger-cli plugin system allows you to extend the SVG optimization pipeline with custom transformations. Plugins can:

- ✅ Hook into 6 pipeline stages (before/after parse, stage, serialize)
- ✅ Modify SVG content at any point in the optimization process
- ✅ Validate changes with pixel-perfect visual diff testing
- ✅ Track execution metrics and performance
- ✅ Access optimization configuration
- ✅ Pass metadata between hooks

**Use Cases:**
- Color palette replacement
- Watermark removal
- Custom attribute cleanup
- Gradient optimization
- Shape merging
- Text path conversion

---

## Plugin Architecture

### Pipeline Flow

```
Input SVG
    ↓
┌───────────────┐
│ before-parse  │ ← Hook: Pre-processing (remove watermarks, etc.)
└───────────────┘
    ↓
┌───────────────┐
│  SVG Parser   │
└───────────────┘
    ↓
┌───────────────┐
│  after-parse  │ ← Hook: Post-parse modifications (color replacement)
└───────────────┘
    ↓
┌───────────────┐
│ before-stage  │ ← Hook: Before each optimization stage
└───────────────┘
    ↓
┌───────────────┐
│  Optimization │  (basic-cleaning, numeric, style, transform, etc.)
│    Stages     │
└───────────────┘
    ↓
┌───────────────┐
│  after-stage  │ ← Hook: After each optimization stage
└───────────────┘
    ↓
┌─────────────────┐
│ before-serialize│ ← Hook: Final cleanup (comment removal, attribute sorting)
└─────────────────┘
    ↓
┌───────────────┐
│  Serializer   │
└───────────────┘
    ↓
┌─────────────────┐
│ after-serialize │ ← Hook: Post-serialization validation
└─────────────────┘
    ↓
Output SVG
```

---

## Quick Start

### 1. Create Your First Plugin

```typescript
import type { EnhancedPlugin } from 'svger-cli/types/plugin-system';

const myFirstPlugin: EnhancedPlugin = {
  // Required: Unique identifier
  name: 'my-first-plugin',
  
  // Required: Semantic versioning
  version: '1.0.0',
  
  // Optional: Description
  description: 'Replaces all red colors with green',
  
  // Optional: Author information
  author: 'Your Name <your@email.com>',
  
  // Required: At least one hook
  hooks: {
    'after-parse': async (context) => {
      // Modify SVG content
      const modifiedContent = context.content
        .replace(/fill="red"/g, 'fill="green"')
        .replace(/stroke="red"/g, 'stroke="green"');
      
      return {
        content: modifiedContent,
        metadata: {
          colorsReplaced: (context.content.match(/red/g) || []).length,
        },
      };
    },
  },
  
  // Optional: Visual validation (highly recommended)
  validation: {
    enabled: true,
    maxDiffPercent: 100, // 100% = color changes expected
    options: {
      diff: { threshold: 0.1 },
    },
  },
};
```

### 2. Register Your Plugin

```typescript
import { getPluginManager } from 'svger-cli/core/enhanced-plugin-manager';

const pluginManager = getPluginManager();
pluginManager.registerPlugin(myFirstPlugin);
```

### 3. Use Plugin with Optimizer

```typescript
import { optimizeWithPlugins } from 'svger-cli/examples/plugin-integration-example';
import { OptLevel } from 'svger-cli/optimizers/types';

const result = await optimizeWithPlugins(svgContent, OptLevel.BALANCED);

console.log(`Optimized: ${result.reductionPercent.toFixed(2)}% smaller`);
console.log(`Plugins executed: ${result.pluginMetrics.totalExecutions} times`);
```

---

## Plugin API Reference

### EnhancedPlugin Interface

```typescript
interface EnhancedPlugin {
  /** Unique plugin identifier (required) */
  name: string;
  
  /** Semantic version (required) */
  version: string;
  
  /** Human-readable description (optional) */
  description?: string;
  
  /** Author information (optional) */
  author?: string;
  
  /** Pipeline hooks (at least one required) */
  hooks: {
    'before-parse'?: PluginHookFunction;
    'after-parse'?: PluginHookFunction;
    'before-stage'?: PluginHookFunction;
    'after-stage'?: PluginHookFunction;
    'before-serialize'?: PluginHookFunction;
    'after-serialize'?: PluginHookFunction;
  };
  
  /** Visual validation configuration (optional but recommended) */
  validation?: {
    enabled: boolean;
    maxDiffPercent?: number;  // Default: 5%
    options?: Partial<CompareOptions>;
  };
  
  /** Custom config schema (optional) */
  configSchema?: Record<string, any>;
  
  /** Initialization function (optional) */
  init?: () => Promise<void>;
  
  /** Cleanup function (optional) */
  cleanup?: () => Promise<void>;
  
  /** Custom validation function (optional) */
  validate?: () => boolean;
}
```

### PluginHookContext

```typescript
interface PluginHookContext {
  /** Current SVG content */
  content: string;
  
  /** Optimization configuration */
  config: OptConfig;
  
  /** Current stage name (for before/after-stage hooks) */
  stageName?: string;
  
  /** Original SVG content (for comparison) */
  originalContent?: string;
  
  /** Metadata passed between hooks */
  metadata: Map<string, any>;
  
  /** Skip remaining hooks for this stage */
  skipRemaining?: boolean;
}
```

### PluginHookResult

```typescript
interface PluginHookResult {
  /** Modified content (if changed) */
  content?: string;
  
  /** Skip remaining hooks */
  skipRemaining?: boolean;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
  
  /** Validation result (if validation was performed) */
  validation?: VisualDiffResult;
}
```

---

## Hook Types

### 1. `before-parse`

**When:** Before SVG parsing  
**Use Cases:**
- Remove watermarks or unwanted elements
- Pre-process malformed SVG
- Add missing namespaces

**Example:**
```typescript
hooks: {
  'before-parse': async (context) => {
    // Remove watermark element
    const cleaned = context.content.replace(
      /<g id="watermark">[\s\S]*?<\/g>/g,
      ''
    );
    
    return { content: cleaned };
  },
}
```

---

### 2. `after-parse`

**When:** After SVG parsing, before optimization  
**Use Cases:**
- Color palette replacement
- Attribute modification
- Element filtering

**Example:**
```typescript
hooks: {
  'after-parse': async (context) => {
    // Replace color palette
    const colors = { '#ff0000': '#00ff00', '#0000ff': '#ffff00' };
    let content = context.content;
    
    Object.entries(colors).forEach(([old, new]) => {
      content = content.replace(new RegExp(old, 'g'), new);
    });
    
    return { content };
  },
}
```

---

### 3. `before-stage`

**When:** Before each optimization stage  
**Use Cases:**
- Stage-specific preprocessing
- Conditional modifications based on stage name
- Performance monitoring

**Example:**
```typescript
hooks: {
  'before-stage': async (context) => {
    console.log(`Starting stage: ${context.stageName}`);
    
    // Only modify for specific stages
    if (context.stageName === 'path-optimization') {
      // Pre-process paths
    }
    
    return { content: context.content };
  },
}
```

---

### 4. `after-stage`

**When:** After each optimization stage  
**Use Cases:**
- Validation of stage output
- Correction of over-optimization
- Metric collection

**Example:**
```typescript
hooks: {
  'after-stage': async (context) => {
    // Validate output
    if (!context.content.includes('<svg')) {
      throw new Error('Invalid SVG after stage');
    }
    
    return { content: context.content };
  },
}
```

---

### 5. `before-serialize`

**When:** Before final serialization  
**Use Cases:**
- Comment removal
- Attribute sorting
- Final cleanup

**Example:**
```typescript
hooks: {
  'before-serialize': async (context) => {
    // Remove all comments
    const cleaned = context.content.replace(/<!--[\s\S]*?-->/g, '');
    
    return { content: cleaned };
  },
}
```

---

### 6. `after-serialize`

**When:** After final serialization  
**Use Cases:**
- Post-serialization validation
- Output formatting
- Final transformations

**Example:**
```typescript
hooks: {
  'after-serialize': async (context) => {
    // Add XML declaration if missing
    if (!context.content.startsWith('<?xml')) {
      return {
        content: '<?xml version="1.0" encoding="UTF-8"?>\n' + context.content,
      };
    }
    
    return { content: context.content };
  },
}
```

---

## Visual Validation

### Why Visual Validation?

Visual validation ensures your plugin doesn't accidentally break the visual output. It's highly recommended for all plugins.

### Configuration

```typescript
validation: {
  // Enable visual diff testing
  enabled: true,
  
  // Maximum allowed difference (0-100%)
  // 0% = pixel-perfect
  // 5% = minor differences acceptable
  // 100% = any change acceptable (for color replacement, etc.)
  maxDiffPercent: 5,
  
  // Comparison options
  options: {
    // Render configuration
    render: {
      width: 800,
      height: 600,
      density: 144, // 2x retina
      background: 'transparent',
    },
    
    // Diff configuration
    diff: {
      threshold: 0.1,         // Pixel color difference (0-1)
      includeAA: false,       // Include anti-aliasing
      maxDiffPercent: 5,      // Max acceptable diff
    },
  },
}
```

### Content-Aware Thresholds

```typescript
// Geometric shapes: 0.5% (pixel-perfect)
validation: {
  enabled: true,
  maxDiffPercent: 0.5,
}

// Circles (anti-aliasing): 2-3%
validation: {
  enabled: true,
  maxDiffPercent: 3,
}

// Complex paths (lossy): 5-15%
validation: {
  enabled: true,
  maxDiffPercent: 15,
}

// Color changes: 100%
validation: {
  enabled: true,
  maxDiffPercent: 100,
}
```

---

## Example Plugins

### Example 1: Color Replacer

```typescript
const colorReplacerPlugin: EnhancedPlugin = {
  name: 'color-replacer',
  version: '1.0.0',
  description: 'Replace colors in SVG files',
  hooks: {
    'after-parse': async (context) => {
      const config = context.metadata.get('colorReplacerConfig') || {
        colors: { black: 'blue', white: 'yellow' },
      };
      
      let content = context.content;
      Object.entries(config.colors).forEach(([oldColor, newColor]) => {
        const regex = new RegExp(`(fill|stroke)="${oldColor}"`, 'g');
        content = content.replace(regex, `$1="${newColor}"`);
      });
      
      return { content };
    },
  },
  validation: {
    enabled: true,
    maxDiffPercent: 100, // Color changes expected
  },
};
```

### Example 2: Watermark Remover

```typescript
const watermarkRemoverPlugin: EnhancedPlugin = {
  name: 'watermark-remover',
  version: '1.0.0',
  description: 'Remove watermarks and hidden elements',
  hooks: {
    'after-parse': async (context) => {
      let content = context.content;
      
      // Remove by ID
      const watermarkIds = ['watermark', 'logo', 'branding'];
      watermarkIds.forEach((id) => {
        const regex = new RegExp(`<[^>]+id="${id}"[^>]*>[\s\S]*?</[^>]+>`, 'g');
        content = content.replace(regex, '');
      });
      
      // Remove hidden elements
      content = content.replace(
        /<[^>]+(display="none"|visibility="hidden"|opacity="0")[^>]*>[\s\S]*?</[^>]+>/g,
        ''
      );
      
      return { content };
    },
  },
  validation: {
    enabled: true,
    maxDiffPercent: 5, // Minor visual changes acceptable
  },
};
```

### Example 3: Gradient Optimizer

```typescript
const gradientOptimizerPlugin: EnhancedPlugin = {
  name: 'gradient-optimizer',
  version: '1.0.0',
  description: 'Optimize gradients by removing redundant stops',
  hooks: {
    'after-parse': async (context) => {
      // Find gradients with redundant stops
      const gradientRegex = /<linearGradient[\s\S]*?<\/linearGradient>/g;
      let content = context.content;
      
      const gradients = content.match(gradientRegex) || [];
      gradients.forEach((gradient) => {
        // Remove duplicate stops
        const stops = gradient.match(/<stop[^>]*>/g) || [];
        const uniqueStops = [...new Set(stops)];
        
        if (stops.length > uniqueStops.length) {
          const optimized = gradient.replace(
            /<stop[^>]*>/g,
            () => uniqueStops.shift() || ''
          );
          content = content.replace(gradient, optimized);
        }
      });
      
      return { content };
    },
  },
  validation: {
    enabled: true,
    maxDiffPercent: 2, // Gradients should look identical
  },
};
```

---

## Best Practices

### 1. **Always Use Visual Validation**

```typescript
✅ GOOD
validation: {
  enabled: true,
  maxDiffPercent: 5,
}

❌ BAD
validation: {
  enabled: false, // No validation!
}
```

### 2. **Handle Errors Gracefully**

```typescript
✅ GOOD
hooks: {
  'after-parse': async (context) => {
    try {
      // Your transformation
      return { content: modifiedContent };
    } catch (error) {
      console.error('Plugin error:', error);
      return { content: context.content }; // Return original
    }
  },
}

❌ BAD
hooks: {
  'after-parse': async (context) => {
    // No error handling - will crash pipeline
    return { content: modifiedContent };
  },
}
```

### 3. **Use Metadata for Configuration**

```typescript
✅ GOOD
hooks: {
  'after-parse': async (context) => {
    const config = context.metadata.get('myPluginConfig') || defaultConfig;
    // Use config
  },
}

❌ BAD
// Global variables - not thread-safe
let globalConfig = {};
```

### 4. **Clean Up Resources**

```typescript
✅ GOOD
{
  init: async () => {
    // Initialize resources
  },
  cleanup: async () => {
    // Clean up resources
  },
}

❌ BAD
// No cleanup - memory leaks!
```

### 5. **Use Specific Hook Types**

```typescript
✅ GOOD
hooks: {
  'after-parse': async (context) => {
    // Parse-time modifications
  },
  'before-serialize': async (context) => {
    // Serialization-time modifications
  },
}

❌ BAD
hooks: {
  'after-parse': async (context) => {
    // Doing everything in one hook
  },
}
```

---

## Testing Your Plugin

### Unit Testing

```typescript
import { describe, it, expect } from '@jest/globals';
import { getPluginManager, resetPluginManager } from 'svger-cli';

describe('My Plugin', () => {
  beforeEach(() => {
    resetPluginManager();
  });
  
  it('should register successfully', () => {
    const manager = getPluginManager();
    manager.registerPlugin(myPlugin);
    
    expect(manager.hasPlugin('my-plugin')).toBe(true);
  });
  
  it('should modify SVG content', async () => {
    const manager = getPluginManager();
    manager.registerPlugin(myPlugin);
    
    const context = {
      content: '<svg><rect fill="red"/></svg>',
      config: {},
      metadata: new Map(),
    };
    
    const result = await manager.executeHook('after-parse', context);
    expect(result.content).toContain('fill="green"');
  });
});
```

### Integration Testing

```typescript
import { optimizeWithPlugins } from 'svger-cli/examples/plugin-integration-example';

describe('Plugin Integration', () => {
  it('should work with optimizer pipeline', async () => {
    const svg = '<svg><rect fill="red"/></svg>';
    const result = await optimizeWithPlugins(svg);
    
    expect(result.optimizedSvg).toBeDefined();
    expect(result.reductionPercent).toBeGreaterThan(0);
  });
});
```

---

## Publishing Your Plugin

### 1. Package Structure

```
my-svger-plugin/
├── package.json
├── README.md
├── src/
│   └── index.ts
├── dist/
│   └── index.js
└── tests/
    └── index.test.ts
```

### 2. package.json

```json
{
  "name": "svger-plugin-my-plugin",
  "version": "1.0.0",
  "description": "My awesome svger-cli plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["svger-cli", "svg", "plugin"],
  "peerDependencies": {
    "svger-cli": "^3.2.0"
  }
}
```

### 3. Publish to npm

```bash
npm run build
npm test
npm publish
```

### 4. Documentation

Include in README.md:
- Installation instructions
- Configuration options
- Usage examples
- Visual validation thresholds
- Performance characteristics

---

## Resources

- **Plugin System Types:** `src/types/plugin-system.ts`
- **Enhanced Plugin Manager:** `src/core/enhanced-plugin-manager.ts`
- **Example Plugins:**
  - `src/plugins/color-replacer.ts`
  - `src/plugins/watermark-remover.ts`
- **Integration Example:** `examples/plugin-integration-example.ts`
- **Visual Diff API:** `src/utils/visual-diff.ts`

---

## Support

- **GitHub Issues:** https://github.com/faezemohades/svger-cli/issues
- **Documentation:** https://github.com/faezemohades/svger-cli#readme
- **Examples:** `examples/` directory

---

**Happy Plugin Development!** 🚀✨
