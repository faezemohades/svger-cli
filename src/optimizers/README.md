# SVG Optimizer Module

Advanced SVG optimization system with pluggable pipeline architecture for svger-cli v4.0.3.

## Features

- 🚀 **5 Compatibility Levels**: Numeric precision is configurable by level
- 🔌 **Pluggable Pipeline**: Register custom optimization stages
- 📊 **Detailed Metrics**: Track size reduction and applied stages
- 🛡️ **Error Resilient**: Continues on stage failure, never crashes
- ⚡ **Zero Dependencies**: Pure Node.js, blazing fast
- 🔄 **Backward Compatible**: Existing level/configuration names remain accepted

> Phase 00.5 safety note: `SVGProcessor` currently enables only source-preserving formatting
> whitespace, literal presentation-color shortening, and bounded attribute-only numeric precision.
> Historical compression figures and pass descriptions below do not represent the active production
> pipeline. See
> [`phase0-svg-semantic-preservation.md`](../../docs/phase0-svg-semantic-preservation.md) for the
> verified boundaries and disabled transformations.

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

| Level        | Description                   | Reduction      | Use Case                          |
| ------------ | ----------------------------- | -------------- | --------------------------------- |
| `none`       | No numeric/color optimization | Not guaranteed | Debugging, inspection             |
| `basic`      | 3-place precision             | Not guaranteed | Conservative default              |
| `balanced`   | 3-place precision             | Not guaranteed | Compatibility setting             |
| `aggressive` | 2-place precision             | Not guaranteed | Explicitly lossy numeric rounding |
| `maximum`    | 1-place precision             | Not guaranteed | Explicitly lossy numeric rounding |

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
  registerStage(name: string, fn: OptimizationStage): this;
  async optimize(svg: string): Promise<OptimizationResult>;
  updateConfig(config: Partial<OptConfig>): void;
  clearStages(): void;
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

The compatibility stage keeps its existing function surface, but only verified operations are
active:

1. **removeXMLDeclaration** - Remove a leading `<?xml ... ?>` declaration.
2. **removeComments** - Remove XML comments without scanning inside CDATA.
3. **normalizeWhitespace** - Collapse only whitespace-only formatting nodes outside text, CDATA,
   style, and inherited `xml:space="preserve"` contexts.
4. **shortenColors** - Shorten supported literal presentation-attribute colors.
5. **roundFloats** - Round eligible numeric attribute values only.
6. Metadata deletion, namespace/style rewriting, empty/hidden element removal, and attribute sorting
   are retained as API no-ops until safe eligibility checks are implemented.

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
type OptimizationStage = (svgString: string, config: OptConfig) => Promise<string> | string;
```

## Performance Benchmarks

No compression ratio is promised while semantic safety takes precedence over size reduction.
Geometry and numeric rounding is explicitly controlled by the selected precision level.

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
  optimize: 'balanced',
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

We welcome contributions! Phase 1 establishes the foundation. See `docs/PHASE-1-IMPLEMENTATION.md`
for details.

## License

MIT - Same as svger-cli parent project
