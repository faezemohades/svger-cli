# SVG Optimizer Module

Advanced SVG optimization system with pluggable pipeline architecture for svger-cli v4.0.3.

## Features

- 🚀 **5 Optimization Levels**: From minimal to maximum compression
- 🔌 **Pluggable Pipeline**: Register custom optimization stages
- 📊 **Detailed Metrics**: Track size reduction and applied stages
- 🛡️ **Error Resilient**: Continues on stage failure, never crashes
- ⚡ **Zero Dependencies**: Pure Node.js, blazing fast
- 🔄 **Backward Compatible**: BASIC = v3.x behavior

## Quick Start

### CLI Usage

```bash
# Build with optimization
svger-cli build ./svgs ./components --optimize balanced

# Generate single file with maximum optimization
svger-cli generate icon.svg ./out --optimize maximum
```

### Programmatic Usage

```typescript
import { createOptimizerPipeline, OptLevel, basicCleaningStage } from 'svger-cli';

const pipeline = createOptimizerPipeline(OptLevel.BALANCED);
pipeline.registerStage('basic-cleaning', basicCleaningStage);

const result = await pipeline.optimize(svgString);
console.log(`Size reduced by ${result.reductionPercent.toFixed(2)}%`);
```

## Optimization Levels

| Level | Description | Reduction | Use Case |
|-------|-------------|-----------|----------|
| `none` | Minimal processing | ~1% | Debugging, inspection |
| `basic` | Current v3.x behavior | ~74% | Default, safe optimizations |
| `balanced` | Moderate optimizations | ~74% | Production builds |
| `aggressive` | Aggressive optimizations | ~75% | Small bundle sizes |
| `maximum` | Maximum compression | ~75% | Maximum optimization |

## Architecture

### Pipeline Flow

```
SVG Input
    ↓
[Stage 1: Basic Cleaning]
    ↓
[Stage 2: Custom Stage] (optional)
    ↓
[Stage N: Custom Stage] (optional)
    ↓
Optimized SVG Output + Metrics
```

### Core Classes

#### OptimizerPipeline

Orchestrates optimization stages sequentially.

```typescript
class OptimizerPipeline {
  registerStage(name: string, fn: OptimizationStage): this
  async optimize(svg: string): Promise<OptimizationResult>
  updateConfig(config: Partial<OptConfig>): void
  clearStages(): void
}
```

#### OptConfig

Granular control over 18+ optimization options.

```typescript
interface OptConfig {
  level: OptLevel;
  floatPrecision: 1 | 2 | 3 | 4;
  pathTolerance: number;
  removeViewBox: boolean;
  removeMetadata: boolean;
  removeComments: boolean;
  normalizeWhitespace: boolean;
  removeUnnecessaryAttrs: boolean;
  shortenColors: boolean;
  mergePaths: boolean;
  removeHiddenElements: boolean;
  inlineStyles: boolean;
  removeEmptyContainers: boolean;
  collapseGroups: boolean;
  reactCompatibility: boolean;
  sortAttrs: boolean;
  removeDoctype: boolean;
  removeXMLProcInst: boolean;
  plugins?: OptimizationPlugin[];
}
```

## Cleaning Stages

### Basic Cleaning Stage

13 modular functions combined into one comprehensive stage:

1. **removeXMLDeclaration** - Strip `<?xml ... ?>`
2. **removeDoctype** - Strip `<!DOCTYPE ...>`
3. **removeComments** - Strip `<!-- ... -->`
4. **removeMetadata** - Strip `<metadata>`, `<title>`, `<desc>`
5. **normalizeWhitespace** - Collapse whitespace
6. **removeXMLNamespaces** - Strip `xmlns` attributes
7. **removeInlineStyles** - Strip `style="..."` (optional)
8. **convertToCamelCase** - Convert attributes for React
9. **shortenColors** - `#ffffff` → `#fff`
10. **roundFloats** - Round decimals (1-4 precision)
11. **removeEmptyContainers** - Strip empty `<g>`, `<defs>`
12. **removeHiddenElements** - Strip `opacity:0` elements
13. **sortAttributes** - Alphabetical sorting (optional)

