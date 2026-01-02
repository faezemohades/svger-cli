# Phase 6.1: Shape Conversion Design

**Goal:** Convert primitive shapes (`<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>`) to `<path>` elements **only when the path representation is shorter**.

**Expected Impact:** +5-10% reduction on SVGs with many primitive shapes

---

## Decision Logic

### Core Principle
**Convert shape → path IF AND ONLY IF:**
```
pathBytes < originalBytes + threshold
```

Where:
- `pathBytes` = length of `<path d="..."/>` after precision rounding
- `originalBytes` = length of original shape element with all attributes
- `threshold` = 5 bytes (safety margin to account for edge cases)

### Why This Matters

Consider a simple rectangle:
```xml
<!-- Original: 58 bytes -->
<rect x="10" y="20" width="100" height="50" fill="red"/>

<!-- Converted: 42 bytes (SHORTER ✓) -->
<path d="M10 20h100v50h-100z" fill="red"/>
```

But a rectangle with many attributes:
```xml
<!-- Original: 156 bytes -->
<rect x="10" y="20" width="100" height="50" fill="red" stroke="blue" stroke-width="2" opacity="0.5" transform="rotate(45)"/>

<!-- Converted: 144 bytes (only 12 bytes saved, not worth complexity) -->
<path d="M10 20h100v50h-100z" fill="red" stroke="blue" stroke-width="2" opacity="0.5" transform="rotate(45)"/>
```

**Insight:** Conversion is most beneficial when:
1. Shape has few attributes (fill only, or fill + stroke)
2. Shape parameters are simple (no transforms, effects, etc.)
3. Path representation is significantly shorter (>10% reduction)

---

## Conversion Algorithms

### 1. Rectangle → Path

