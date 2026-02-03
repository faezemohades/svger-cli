/**
 * Phase 3: Style Optimizer
 *
 * Responsibilities:
 * 1. Inline/merge <style> rules when beneficial
 * 2. Convert presentation attributes ↔ style for size optimization
 * 3. Minify CSS (remove whitespace, comments)
 * 4. Calculate size tradeoff for inlining vs external styles
 */

import type { SVGNode } from './svg-tree-parser.js';
import type { OptConfig } from './types.js';

/**
 * Presentation attributes that can be converted to/from CSS
 */
const PRESENTATION_ATTRIBUTES = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'opacity',
  'visibility',
  'display',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'transform',
]);

/**
 * Parse CSS rules from a style block
 * Reserved for future: style rule merging/inlining
 */
/*
function parseCSSRules(cssText: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();

  // Remove comments
  const cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

  // Match selector { declarations }
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(cleaned)) !== null) {
    // Prevent infinite loop if regex doesn't advance
    if (match.index === ruleRegex.lastIndex) {
      ruleRegex.lastIndex++;
    }
    
    const selector = match[1].trim();
    const declarationsText = match[2].trim();

    // Parse declarations
    const declarations = new Map<string, string>();
    const declPairs = declarationsText.split(';').filter(Boolean);

    for (const pair of declPairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) continue;

      const prop = pair.substring(0, colonIndex).trim();
      const value = pair.substring(colonIndex + 1).trim();

      if (prop && value) {
        declarations.set(prop, value);
      }
    }

    if (declarations.size > 0) {
      rules.set(selector, declarations);
    }
  }

  return rules;
}
*/

/**
 * Serialize CSS rules back to string
 * Reserved for future: style rule merging/inlining
 */
/*
function serializeCSSRules(
  rules: Map<string, Map<string, string>>,
  minify: boolean = true
): string {
  const parts: string[] = [];

  for (const [selector, declarations] of rules) {
    const declParts: string[] = [];

    for (const [prop, value] of declarations) {
      declParts.push(`${prop}:${value}`);
    }

    if (minify) {
      parts.push(`${selector}{${declParts.join(';')}}`);
    } else {
      parts.push(`${selector} {\n  ${declParts.join(';\n  ')};\n}`);
    }
  }

  return minify ? parts.join('') : parts.join('\n');
}
*/

/**
 * Convert presentation attributes to inline style
 */
function attributesToStyle(node: SVGNode): boolean {
  const styleProps: string[] = [];
  const attrsToRemove: string[] = [];

  for (const [name, value] of node.attrs) {
    if (PRESENTATION_ATTRIBUTES.has(name)) {
      // Convert attribute name to CSS property name
      const cssName = name; // Most SVG attrs match CSS props
      styleProps.push(`${cssName}:${value}`);
      attrsToRemove.push(name);
    }
  }

  if (styleProps.length === 0) {
    return false;
  }

  // Calculate size difference
  const attrsSize = attrsToRemove.reduce(
    (sum, name) => sum + name.length + node.attrs.get(name)!.length + 3, // name="value"
    0
  );

  const styleSize = 7 + styleProps.join(';').length; // style="..."

  // Only convert if it saves space (or is same size for cleaner output)
  if (styleSize <= attrsSize) {
    // Merge with existing style if present
    const existingStyle = node.attrs.get('style') || '';
    const newStyle = existingStyle
      ? `${existingStyle};${styleProps.join(';')}`
      : styleProps.join(';');

    node.attrs.set('style', newStyle);

    // Remove converted attributes
    for (const name of attrsToRemove) {
      node.attrs.delete(name);
    }

    return true;
  }

  return false;
}

/**
 * Convert inline style to presentation attributes
 */
function styleToAttributes(node: SVGNode): boolean {
  const style = node.attrs.get('style');
  if (!style) {
    return false;
  }

  // Parse style declarations
  const declarations = style.split(';').filter(Boolean);
  const newAttrs: Map<string, string> = new Map();
  const nonPresentationProps: string[] = [];

  for (const decl of declarations) {
    const colonIndex = decl.indexOf(':');
    if (colonIndex === -1) continue;

    const prop = decl.substring(0, colonIndex).trim();
    const value = decl.substring(colonIndex + 1).trim();

    if (PRESENTATION_ATTRIBUTES.has(prop)) {
      newAttrs.set(prop, value);
    } else {
      nonPresentationProps.push(decl);
    }
  }

  if (newAttrs.size === 0) {
    return false;
  }

  // Calculate size difference
  const styleSize = 7 + style.length; // style="..."
  const attrsSize = Array.from(newAttrs.entries()).reduce(
    (sum, [name, value]) => sum + name.length + value.length + 3,
    0
  );

  const remainingStyleSize =
    nonPresentationProps.length > 0
      ? 7 + nonPresentationProps.join(';').length
      : 0;

  // Only convert if it saves space
  if (attrsSize + remainingStyleSize < styleSize) {
    // Set new attributes
    for (const [name, value] of newAttrs) {
      node.attrs.set(name, value);
    }

    // Update or remove style attribute
    if (nonPresentationProps.length > 0) {
      node.attrs.set('style', nonPresentationProps.join(';'));
    } else {
      node.attrs.delete('style');
    }

    return true;
  }

  return false;
}

