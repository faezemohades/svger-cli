# Bug Fix Summary: Invalid React JSX Output in SVGER v4

## Issue Description

SVGER v4.0.0 was generating invalid React/TypeScript code with two critical problems:

### Problem 1: Invalid px Units in JSX
```tsx
// ❌ BEFORE (Invalid JSX):
<svg width={props.width || 24px} height={props.height || 24px}>

// ✅ AFTER (Valid JSX):
<svg width={props.width || 24} height={props.height || 24}>
```

### Problem 2: Raw CSS Strings Instead of React Style Objects
```tsx
// ❌ BEFORE (Invalid - raw CSS string):
<path style="fill: #000; stroke-width: 2px;" />

// ✅ AFTER (Valid - React style object):
<path style={{fill: '#000', strokeWidth: '2px'}} />
```

## Root Cause

1. **Styled Components Template**: Unconditionally appending `'${defaultWidth}px'` to all width/height prop values
2. **SVG Optimizer**: `removeInlineStyles()` function was removing style attributes entirely instead of converting them to React-compatible format
3. **Missing px Unit Removal**: No logic to strip `px` units from width/height attributes in source SVGs

## Files Modified

### 1. `/src/core/template-manager.ts` (Line 334-335)
**Fix**: Added type checking for Styled Components template to handle numeric vs string props

```typescript
// BEFORE:
const StyledSVG = styled.svg<SVGProps<SVGSVGElement>>`
  width: \${props => props.width || '${defaultWidth}px'};
  height: \${props => props.height || '${defaultHeight}px'};
`;

// AFTER:
const StyledSVG = styled.svg<SVGProps<SVGSVGElement>>`
  width: \${props => typeof props.width === 'number' ? \`\${props.width}px\` : props.width || '${defaultWidth}px'};
  height: \${props => typeof props.height === 'number' ? \`\${props.height}px\` : props.height || '${defaultHeight}px'};
`;
```

### 2. `/src/optimizers/basic-cleaner.ts`
**Fix 1**: Completely rewrote `removeInlineStyles()` to convert CSS to React objects

```typescript
export function removeInlineStyles(svg: string, config: OptConfig): string {
  // When inlineStyles is true, remove them completely
  // When false (default), convert to React style objects for React compatibility
  if (config.inlineStyles) {
    return svg.replace(/\s+style="[^"]*"/g, '');
  }

  // Convert inline CSS styles to React style objects
  return svg.replace(/\s+style="([^"]*)"/g, (_match, styleString) => {
    const styles: Record<string, string> = {};
    
    // Parse CSS declarations
    const declarations = styleString.split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    declarations.forEach((declaration: string) => {
      const [property, value] = declaration
        .split(':')
        .map((s: string) => s.trim());

      if (property && value) {
        // Convert CSS property names to camelCase (stroke-width → strokeWidth)
        const camelProperty = property.replace(/-([a-z])/g, (g: string) =>
          g[1].toUpperCase()
        );
        styles[camelProperty] = value;
      }
    });

    // Generate React inline style object syntax
    const styleEntries = Object.entries(styles)
      .map(([key, value]) => `${key}: '${value}'`)
      .join(', ');

    return ` style={{${styleEntries}}}`;
  });
}
```

**Fix 2**: Added `removePxUnits()` function and integrated it into the pipeline

```typescript
/**
 * Remove px units from width and height attributes for React compatibility
 */
export function removePxUnits(svg: string): string {
  // Convert width="24px" to width={24} for React
  return svg.replace(/\s(width|height)=["'](\d+)px["']/g, ' $1={$2}');
}

// Added to basicCleaningStage pipeline:
result = removePxUnits(result); // Remove px units for React compatibility
```

### 3. `/src/processors/svg-processor.ts` (Lines 147-217)
**Note**: Also added style conversion method here, but the optimizer path (`basic-cleaner.ts`) is used by default, so this is a fallback for legacy cleaning.

## Testing

### New Test Suite: `src/__tests__/svg-style-conversion.test.ts`
Created comprehensive test suite with 9 test cases covering:
- ✅ Inline style conversion to React objects
- ✅ Multiple style properties handling
- ✅ Kebab-case to camelCase conversion (stroke-width → strokeWidth)
- ✅ Empty style attribute removal
- ✅ px unit removal from width/height
- ✅ React attribute conversion (fill-rule → fillRule)
- ✅ Complex SVG scenarios with both styles and attributes
- ✅ TypeScript/React compatibility validation

**Result**: All 9 tests passing ✅

### Real-World Test
Generated React component from test SVG with:
- Inline styles: `style="fill: #FF0000; stroke-width: 2px; opacity: 0.8;"`
- px units: `width="24px" height="24px"`
- Multiple CSS properties

**Generated Output**:
```tsx
<svg
  ref={ref}
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg"
  width={dimensions.width}
  height={dimensions.height}
  fill={props.fill || "none"}
  {...props}
>
  <path style={{fill: '#F00', strokeWidth: '2px', opacity: '0.8'}} 
        d="M12 2L2 7v10c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-10-5z" 
        fillRule="evenodd"/>
  <circle cx="12" cy="12" r="3" 
          style={{fill: 'currentColor', stroke: 'blue', strokeWidth: '1.5px'}}/>
</svg>
```

✅ **All Issues Resolved**:
- No px units in JSX numeric attributes
- Styles converted to React objects
- CSS properties in camelCase
- Valid TypeScript/React code

## Impact

### Affected Components
- ✅ React components (all template types: functional, class, forwardRef, styled-components)
- ✅ React Native components
- ✅ Preact components
- ✅ Solid components
- ✅ All JSX-based frameworks

### Optimization Levels
- ✅ **BASIC**: Converts styles to React objects (default: `inlineStyles: false`)
- ✅ **BALANCED**: Converts styles to React objects
- ✅ **AGGRESSIVE**: Converts styles to React objects
- ✅ **MAXIMUM**: Removes styles entirely (expected: `inlineStyles: true`)

## Behavior Changes

### Style Attribute Handling
**Before**: All inline styles were removed from generated components
**After**: 
- Default optimization (`inlineStyles: false`): Converts to React style objects
- Maximum optimization (`inlineStyles: true`): Removes styles completely (intentional)

### Width/Height Attributes
**Before**: SVGs with `width="24px"` generated invalid JSX: `width="24px"`
**After**: Automatically strips px units: `width={24}`

## Migration Notes

**For Users**: No breaking changes. Generated components are now valid React/TypeScript code that compiles correctly.

**Recommendation**: Regenerate components if you previously worked around these issues or disabled type checking.

## Algorithm Details

### CSS to React Style Conversion
1. Extract style attribute content: `/style="([^"]*)"/g`
2. Split by semicolon, parse `property:value` pairs
3. Convert properties to camelCase using regex: `/-([a-z])/g` → uppercase next char
4. Generate React object syntax: `style={{fill: '#000', strokeWidth: '2px'}}`

### px Unit Removal
- Regex: `/\s(width|height)=["'](\d+)px["']/g`
- Replacement: ` $1={$2}`
- Example: `width="24px"` → `width={24}`

## Version Information
- **SVGER Version**: v4.0.0
- **Node.js**: v20.19.1
- **Fix Date**: January 28, 2026

## Related Issues
This fix resolves the critical production bug reported where SVGER v4 generated invalid JSX causing TypeScript/React compilation errors.