### Custom Stages

Create your own optimization stages:

```typescript
import { OptimizerPipeline, type OptimizationStage } from 'svger-cli';

const myCustomStage: OptimizationStage = (svg, config) => {
  // Your optimization logic
  return svg.replace(/custom-pattern/g, 'optimized');
};

const pipeline = new OptimizerPipeline();
pipeline.registerStage('my-custom-stage', myCustomStage);
```

## Configuration Examples

### Default Config (BASIC)

```typescript
{
  level: OptLevel.BASIC,
  floatPrecision: 3,
  pathTolerance: 0.5,
  removeViewBox: false,
  removeMetadata: true,
  removeComments: true,
  normalizeWhitespace: true,
  removeUnnecessaryAttrs: true,
  shortenColors: true,
  mergePaths: false,
  removeHiddenElements: false,
  inlineStyles: false,
  removeEmptyContainers: true,
  collapseGroups: false,
  reactCompatibility: true,
  sortAttrs: false,
  removeDoctype: true,
  removeXMLProcInst: true,
}
```

### Custom Config

```typescript
const pipeline = new OptimizerPipeline({
  level: OptLevel.BALANCED,
  floatPrecision: 2,
  removeHiddenElements: true,
  shortenColors: true,
  sortAttrs: true,
});
```

## API Reference

### Functions

#### `createOptimizerPipeline(level?: OptLevel)`

Factory function to create pre-configured pipeline.

```typescript
const pipeline = createOptimizerPipeline(OptLevel.BALANCED);
```

#### `getDefaultOptConfig(level: OptLevel): OptConfig`

Get default configuration for optimization level.

```typescript
const config = getDefaultOptConfig(OptLevel.AGGRESSIVE);
```

### Types

#### `OptimizationResult`

```typescript
interface OptimizationResult {
  optimizedSvg: string;
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
  stagesApplied: string[];
}
```

#### `OptimizationStage`

```typescript
type OptimizationStage = (
  svgString: string,
  config: OptConfig
) => Promise<string> | string;
```

## Performance Benchmarks

**Test SVG: 518 bytes**

| Level | Size After | Reduction | Time |
|-------|-----------|-----------|------|
| NONE | 514 bytes | 0.77% | <1ms |
| BASIC | 133 bytes | 74.32% | <1ms |
| BALANCED | 133 bytes | 74.32% | <1ms |
| AGGRESSIVE | 132 bytes | 74.52% | <1ms |
| MAXIMUM | 132 bytes | 74.52% | <1ms |

## Testing

Run optimizer tests:

```bash
node optimizer-pipeline.test.js
```

Expected output:
```
✅ All optimizer tests passed successfully!
📊 5/5 tests passed
```

## Integration

The optimizer is automatically integrated into:

- ✅ CLI commands (`build`, `generate`)
- ✅ SVG Processor (`cleanSVGContent`)
- ✅ SVG Service (`buildAll`, `generateSingle`)
- ✅ All framework generators

## Backward Compatibility

**Zero breaking changes!** The optimizer defaults to `BASIC` level, which maintains v3.x behavior.

```typescript
// v3.1.1 code works unchanged
await svgService.buildAll({ src: './svgs', out: './components' });

// v4.0.3 with optimization
await svgService.buildAll({ 
  src: './svgs', 
  out: './components',
  optimize: 'balanced' 
});
```

## Future Phases

Phase 1 (✅ Complete):
- ✅ Pluggable pipeline architecture
- ✅ 5 optimization levels
- ✅ 13 cleaning functions
- ✅ CLI integration

Phase 2 (Planned):
- Path simplification algorithms
- Merge duplicate paths
- Collapse useless groups
- Transform optimization

Phase 3+ (Planned):
- Virtual DOM tree parsing
- AST-based transformations
- SVGO benchmark comparison

## Contributing

We welcome contributions! Phase 1 establishes the foundation. See `docs/PHASE-1-IMPLEMENTATION.md` for details.

## License

MIT - Same as svger-cli parent project
