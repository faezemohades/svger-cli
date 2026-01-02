# Phase 6.3: Visual Diff Testing Design

**Priority:** CRITICAL - Required before any lossy/experimental features  
**Timeline:** ~1 week  
**Impact:** Enables safe aggressive optimization with zero visual regression

---

## Overview

Visual diff testing ensures that SVG optimizations produce **pixel-perfect identical output** to the original, or differences are within an acceptable threshold. This is critical for:

1. **Shape conversion** (rect → path) - must look identical
2. **Path simplification** - lossy but should be imperceptible
3. **Future lossy modes** - controlled quality degradation
4. **CI/CD validation** - automated regression detection

---

## Library Comparison

### Option 1: **sharp** (Recommended)
**Pros:**
- ✅ Fast native C++ bindings (libvips)
- ✅ Excellent SVG support via librsvg
- ✅ Wide adoption (11M+ weekly downloads)
- ✅ Comprehensive API
- ✅ Works with pixelmatch for comparison

**Cons:**
- ⚠️ ~9MB native dependency
- ⚠️ Requires system libraries on Linux

**Installation:**
```bash
npm install sharp pixelmatch pngjs
```

### Option 2: **resvg-js**
**Pros:**
- ✅ Pure Rust (fast, safe)
- ✅ Accurate SVG rendering
- ✅ Smaller footprint than sharp

**Cons:**
- ⚠️ Less mature ecosystem
- ⚠️ Fewer downloads (150K/week vs 11M/week)
- ⚠️ Still requires pixelmatch for comparison

**Installation:**
```bash
npm install @resvg/resvg-js pixelmatch pngjs
```

### Option 3: **Playwright** (Browser-based)
**Pros:**
- ✅ Real browser rendering
- ✅ Built-in screenshot comparison

**Cons:**
- ❌ Heavy (downloads browser)
- ❌ Slow (browser startup overhead)
- ❌ Overkill for SVG comparison

**Decision: Use `sharp` + `pixelmatch`**
- Industry standard
- Fast and reliable
- Well-documented
- Works offline

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────┐
│  visual-diff.ts                                     │
│                                                      │
│  ┌──────────────┐    ┌──────────────┐              │
│  │ renderSVG()  │───▶│  sharp       │              │
│  │ (SVG→PNG)    │    │  (librsvg)   │              │
│  └──────────────┘    └──────────────┘              │
│         │                     │                      │
│         ▼                     ▼                      │
│  ┌────────────────────────────────┐                │
│  │  Buffer (PNG data)             │                │
│  └────────────────────────────────┘                │
│         │                     │                      │
│         ▼                     ▼                      │
│  ┌──────────────┐    ┌──────────────┐              │
│  │ Before PNG   │    │ After PNG    │              │
│  └──────────────┘    └──────────────┘              │
│         │                     │                      │
│         └──────────┬──────────┘                     │
│                    ▼                                 │
│         ┌──────────────────────┐                    │
│         │  pixelmatch()        │                    │
│         │  (pixel comparison)  │                    │
│         └──────────────────────┘                    │
│                    │                                 │
│                    ▼                                 │
│         ┌──────────────────────┐                    │
│         │  DiffResult          │                    │
│         │  - mismatchCount     │                    │
│         │  - mismatchPercent   │                    │
│         │  - passed            │                    │
│         │  - diffImage (opt)   │                    │
│         └──────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Design

### 1. Rendering Configuration

```typescript
interface RenderConfig {
  width: number;        // Default: 800px
  height: number;       // Default: 600px
  density: number;      // DPI, default: 144 (2x for retina)
  background: string;   // Default: 'transparent'
}
```

**Why these defaults?**
- 800×600: Standard test size, covers most icons/illustrations
- 144 DPI: 2x retina ensures fine details are captured
- Transparent: Preserves alpha channel for proper comparison

### 2. Comparison Threshold

```typescript
interface DiffConfig {
  threshold: number;           // 0-1, pixel color difference threshold
  includeAA: boolean;         // Include anti-aliasing in diff
  alpha: number;              // Alpha blend value (0-1)
  diffColor: [number, number, number]; // RGB for diff highlight
  maxDiffPercent: number;     // Max % difference allowed (0-100)
}

const DEFAULT_DIFF_CONFIG: DiffConfig = {
  threshold: 0.1,           // 10% color difference allowed per pixel
  includeAA: false,         // Ignore anti-aliasing differences
  alpha: 0.1,              // 10% alpha blend for diff mask
  diffColor: [255, 0, 255], // Magenta highlights
  maxDiffPercent: 0.1,      // 0.1% of pixels can differ
};
```

**Threshold Levels:**
- `0.0` = Pixel-perfect (no tolerance)
- `0.1` = Recommended (ignores tiny rendering differences)
- `0.5` = Permissive (allows minor visual changes)
- `1.0` = Very permissive (allows significant changes)

### 3. Main API

