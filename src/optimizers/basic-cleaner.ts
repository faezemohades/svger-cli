/**
 * Basic SVG Cleaner
 * Extracts basic cleaning logic from svg-processor for use in optimizer pipeline
 */

import type { OptConfig } from './types.js';

/**
 * Remove XML declarations from SVG content
 */
export function removeXMLDeclaration(svg: string, config: OptConfig): string {
  if (!config.removeXMLProcInst) return svg;
  return svg.replace(/<\?xml.*?\?>/g, '');
}

/**
 * Remove px units from width and height attributes for React compatibility
 */
export function removePxUnits(svg: string): string {
  // Convert width="24px" to width={24} for React
  return svg.replace(/\s(width|height)=["'](\d+)px["']/g, ' $1={$2}');
}

/**
 * Remove DOCTYPE declarations from SVG content
 */
export function removeDoctype(svg: string, config: OptConfig): string {
  if (!config.removeDoctype) return svg;
  return svg.replace(/<!DOCTYPE.*?>/g, '');
}

/**
 * Remove comments from SVG content
 */
export function removeComments(svg: string, config: OptConfig): string {
  if (!config.removeComments) return svg;
  return svg.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Normalize whitespace in SVG content
 */
export function normalizeWhitespace(svg: string, config: OptConfig): string {
  if (!config.normalizeWhitespace) return svg;

  return svg
    .replace(/\r?\n|\r/g, '') // Remove line breaks
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Remove metadata elements from SVG content
 */
export function removeMetadata(svg: string, config: OptConfig): string {
  if (!config.removeMetadata) return svg;

  return svg
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<title[\s\S]*?<\/title>/gi, '')
    .replace(/<desc[\s\S]*?<\/desc>/gi, '');
}

/**
 * Convert kebab-case attributes to camelCase for React compatibility
 */
export function convertToCamelCase(svg: string, config: OptConfig): string {
  if (!config.reactCompatibility) return svg;

  const attributeMap: Record<string, string> = {
    'fill-rule': 'fillRule',
    'clip-rule': 'clipRule',
    'stroke-width': 'strokeWidth',
    'stroke-linecap': 'strokeLinecap',
    'stroke-linejoin': 'strokeLinejoin',
    'stroke-miterlimit': 'strokeMiterlimit',
    'stroke-dasharray': 'strokeDasharray',
    'stroke-dashoffset': 'strokeDashoffset',
    'font-family': 'fontFamily',
    'font-size': 'fontSize',
    'font-weight': 'fontWeight',
    'text-anchor': 'textAnchor',
    'stop-color': 'stopColor',
    'stop-opacity': 'stopOpacity',
    'fill-opacity': 'fillOpacity',
    'stroke-opacity': 'strokeOpacity',
  };

  // Create a single regex from all keys — O(n) instead of O(k*n)
  const regex = new RegExp(Object.keys(attributeMap).join('|'), 'g');
  
  return svg.replace(regex, (match) => attributeMap[match]);
}

/**
 * Remove unnecessary XML namespace attributes
 */
export function removeXMLNamespaces(svg: string, config: OptConfig): string {
  if (!config.removeUnnecessaryAttrs) return svg;

  // Remove xmlns and xmlns:xlink (React handles these automatically)
  return svg.replace(/\s+xmlns(:xlink)?="[^"]*"/g, '');
}

/**
 * Remove inline style attributes
 * Note: This can be aggressive - use with caution
 */
export function removeInlineStyles(svg: string, config: OptConfig): string {
  // When inlineStyles is true, remove them completely
  // When false (default), convert to React style objects for React compatibility
  if (config.inlineStyles) {
    // Remove style attributes completely
    return svg.replace(/\s+style="[^"]*"/g, '');
  }

  // Convert inline CSS styles to React style objects for React compatibility
  return svg.replace(/\s+style="([^"]*)"/g, (_match, styleString) => {
    // Handle empty style attributes
    if (!styleString.trim()) {
      return '';
    }

    const styles: Record<string, string> = {};

    // Parse CSS declarations
    const declarations = styleString
      .split(';')
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

    // If no valid styles, remove the attribute
    if (Object.keys(styles).length === 0) {
      return '';
    }

    // Generate React inline style object syntax
    const styleEntries = Object.entries(styles)
      .map(([key, value]) => `${key}: '${value}'`)
      .join(', ');

    return ` style={{${styleEntries}}}`;
  });
}

