/**
 * Basic SVG Cleaner
 * Extracts basic cleaning logic from svg-processor for use in optimizer pipeline
 */

import type { OptConfig } from './types.js';
import {
  optimizeColor,
  optimizeSVGAttributeValue,
} from './numeric-optimizer.js';
import {
  normalizeSVGFormattingWhitespace,
  removeSVGXMLComments,
  transformSVGAttributeValues,
} from './xml-attribute-transform.js';

/**
 * Remove XML declarations from SVG content
 */
export function removeXMLDeclaration(svg: string, config: OptConfig): string {
  if (!config.removeXMLProcInst) return svg;
  return svg.replace(/^\uFEFF?<\?xml\s[^?]*\?>\s*/i, '');
}

/**
 * Remove px units from width and height attributes for React compatibility
 */
export function removePxUnits(svg: string): string {
  // Unit conversion may affect viewport sizing and is intentionally disabled.
  return svg;
}

/**
 * Remove DOCTYPE declarations from SVG content
 */
export function removeDoctype(svg: string, config: OptConfig): string {
  // The security boundary rejects DTDs. Do not regex-remove document syntax.
  void config;
  return svg;
}

/**
 * Remove comments from SVG content
 */
export function removeComments(svg: string, config: OptConfig): string {
  if (!config.removeComments) return svg;
  // This walker recognizes comments only in XML markup, not CDATA.
  return removeSVGXMLComments(svg);
}

/**
 * Normalize whitespace in SVG content
 */
export function normalizeWhitespace(svg: string, config: OptConfig): string {
  if (!config.normalizeWhitespace) return svg;
  return normalizeSVGFormattingWhitespace(svg);
}

/**
 * Remove metadata elements from SVG content
 */
export function removeMetadata(svg: string, config: OptConfig): string {
  // Titles, descriptions, and metadata are observable document semantics.
  void config;
  return svg;
}

/**
 * Convert kebab-case attributes to camelCase for React compatibility
 */
export function convertToCamelCase(svg: string, config: OptConfig): string {
  if (!config.reactCompatibility) return svg;

  // Optimizer output must remain valid SVG/XML.
  // JSX-specific attribute conversion is applied later during component generation.
  return svg;
}

/**
 * Remove unnecessary XML namespace attributes
 */
export function removeXMLNamespaces(svg: string, config: OptConfig): string {
  if (!config.removeUnnecessaryAttrs) return svg;

  return svg;
}

/**
 * Remove inline style attributes
 * Note: This can be aggressive - use with caution
 */
export function removeInlineStyles(svg: string, config: OptConfig): string {
  // Style deletion/conversion can alter cascade and precedence.
  void config;
  return svg;
}

/**
 * Shorten hex colors (#ffffff → #fff)
 */
export function shortenColors(svg: string, config: OptConfig): string {
  if (!config.shortenColors) return svg;
  const colorAttributes = new Set([
    'fill',
    'stroke',
    'stop-color',
    'flood-color',
    'lighting-color',
  ]);
  return transformSVGAttributeValues(svg, (_tag, name, value) => {
    if (!colorAttributes.has(name) || value.trim() !== value) return value;
    return optimizeColor(value);
  });
}

/**
 * Remove empty containers (g, defs without children or with only whitespace)
 */
export function removeEmptyContainers(svg: string, config: OptConfig): string {
  // Whitespace-only children may be significant in text or preserve contexts.
  void config;
  return svg;
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
  if (!config.enableNumericOptimization) return svg;
  const numericAttributes = new Set([
    'x',
    'y',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'width',
    'height',
    'x1',
    'y1',
    'x2',
    'y2',
    'stroke-width',
    'font-size',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'offset',
    'd',
    'points',
    'viewBox',
  ]);
  return transformSVGAttributeValues(svg, (_tag, name, value) =>
    numericAttributes.has(name)
      ? optimizeSVGAttributeValue(name, value, config)
      : value
  );
}

/**
 * Sort attributes alphabetically
 */
export function sortAttributes(svg: string, config: OptConfig): string {
  // Attribute sorting is not worth reparsing/re-serializing this source.
  void config;
  return svg;
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
  // Unit removal is deferred because it can change viewport sizing semantics.
  result = shortenColors(result, config);
  result = roundFloats(result, config);
  result = removeEmptyContainers(result, config);
  result = removeHiddenElements(result);
  result = sortAttributes(result, config);

  return result;
}