```typescript
/**
 * Compare two SVG strings for visual differences
 */
async function compareVisually(
  beforeSVG: string,
  afterSVG: string,
  options?: {
    render?: Partial<RenderConfig>;
    diff?: Partial<DiffConfig>;
    saveDiffImage?: string; // Path to save diff PNG
  }
): Promise<VisualDiffResult> {
  // 1. Render both SVGs to PNG
  const beforePNG = await renderSVG(beforeSVG, options?.render);
  const afterPNG = await renderSVG(afterSVG, options?.render);
  
  // 2. Compare pixels
  const diffResult = await comparePixels(
    beforePNG,
    afterPNG,
    options?.diff
  );
  
  // 3. Save diff image if requested
  if (options?.saveDiffImage && diffResult.diffImage) {
    await saveDiffImage(diffResult.diffImage, options.saveDiffImage);
  }
  
  return diffResult;
}
```

### 4. Result Interface

```typescript
interface VisualDiffResult {
  passed: boolean;              // True if within threshold
  mismatchCount: number;        // Number of different pixels
  mismatchPercent: number;      // Percentage (0-100)
  totalPixels: number;          // Total pixel count
  diffImage?: Buffer;           // PNG with highlighted differences
  message: string;              // Human-readable summary
}
```

---

## Test Integration

### Unit Tests

```typescript
describe('visual-diff', () => {
  describe('identical SVGs', () => {
    it('should return 0% difference', async () => {
      const svg = '<svg><rect x="0" y="0" width="100" height="100"/></svg>';
      const result = await compareVisually(svg, svg);
      
      expect(result.passed).toBe(true);
      expect(result.mismatchPercent).toBe(0);
    });
  });
  
  describe('rect → path conversion', () => {
    it('should be visually identical', async () => {
      const rect = '<svg><rect x="10" y="10" width="80" height="60" fill="red"/></svg>';
      const path = '<svg><path d="M10 10h80v60h-80z" fill="red"/></svg>';
      
      const result = await compareVisually(rect, path);
      
      expect(result.passed).toBe(true);
      expect(result.mismatchPercent).toBeLessThan(0.01); // < 0.01%
    });
  });
  
  describe('path simplification', () => {
    it('should be imperceptible', async () => {
      const original = '<svg><path d="M0 0L10 0L10 10L0 10z"/></svg>';
      const simplified = '<svg><path d="M0 0H10V10H0z"/></svg>';
      
      const result = await compareVisually(original, simplified);
      
      expect(result.passed).toBe(true);
      expect(result.mismatchPercent).toBe(0); // Identical
    });
  });
  
  describe('threshold enforcement', () => {
    it('should fail when difference exceeds threshold', async () => {
      const red = '<svg><rect width="100" height="100" fill="red"/></svg>';
      const blue = '<svg><rect width="100" height="100" fill="blue"/></svg>';
      
      const result = await compareVisually(red, blue);
      
      expect(result.passed).toBe(false);
      expect(result.mismatchPercent).toBeGreaterThan(90); // Completely different
    });
  });
});
```

### Snapshot Tests

```typescript
describe('optimization snapshot tests', () => {
  const testCases = [
    { name: 'icon-home', file: 'test-svgs/icon-home.svg' },
    { name: 'logo-complex', file: 'test-svgs/logo-complex.svg' },
    { name: 'illustration', file: 'test-svgs/illustration.svg' },
  ];
  
  for (const level of [OptLevel.BALANCED, OptLevel.AGGRESSIVE, OptLevel.MAXIMUM]) {
    describe(`${level} optimization`, () => {
      for (const test of testCases) {
        it(`should preserve visual appearance: ${test.name}`, async () => {
          const original = await fs.readFile(test.file, 'utf8');
          const optimized = await optimize(original, { level });
          
          const result = await compareVisually(original, optimized, {
            diff: { maxDiffPercent: 0.1 } // Allow 0.1% difference
          });
          
          expect(result.passed).toBe(true);
          expect(result.message).toContain('passed');
        });
      }
    });
  }
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Visual Regression Tests

on: [push, pull_request]

jobs:
  visual-diff:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install system dependencies (sharp)
        run: |
          sudo apt-get update
          sudo apt-get install -y librsvg2-dev
      
      - name: Run visual diff tests
        run: npm run test:visual
      
      - name: Upload diff images (on failure)
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: visual-diff-failures
          path: test-output/visual-diffs/
```

### NPM Scripts

```json
{
  "scripts": {
    "test:visual": "jest --testMatch='**/*.visual.test.ts'",
    "test:visual:update": "jest --testMatch='**/*.visual.test.ts' --updateSnapshot"
  }
}
```

---

## Fallback Strategy

When visual diff fails unexpectedly:

```typescript
async function optimizeWithVisualValidation(
  svg: string,
  config: OptConfig
): Promise<string> {
  const original = svg;
  
  try {
    // Attempt aggressive optimization
    const optimized = await optimize(svg, config);
    
    // Validate visual appearance
    const diffResult = await compareVisually(original, optimized, {
      diff: { maxDiffPercent: config.visualDiffThreshold ?? 0.1 }
    });
    
    if (diffResult.passed) {
      return optimized; // Safe to use
    } else {
      console.warn(
        `Visual diff failed (${diffResult.mismatchPercent.toFixed(2)}% difference). ` +
        `Falling back to less aggressive optimization.`
      );
      
      // Fallback: Use less aggressive level
      const safeFallback = await optimize(svg, {
        ...config,
        level: OptLevel.BALANCED // Safer level
      });
      
      return safeFallback;
    }
  } catch (error) {
    console.error('Visual validation failed:', error);
    return original; // Ultimate fallback: return original
  }
}
```

---

## Configuration

Add to `OptConfig`:

```typescript
interface OptConfig {
  // ... existing options
  
  /**
   * Enable visual diff validation
   * @default false (manual testing), true (CI/CD)
   */
  enableVisualValidation?: boolean;
  
  /**
   * Maximum allowed visual difference (0-100%)
   * @default 0.1 (0.1% of pixels)
   */
  visualDiffThreshold?: number;
  
  /**
   * Save diff images on failure
   * @default false
   */
  saveDiffImages?: boolean;
  
  /**
   * Directory to save diff images
   * @default './test-output/visual-diffs'
   */
  diffImageDir?: string;
}
```

---

## Performance Considerations

### Optimization Strategies

1. **Caching:** Cache rendered PNGs for identical SVGs
2. **Parallel Processing:** Use worker threads for batch comparisons
3. **Selective Rendering:** Only render SVGs that changed
4. **Size Optimization:** Use 1x density for quick checks, 2x for final validation

### Expected Performance

| Operation | Time | Memory |
|-----------|------|--------|
| Render SVG (800×600) | ~50ms | ~5MB |
| Pixel comparison | ~10ms | ~10MB |
| Full diff (render + compare) | ~60ms | ~15MB |
| Batch (100 SVGs) | ~6s | ~150MB |

**Optimization:** Run visual diffs only on critical tests or in CI, not during development.

---

## Error Handling

```typescript
class VisualDiffError extends Error {
  constructor(
    message: string,
    public readonly code: 'RENDER_FAILED' | 'COMPARISON_FAILED' | 'THRESHOLD_EXCEEDED'
  ) {
    super(message);
    this.name = 'VisualDiffError';
  }
}

async function safeCompareVisually(
  before: string,
  after: string
): Promise<VisualDiffResult | null> {
  try {
    return await compareVisually(before, after);
  } catch (error) {
    if (error instanceof VisualDiffError) {
      console.warn(`Visual diff error: ${error.message} (${error.code})`);
      return null;
    }
    throw error;
  }
}
```

---

## Example Usage

### Manual Testing

```typescript
import { compareVisually } from './visual-diff.js';

const original = await fs.readFile('input.svg', 'utf8');
const optimized = await optimize(original, { level: OptLevel.MAXIMUM });

const result = await compareVisually(original, optimized, {
  saveDiffImage: './diff.png'
});

console.log(`Visual difference: ${result.mismatchPercent.toFixed(2)}%`);
console.log(`Status: ${result.passed ? 'PASSED ✓' : 'FAILED ✗'}`);
```

### Automated Testing

```typescript
test('shape conversion preserves appearance', async () => {
  const rect = '<svg><rect x="0" y="0" width="100" height="100" fill="red"/></svg>';
  const optimized = await optimize(rect, {
    level: OptLevel.AGGRESSIVE,
    shapeConversion: true
  });
  
  const result = await compareVisually(rect, optimized);
  
  expect(result.passed).toBe(true);
  expect(result.mismatchPercent).toBeLessThan(0.1);
});
```

---

## Success Criteria

✅ **Phase 6.3 Complete When:**
1. `visual-diff.ts` implemented with sharp + pixelmatch
2. Configurable threshold system (0-1 scale)
3. Diff image generation (PNG with highlighted differences)
4. Integration tests for all optimization stages
5. CI/CD workflow for automated validation
6. Fallback mechanism for unexpected failures
7. Performance < 100ms per comparison
8. Documentation and examples complete

---

## Next Steps After Phase 6.3

1. ✅ **Confidence Gained:** Can safely add lossy optimizations
2. ✅ **Plugin System (Phase 6.2):** Now safe to allow community plugins
3. ✅ **Lossy Modes:** Curve fitting, shape merging (behind `--experimental` flag)
4. ✅ **Advanced Shape Conversion:** Confidence to convert circles/ellipses in specific cases

---

**Ready to implement Phase 6.3!** 🚀

This design provides:
- ✅ Pixel-perfect validation
- ✅ Configurable thresholds
- ✅ CI/CD integration
- ✅ Performance optimization
- ✅ Fallback safety
- ✅ Developer-friendly API

Estimated timeline: **3-5 days** for implementation + testing.