/**
 * Shorten hex colors (#ffffff → #fff)
 */
export function shortenColors(svg: string, config: OptConfig): string {
  if (!config.shortenColors) return svg;

  // Match 6-digit hex colors that can be shortened
  return svg.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3/gi, '#$1$2$3');
}

/**
 * Remove empty containers (g, defs without children or with only whitespace)
 */
export function removeEmptyContainers(svg: string, config: OptConfig): string {
  if (!config.removeEmptyContainers) return svg;

  let result = svg;
  let previousResult = '';

  // Iteratively remove empty containers until no more are found
  while (result !== previousResult) {
    previousResult = result;
    result = result
      .replace(/<g\s*><\/g>/gi, '') // Empty g tags
      .replace(/<g\s*>\s*<\/g>/gi, '') // g tags with only whitespace
      .replace(/<defs\s*><\/defs>/gi, '') // Empty defs tags
      .replace(/<defs\s*>\s*<\/defs>/gi, ''); // defs with only whitespace
  }

  return result;
}

/**
 * Remove hidden elements (display:none, opacity:0, visibility:hidden)
 */
/**
 * Remove hidden elements (display:none, opacity:0, visibility:hidden)
 * NOTE: Disabled because it's too aggressive with regex and breaks complex SVGs.
 * Use tree-based optimization (remove-hidden-empty.ts) instead for safe removal.
 */
export function removeHiddenElements(svg: string): string {
  // DISABLED: Regex-based removal is too aggressive
  // Tree-based optimizer handles this correctly
  return svg;
}

/**
 * Round float numbers to specified precision
 */
export function roundFloats(svg: string, config: OptConfig): string {
  const precision = config.floatPrecision;

  // Match floating point numbers
  return svg.replace(/(\d+\.\d+)/g, match => {
    const num = parseFloat(match);
    return num.toFixed(precision).replace(/\.?0+$/, ''); // Remove trailing zeros
  });
}

/**
 * Sort attributes alphabetically
 */
export function sortAttributes(svg: string, config: OptConfig): string {
  if (!config.sortAttrs) return svg;

  // Match SVG tags with attributes (both self-closing and regular)
  return svg.replace(
    /<([a-z][a-z0-9]*)\s+([^>]+?)(\/?)>/gi,
    (_match, tagName, attrs, selfClosing) => {
      // Parse attributes
      const attrPairs: Array<[string, string]> = [];
      const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g;
      let attrMatch;

      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        // Prevent infinite loop if regex doesn't advance
        if (attrMatch.index === attrRegex.lastIndex) {
          attrRegex.lastIndex++;
        }
        attrPairs.push([attrMatch[1], attrMatch[2]]);
      }

      // Sort alphabetically
      attrPairs.sort((a, b) => a[0].localeCompare(b[0]));

      // Reconstruct tag, preserving self-closing status
      const sortedAttrs = attrPairs
        .map(([key, val]) => `${key}="${val}"`)
        .join(' ');
      return `<${tagName} ${sortedAttrs}${selfClosing}>`;
    }
  );
}

/**
 * Basic cleaning stage - combines all basic cleaners
 * This is the main entry point for the optimizer pipeline
 */
export async function basicCleaningStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  let result = svg;

  // Apply cleaners in sequence
  result = removeXMLDeclaration(result, config);
  result = removeDoctype(result, config);
  result = removeComments(result, config);
  result = removeMetadata(result, config);
  result = normalizeWhitespace(result, config);
  result = removeXMLNamespaces(result, config);
  result = removeInlineStyles(result, config);
  result = convertToCamelCase(result, config);
  result = removePxUnits(result); // Remove px units for React compatibility
  result = shortenColors(result, config);
  result = roundFloats(result, config);
  result = removeEmptyContainers(result, config);
  result = removeHiddenElements(result);
  result = sortAttributes(result, config);

  return result;
}