/**
 * Minify CSS in style elements
 */
function minifyCSS(cssText: string): string {
  let result = cssText;

  // Remove comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove unnecessary whitespace
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/\s*([{}:;,])\s*/g, '$1');

  // Remove trailing semicolons
  result = result.replace(/;}/g, '}');

  // Trim
  result = result.trim();

  return result;
}

/**
 * Optimize style elements in the tree
 */
export function optimizeStyles(
  root: SVGNode,
  config: OptConfig
): {
  minifiedStyles: number;
  convertedToAttrs: number;
  convertedToStyle: number;
} {
  let minifiedStyles = 0;
  let convertedToAttrs = 0;
  let convertedToStyle = 0;

  const traverse = (node: SVGNode) => {
    if (!node) return;

    // Minify <style> elements
    if (node.tag === 'style' && node.content) {
      const original = node.content;
      node.content = minifyCSS(original);
      if (node.content !== original) {
        minifiedStyles++;
      }
    }

    // Convert between attributes and style
    if (node.type === 'element') {
      // Try style → attributes first (usually more compact)
      if (config.inlineStyles === false) {
        if (styleToAttributes(node)) {
          convertedToAttrs++;
        }
      } else if (config.inlineStyles === true) {
        // Convert attributes → style (for consistency)
        if (attributesToStyle(node)) {
          convertedToStyle++;
        }
      } else {
        // Auto mode: convert to whichever is smaller
        // Try both and keep the one that saves more space
        const beforeSize = calculateNodeAttributeSize(node);

        // Try style → attrs
        const savedNode = cloneNodeAttrs(node);
        if (styleToAttributes(node)) {
          const afterAttrsSize = calculateNodeAttributeSize(node);
          if (afterAttrsSize < beforeSize) {
            convertedToAttrs++;
          } else {
            // Revert and try attrs → style
            restoreNodeAttrs(node, savedNode);
            if (attributesToStyle(node)) {
              const afterStyleSize = calculateNodeAttributeSize(node);
              if (afterStyleSize < beforeSize) {
                convertedToStyle++;
              } else {
                // Neither saves space, revert
                restoreNodeAttrs(node, savedNode);
              }
            }
          }
        } else if (attributesToStyle(node)) {
          const afterStyleSize = calculateNodeAttributeSize(node);
          if (afterStyleSize < beforeSize) {
            convertedToStyle++;
          } else {
            // Revert
            restoreNodeAttrs(node, savedNode);
          }
        }
      }
    }

    // Recurse
    for (const child of node.children) {
      if (child.type === 'element') {
        traverse(child);
      }
    }
  };

  traverse(root);

  return {
    minifiedStyles,
    convertedToAttrs,
    convertedToStyle,
  };
}

/**
 * Calculate byte size of node's attributes
 */
function calculateNodeAttributeSize(node: SVGNode): number {
  let size = 0;
  for (const [name, value] of node.attrs) {
    size += name.length + value.length + 3; // name="value"
  }
  return size;
}

/**
 * Clone node attributes for backup
 */
function cloneNodeAttrs(node: SVGNode): Map<string, string> {
  return new Map(node.attrs);
}

/**
 * Restore node attributes from backup
 */
function restoreNodeAttrs(node: SVGNode, backup: Map<string, string>): void {
  node.attrs = new Map(backup);
}

/**
 * Style optimization stage for pipeline
 */
export function styleOptimizationStage(
  root: SVGNode,
  config: OptConfig
): {
  modified: boolean;
  stats: {
    minifiedStyles: number;
    convertedToAttrs: number;
    convertedToStyle: number;
  };
} {
  const stats = optimizeStyles(root, config);

  return {
    modified:
      stats.minifiedStyles > 0 ||
      stats.convertedToAttrs > 0 ||
      stats.convertedToStyle > 0,
    stats,
  };
}