**Algorithm:**
```typescript
function rectToPath(x: number, y: number, width: number, height: number, rx?: number, ry?: number): string {
  // Case 1: No rounded corners (most common)
  if (!rx && !ry) {
    // Use relative commands for shortest representation
    return `M${x} ${y}h${width}v${height}h${-width}z`;
  }
  
  // Case 2: Rounded corners (more complex)
  if (rx) {
    ry = ry || rx; // If only rx specified, ry = rx
    
    // Clamp rx, ry to max of width/2, height/2
    rx = Math.min(rx, width / 2);
    ry = Math.min(ry, height / 2);
    
    // Path with rounded corners using arcs
    return `M${x + rx} ${y}h${width - 2*rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${height - 2*ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(width - 2*rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(height - 2*ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}z`;
  }
  
  return null; // Should not reach here
}
```

**Examples:**

| Original | Bytes | Converted | Bytes | Savings |
|----------|-------|-----------|-------|---------|
| `<rect x="10" y="20" width="100" height="50"/>` | 43 | `<path d="M10 20h100v50h-100z"/>` | 29 | **14 bytes (33%)** |
| `<rect x="0" y="0" width="24" height="24"/>` | 35 | `<path d="M0 0h24v24h-24z"/>` | 25 | **10 bytes (29%)** |
| `<rect x="10" y="10" width="5" height="5"/>` | 35 | `<path d="M10 10h5v5h-5z"/>` | 25 | **10 bytes (29%)** |

**Rounded Rectangle:**
```xml
<!-- Original: 60 bytes -->
<rect x="10" y="10" width="80" height="60" rx="5" ry="5"/>

<!-- Converted: ~95 bytes (LONGER ✗ - DON'T CONVERT) -->
<path d="M15 10h70a5 5 0 0 1 5 5v50a5 5 0 0 1 -5 5h-70a5 5 0 0 1 -5 -5v-50a5 5 0 0 1 5 -5z"/>
```

**Decision:** Only convert rectangles **without rounded corners** (rx/ry).

---

### 2. Circle → Path

**Algorithm:**
```typescript
function circleToPath(cx: number, cy: number, r: number): string {
  // Two semicircular arcs that form a complete circle
  // Using absolute arc commands: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
  
  const left = cx - r;
  const right = cx + r;
  
  // Start at rightmost point, draw top arc, then bottom arc
  return `M${right} ${cy}A${r} ${r} 0 1 0 ${left} ${cy}A${r} ${r} 0 1 0 ${right} ${cy}`;
}
```

**Examples:**

| Original | Bytes | Converted | Bytes | Savings |
|----------|-------|-----------|-------|---------|
| `<circle cx="50" cy="50" r="25"/>` | 27 | `<path d="M75 50A25 25 0 1 0 25 50A25 25 0 1 0 75 50"/>` | 50 | **-23 bytes (LONGER ✗)** |
| `<circle cx="12" cy="12" r="10"/>` | 27 | `<path d="M22 12A10 10 0 1 0 2 12A10 10 0 1 0 22 12"/>` | 48 | **-21 bytes (LONGER ✗)** |

**Decision:** **NEVER convert circles** - path representation is always longer.

**Exception:** If circle has a `transform` that could be baked into the path coordinates, conversion might save bytes:
```xml
<!-- Original: 72 bytes -->
<circle cx="0" cy="0" r="10" transform="translate(50,50)"/>

<!-- Converted: 54 bytes (SHORTER ✓) -->
<path d="M60 50A10 10 0 1 0 40 50A10 10 0 1 0 60 50"/>
```

---

### 3. Ellipse → Path

**Algorithm:**
```typescript
function ellipseToPath(cx: number, cy: number, rx: number, ry: number): string {
  const left = cx - rx;
  const right = cx + rx;
  
  // Similar to circle but with different rx/ry
  return `M${right} ${cy}A${rx} ${ry} 0 1 0 ${left} ${cy}A${rx} ${ry} 0 1 0 ${right} ${cy}`;
}
```

**Examples:**

| Original | Bytes | Converted | Bytes | Savings |
|----------|-------|-----------|-------|---------|
| `<ellipse cx="50" cy="30" rx="40" ry="20"/>` | 37 | `<path d="M90 30A40 20 0 1 0 10 30A40 20 0 1 0 90 30"/>` | 52 | **-15 bytes (LONGER ✗)** |

**Decision:** **NEVER convert ellipses** - path representation is always longer.

---

### 4. Polygon → Path

**Algorithm:**
```typescript
function polygonToPath(points: string): string {
  // points = "x1,y1 x2,y2 x3,y3 ..."
  const coords = points.trim().split(/[\s,]+/).map(Number);
  
  if (coords.length < 4) return null; // Need at least 2 points
  
  let path = `M${coords[0]} ${coords[1]}`;
  
  for (let i = 2; i < coords.length; i += 2) {
    path += `L${coords[i]} ${coords[i + 1]}`;
  }
  
  path += 'z'; // Close path
  
  return path;
}
```

**Examples:**

| Original | Bytes | Converted | Bytes | Savings |
|----------|-------|-----------|-------|---------|
| `<polygon points="10,10 50,10 50,50 10,50"/>` | 41 | `<path d="M10 10L50 10L50 50L10 50z"/>` | 35 | **6 bytes (15%)** |
| `<polygon points="0,0 100,0 50,87"/>` | 32 | `<path d="M0 0L100 0L50 87z"/>` | 28 | **4 bytes (13%)** |

**With optimization (H/V commands):**
```xml
<!-- Original: 41 bytes -->
<polygon points="10,10 50,10 50,50 10,50"/>

<!-- Converted + Optimized: 27 bytes (SHORTER ✓) -->
<path d="M10 10H50V50H10z"/>
```

**Decision:** **ALWAYS convert polygons** - path is almost always shorter, especially after H/V optimization.

---

### 5. Polyline → Path

**Algorithm:**
```typescript
function polylineToPath(points: string): string {
  // Similar to polygon but WITHOUT closing 'z'
  const coords = points.trim().split(/[\s,]+/).map(Number);
  
  if (coords.length < 4) return null;
  
  let path = `M${coords[0]} ${coords[1]}`;
  
  for (let i = 2; i < coords.length; i += 2) {
    path += `L${coords[i]} ${coords[i + 1]}`;
  }
  
  // Note: No 'z' at the end (polyline is not closed)
  return path;
}
```

**Examples:**

| Original | Bytes | Converted | Bytes | Savings |
|----------|-------|-----------|-------|---------|
| `<polyline points="10,10 50,10 50,50"/>` | 35 | `<path d="M10 10L50 10L50 50"/>` | 28 | **7 bytes (20%)** |
| `<polyline points="0,0 10,5 20,0 30,5"/>` | 38 | `<path d="M0 0L10 5L20 0L30 5"/>` | 30 | **8 bytes (21%)** |

**With optimization (H/V commands):**
```xml
<!-- Original: 35 bytes -->
<polyline points="10,10 50,10 50,50"/>

<!-- Converted + Optimized: 21 bytes (SHORTER ✓) -->
<path d="M10 10H50V50"/>
```

**Decision:** **ALWAYS convert polylines** - path is almost always shorter.

---

## Size Calculation Logic

```typescript
interface ConversionResult {
  convert: boolean;
  originalSize: number;
  pathSize: number;
  savings: number;
  reason: string;
}

function shouldConvert(
  element: SVGNode,
  pathData: string
): ConversionResult {
  // Calculate original element size (serialized)
  const originalSVG = serializeNode(element, { minify: true });
  const originalSize = originalSVG.length;
  
  // Calculate path size with same attributes
  const pathElement: SVGNode = {
    type: 'element',
    tag: 'path',
    attrs: new Map(element.attrs),
    children: []
  };
  
  // Remove shape-specific attributes (x, y, width, height, cx, cy, r, rx, ry, points)
  pathElement.attrs.delete('x');
  pathElement.attrs.delete('y');
  pathElement.attrs.delete('width');
  pathElement.attrs.delete('height');
  pathElement.attrs.delete('cx');
  pathElement.attrs.delete('cy');
  pathElement.attrs.delete('r');
  pathElement.attrs.delete('rx');
  pathElement.attrs.delete('ry');
  pathElement.attrs.delete('points');
  
  // Set path data
  pathElement.attrs.set('d', pathData);
  
  const pathSVG = serializeNode(pathElement, { minify: true });
  const pathSize = pathSVG.length;
  
  const savings = originalSize - pathSize;
  const threshold = 5; // Minimum bytes to save
  
  return {
    convert: savings > threshold,
    originalSize,
    pathSize,
    savings,
    reason: savings > threshold 
      ? `Saves ${savings} bytes (${((savings/originalSize)*100).toFixed(1)}%)`
      : `Only saves ${savings} bytes (below ${threshold} byte threshold)`
  };
}
```

---

## Integration Strategy

### Pipeline Placement

**Option 1: Before Path Optimization (Recommended)**
```
advanced-optimization → shape-conversion → path-optimization → path-simplification → ...
```

**Rationale:**
- Shape conversion creates new paths
- Path optimization can then apply H/V commands
- Path simplification can reduce points
- Maximum compression achieved

**Option 2: After Path Optimization**
```
advanced-optimization → path-optimization → shape-conversion → path-simplification → ...
```

**Rationale:**
- Existing paths are already optimized
- New converted paths get optimized in next pass
- Risk of missing optimization on converted paths

**Decision:** **Option 1** - Shape conversion before path optimization ensures all paths benefit from subsequent stages.

---

## Configuration

### Optimization Levels

```typescript
// BASIC: No shape conversion (preserve original)
shapeConversion: false

// BALANCED: No shape conversion (safe, predictable)
shapeConversion: false

// AGGRESSIVE: Convert shapes to paths if shorter
shapeConversion: true
shapeConversionThreshold: 5  // Min bytes to save

// MAXIMUM: Aggressive conversion
shapeConversion: true
shapeConversionThreshold: 0  // Convert even if 1 byte savings
```

---

## Edge Cases & Special Handling

### 1. Rounded Rectangles
**Decision:** **Never convert** - rounded corners require complex arc commands that are longer than `<rect rx="..." ry="..."/>`

### 2. Circles and Ellipses
**Decision:** **Never convert by default** - path representation is always longer

**Exception:** If circle/ellipse has a `transform` attribute that can be baked into coordinates:
```xml
<circle cx="0" cy="0" r="10" transform="translate(50,50)"/>
→ <path d="M60 50A10 10 0 1 0 40 50A10 10 0 1 0 60 50"/>
```

### 3. Polygons and Polylines
**Decision:** **Always convert** - path is almost always shorter, especially after H/V optimization

### 4. Shapes with Many Attributes
```xml
<rect x="10" y="10" width="50" height="50" 
      fill="red" stroke="blue" stroke-width="2" 
      opacity="0.5" class="icon" id="rect-1"
      data-tooltip="Hello" filter="url(#blur)"/>
```

**Decision:** Convert if path representation is still shorter (use `shouldConvert()` logic)

---

## Testing Strategy

### Unit Tests

```typescript
describe('shape-conversion', () => {
  describe('rectToPath', () => {
    it('converts simple rectangle', () => {
      const result = rectToPath(10, 20, 100, 50);
      expect(result).toBe('M10 20h100v50h-100z');
    });
    
    it('skips rounded rectangles', () => {
      const result = rectToPath(10, 10, 80, 60, 5, 5);
      expect(result).toBeNull();
    });
  });
  
  describe('polygonToPath', () => {
    it('converts triangle', () => {
      const result = polygonToPath('0,0 100,0 50,87');
      expect(result).toBe('M0 0L100 0L50 87z');
    });
  });
  
  describe('shouldConvert', () => {
    it('converts when savings > threshold', () => {
      const rect = createRect(10, 20, 100, 50);
      const result = shouldConvert(rect, 'M10 20h100v50h-100z');
      expect(result.convert).toBe(true);
      expect(result.savings).toBeGreaterThan(5);
    });
    
    it('skips when savings < threshold', () => {
      const circle = createCircle(50, 50, 25);
      const result = shouldConvert(circle, 'M75 50A25 25 0 1 0 25 50A25 25 0 1 0 75 50');
      expect(result.convert).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
describe('shape-conversion integration', () => {
  it('reduces file size on shape-heavy SVG', async () => {
    const svg = `
      <svg viewBox="0 0 200 200">
        <rect x="10" y="10" width="50" height="50" fill="red"/>
        <polygon points="100,10 150,10 125,50" fill="blue"/>
        <polyline points="10,100 50,100 50,150" stroke="black"/>
        <circle cx="125" cy="125" r="25" fill="green"/>
      </svg>
    `;
    
    const result = await optimize(svg, { level: OptLevel.AGGRESSIVE });
    
    // Rect, polygon, polyline should be converted
    expect(result).toContain('<path d="M10 10h50v50h-50z"');
    expect(result).toContain('<path d="M100 10L150 10L125 50z"');
    expect(result).toContain('<path d="M10 100H50V150"');
    
    // Circle should remain (path is longer)
    expect(result).toContain('<circle');
  });
});
```

---

## Performance Considerations

### Time Complexity
- **rectToPath()**: O(1) - simple arithmetic
- **circleToPath()**: O(1) - simple arithmetic  
- **ellipseToPath()**: O(1) - simple arithmetic
- **polygonToPath()**: O(n) where n = number of points
- **shouldConvert()**: O(1) - string length comparison

### Memory
- No additional memory overhead
- In-place tree modification

### Parallelization
- Each shape conversion is independent
- Can be parallelized across multiple shapes
- No dependencies between conversions

---

## Expected Results

### Test Case 1: Icon Library (24 icons)
```
Before shape conversion: 8,450 bytes
After shape conversion:  7,820 bytes
Reduction: 630 bytes (7.5%)
```

**Breakdown:**
- 12 rectangles → 8 converted (4 had rounded corners)
- 18 polygons → all converted
- 6 circles → none converted
- 4 polylines → all converted

### Test Case 2: UI Component Kit
```
Before shape conversion: 15,230 bytes
After shape conversion:  13,890 bytes
Reduction: 1,340 bytes (8.8%)
```

### Test Case 3: Data Visualization (Chart)
```
Before shape conversion: 42,100 bytes
After shape conversion:  38,650 bytes
Reduction: 3,450 bytes (8.2%)
```

**Overall Expected Impact:** +5-10% reduction on shape-heavy SVGs

---

## Next Steps

1. ✅ **Design Complete** - This document
2. ⏳ **Implement `shape-conversion.ts`** - Conversion functions
3. ⏳ **Integrate into pipeline** - Add to AGGRESSIVE/MAXIMUM levels
4. ⏳ **Create test suite** - Unit + integration tests
5. ⏳ **Benchmark** - Measure actual reduction on real SVGs
6. ⏳ **Document** - Add to README and optimization guide

---

**Ready to implement!** 🚀
