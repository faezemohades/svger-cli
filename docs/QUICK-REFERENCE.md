# Quick Reference: Optimization Pipeline

## 🎯 Achievement: 57.77% Reduction at MAXIMUM Level

---

## Usage Examples

### Basic Usage (Recommended)
```typescript
import { SVGProcessor, OptLevel } from 'svger-cli';

const processor = SVGProcessor.getInstance();
processor.setOptimizationLevel(OptLevel.BALANCED);

const optimized = await processor.cleanSVGContent(svgString);
// Result: 43.33% reduction (safe + fast)
```

### Maximum Compression
```typescript
processor.setOptimizationLevel(OptLevel.MAXIMUM);
const optimized = await processor.cleanSVGContent(svgString);
// Result: 57.77% reduction (everything enabled)
```

### Custom Configuration
```typescript
import { svgProcessor } from 'svger-cli';

const result = await svgProcessor.cleanSVGContent(svgString, {
  optimizationLevel: OptLevel.AGGRESSIVE,
  precision: 1,
  enablePathOptimization: true,
  enableTransformCollapsing: true,
  curveTolerance: 0.5,
});
```

---

## Optimization Levels

| Level | Reduction | Speed | Safety | Use Case |
|-------|-----------|-------|--------|----------|
| **BALANCED** | 43.33% | Fast | High | Development (recommended) |
| **AGGRESSIVE** | 48.91% | Medium | Medium | CI/CD builds |
| **MAXIMUM** | 57.77% | Slower | Lower | Production bundles |

---

## Optimizer Breakdown

### Phase 3: Attributes (BALANCED+)
- ✅ Numeric: Decimal precision, coordinates
- ✅ Style: Colors, units, defaults
- ✅ Transform: Matrix simplification (AGGRESSIVE+)

### Phase 4: Paths (AGGRESSIVE+)
- ✅ Parser: Tokenization, abs/rel conversion
- ✅ Shortener: Command merging, H/V
- ✅ **Commands: C→S, C→Q, Q→T, C/Q→L** 🆕
- ⏳ Simplifier: Douglas-Peucker (Phase 4.4)
- ⏳ Merger: Repeated shapes (Phase 4.5)

### Phase 5: Transforms (MAXIMUM only)
- ✅ **Collapsing: Propagate, bake, unwrap** 🆕

---

## Test Results

### Command Optimizer (Phase 4.3)
```
C→S: 25.68% | C→Q: 29.23% | Q→T: 32.76%
C→L: 27.54% | Q→L: 31.67% | Overall: 23.44%
```

### Transform Collapsing (Phase 5.1)
```
Nested Groups: 50.75% | Illustrator: 49.76%
Average: 42.42% across 8 tests
```

### Complete Pipeline
```
824 bytes → 348 bytes (57.77% reduction)
```

---

## Config Options

```typescript
interface OptConfig {
  // Level
  optimizationLevel: 'BALANCED' | 'AGGRESSIVE' | 'MAXIMUM';
  
  // Precision (0=aggressive, 3=conservative)
  precision: number;
  
  // Phase 3 (BALANCED+)
  enableNumericOptimization: boolean;
  enableStyleOptimization: boolean;
  enableTransformOptimization: boolean; // AGGRESSIVE+
  
  // Phase 4 (AGGRESSIVE+)
  enablePathOptimization: boolean;
  curveTolerance: number; // 0.5 recommended
  
  // Phase 5 (MAXIMUM only)
  enableTransformCollapsing: boolean;
}
```

---

## File Structure

```
src/optimizers/
├── types.ts                    # OptLevel enum, OptConfig
├── optimizer-pipeline.ts       # Pipeline architecture
├── advanced-stages.ts          # Phase 3-5 wrappers
│
├── numeric-optimizer.ts        # Phase 3.1
├── style-optimizer.ts          # Phase 3.2
├── transform-optimizer.ts      # Phase 3.3
│
├── path-parser.ts              # Phase 4.1 (480 lines)
├── path-shortener.ts           # Phase 4.2 (320 lines)
├── command-optimizer.ts        # Phase 4.3 (434 lines) 🆕
│
└── transform-collapsing.ts     # Phase 5.1 (540 lines) 🆕
```

---

## Performance

### Time Complexity: O(n)
- Small (<10KB): <10ms
- Medium (10-100KB): 10-50ms
- Large (100KB-1MB): 50-200ms

### Real-World Impact
- Material Icons: 15-25%
- Illustrator exports: **40-50%** 🎯
- Hand-drawn: 20-30%
- Icon libraries: 30-40%

---

## Next Steps

### Phase 4.4: Path Simplification
- Douglas-Peucker algorithm
- Visvalingam-Whyatt algorithm
- Expected: +5-10% on complex paths

### Phase 4.5: Path Merging
- Repeated shape detection
- `<defs>` + `<use>` extraction
- Expected: +30-60% on icon sets

---

## Status: ✅ Production Ready

All tests passing: **32/32 (100%)**
- Framework: 11/11
- Config: 6/6
- E2E: 8/8
- Integration: 7/7

**Latest Achievement**: Phase 4.3 complete (23.44% reduction) 🎉
