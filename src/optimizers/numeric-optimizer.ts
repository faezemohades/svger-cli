/**
 * Phase 3: Numeric & Attribute Optimizer
 *
 * Responsibilities:
 * 1. Round floating-point numbers with configurable precision
 * 2. Optimize color representations (#RRGGBB → #RGB, named → hex)
 * 3. Remove default/unnecessary attributes
 * 4. Shorten numeric values (remove trailing zeros, unnecessary decimals)
 */

import type { SVGNode } from './svg-tree-parser.js';
import type { OptConfig } from './types.js';

/**
 * SVG default attribute values by element type
 * Only remove if value matches default exactly
 */
const SVG_DEFAULTS: Record<string, Record<string, string>> = {
  '*': {
    // Universal defaults
    fill: 'black',
    'fill-opacity': '1',
    'fill-rule': 'nonzero',
    stroke: 'none',
    'stroke-width': '1',
    'stroke-opacity': '1',
    'stroke-linecap': 'butt',
    'stroke-linejoin': 'miter',
    'stroke-miterlimit': '4',
    opacity: '1',
    visibility: 'visible',
    display: 'inline',
  },
  text: {
    'font-size': '16',
    'font-family': 'sans-serif',
    'text-anchor': 'start',
  },
  path: {
    'fill-rule': 'nonzero',
  },
};

/**
 * Named CSS colors that can be shortened
 * Maps long color names to shorter hex equivalents
 */
const NAMED_COLOR_SHORTCUTS: Record<string, string> = {
  // Short hex is shorter than name
  white: '#fff',
  black: '#000',
  red: '#f00',
  lime: '#0f0',
  blue: '#00f',
  yellow: '#ff0',
  cyan: '#0ff',
  magenta: '#f0f',
  silver: '#c0c0c0',
  gray: '#808080',
  maroon: '#800000',
  olive: '#808000',
  green: '#008000',
  purple: '#800080',
  teal: '#008080',
  navy: '#000080',
};

/**
 * Hex colors that can use named equivalents (if shorter)
 * Reverse of above - maps hex to name when name is shorter
 */
const HEX_TO_NAME: Record<string, string> = {
  '#f0ffff': 'azure',
  '#f5f5dc': 'beige',
  '#ffe4c4': 'bisque',
  '#a52a2a': 'brown',
  '#ff7f50': 'coral',
  '#ffd700': 'gold',
  '#808080': 'gray',
  '#008000': 'green',
  '#4b0082': 'indigo',
  '#fffff0': 'ivory',
  '#f0e68c': 'khaki',
  '#faf0e6': 'linen',
  '#800000': 'maroon',
  '#000080': 'navy',
  '#808000': 'olive',
  '#ffa500': 'orange',
  '#da70d6': 'orchid',
  '#cd853f': 'peru',
  '#ffc0cb': 'pink',
  '#dda0dd': 'plum',
  '#800080': 'purple',
  '#f00': 'red',
  '#fa8072': 'salmon',
  '#a0522d': 'sienna',
  '#c0c0c0': 'silver',
  '#fffafa': 'snow',
  '#d2b48c': 'tan',
  '#008080': 'teal',
  '#ff6347': 'tomato',
  '#ee82ee': 'violet',
  '#f5deb3': 'wheat',
};

/**
 * Round a number to specified decimal places
 * Removes trailing zeros and unnecessary decimal point
 */
export function roundNumber(value: number, precision: number): string {
  if (!isFinite(value)) {
    return String(value);
  }

  // Round to precision
  const multiplier = Math.pow(10, precision);
  const rounded = Math.round(value * multiplier) / multiplier;

  // Convert to string and remove trailing zeros
  let result = rounded.toFixed(precision);

  // Remove trailing zeros after decimal point
  if (result.includes('.')) {
    result = result.replace(/\.?0+$/, '');
  }

  // Handle negative zero
  if (result === '-0') {
    result = '0';
  }

  return result;
}

/**
 * Optimize a numeric string value
 * Removes unnecessary decimals, trailing zeros, etc.
 */
export function optimizeNumericString(
  value: string,
  precision: number
): string {
  // Try to parse as number
  const num = parseFloat(value);

  if (isNaN(num)) {
    return value;
  }

  return roundNumber(num, precision);
}

/**
 * Convert rgb(r, g, b) to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Shorten hex color #RRGGBB to #RGB if possible
 */
function shortenHexColor(hex: string): string {
  // Match #RRGGBB format
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) {
    return hex;
  }

  const [, rrggbb] = match;
  const r1 = rrggbb[0];
  const r2 = rrggbb[1];
  const g1 = rrggbb[2];
  const g2 = rrggbb[3];
  const b1 = rrggbb[4];
  const b2 = rrggbb[5];

  // Can shorten if each pair has identical digits
  if (r1 === r2 && g1 === g2 && b1 === b2) {
    return `#${r1}${g1}${b1}`.toLowerCase();
  }

  return hex.toLowerCase();
}

/**
 * Optimize color value to shortest representation
 * Handles: named colors, hex colors, rgb() notation
 */
export function optimizeColor(color: string): string {
  const trimmed = color.trim().toLowerCase();

  // Handle named colors → hex
  if (NAMED_COLOR_SHORTCUTS[trimmed]) {
    return NAMED_COLOR_SHORTCUTS[trimmed];
  }

  // Handle rgb(r, g, b) notation
  const rgbMatch = trimmed.match(
    /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/
  );
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const hex = rgbToHex(r, g, b);
    return shortenHexColor(hex);
  }

  // Handle rgba with alpha=1 (can drop alpha)
  const rgbaMatch = trimmed.match(
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*1(\.0*)?\s*\)$/
  );
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const hex = rgbToHex(r, g, b);
    return shortenHexColor(hex);
  }

  // Handle hex colors
  if (trimmed.startsWith('#')) {
    const shortened = shortenHexColor(trimmed);
    // Check if a named color is shorter
    const named = HEX_TO_NAME[shortened];
    if (named && named.length < shortened.length) {
      return named;
    }
    return shortened;
  }

  // Return as-is if no optimization possible
  return color;
}

/**
 * Check if attribute value is the default for the element
 */
function isDefaultValue(
  elementTag: string,
  attrName: string,
  attrValue: string
): boolean {
  // Check element-specific defaults
  const elementDefaults = SVG_DEFAULTS[elementTag];
  if (elementDefaults && elementDefaults[attrName] === attrValue) {
    return true;
  }

  // Check universal defaults
  const universalDefaults = SVG_DEFAULTS['*'];
  if (universalDefaults && universalDefaults[attrName] === attrValue) {
    return true;
  }

  return false;
}

/**
 * Optimize a single attribute value
 */
function optimizeAttributeValue(
  attrName: string,
  attrValue: string,
  config: OptConfig
): string {
  // Color attributes
  const colorAttrs = new Set([
    'fill',
    'stroke',
    'stop-color',
    'flood-color',
    'lighting-color',
  ]);

  if (colorAttrs.has(attrName)) {
    return optimizeColor(attrValue);
  }

  // Numeric attributes
  const numericAttrs = new Set([
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
  ]);

  if (numericAttrs.has(attrName)) {
    return optimizeNumericString(attrValue, config.floatPrecision);
  }

  // Path data (d attribute) - special handling
  if (attrName === 'd') {
    return optimizePathData(attrValue, config.floatPrecision);
  }

  // Points attribute (for polygon/polyline)
  if (attrName === 'points') {
    return optimizePointsData(attrValue, config.floatPrecision);
  }

  // ViewBox
  if (attrName === 'viewBox') {
    return optimizeViewBox(attrValue, config.floatPrecision);
  }

  return attrValue;
}

/**
 * Optimize path data (d attribute)
 * Rounds numbers, removes unnecessary spaces
 */
function optimizePathData(pathData: string, precision: number): string {
  // Replace all numbers with optimized versions
  return pathData.replace(/-?[\d.]+/g, match => {
    const num = parseFloat(match);
    if (isNaN(num)) {
      return match;
    }
    return roundNumber(num, precision);
  });
}

/**
 * Optimize points data (for polygon/polyline)
 */
function optimizePointsData(points: string, precision: number): string {
  // Split by whitespace and/or commas
  const coords = points.split(/[\s,]+/).filter(Boolean);

  // Optimize each coordinate
  const optimized = coords.map(coord => {
    const num = parseFloat(coord);
    if (isNaN(num)) {
      return coord;
    }
    return roundNumber(num, precision);
  });

  // Join with spaces (shortest separator)
  return optimized.join(' ');
}

/**
 * Optimize viewBox attribute
 */
function optimizeViewBox(viewBox: string, precision: number): string {
  const values = viewBox.split(/[\s,]+/).filter(Boolean);

  const optimized = values.map(val => {
    const num = parseFloat(val);
    if (isNaN(num)) {
      return val;
    }
    return roundNumber(num, precision);
  });

  return optimized.join(' ');
}

/**
 * Remove default and unnecessary attributes from a node
 */
function removeDefaultAttributes(node: SVGNode): number {
  let removedCount = 0;

  const attrsToRemove: string[] = [];

  for (const [name, value] of node.attrs) {
    if (isDefaultValue(node.tag, name, value)) {
      attrsToRemove.push(name);
      removedCount++;
    }
  }

  // Remove marked attributes
  for (const name of attrsToRemove) {
    node.attrs.delete(name);
  }

  return removedCount;
}

/**
 * Optimize all numeric values and attributes in the tree
 */
export function optimizeNumericValues(
  root: SVGNode,
  config: OptConfig
): {
  optimizedAttributes: number;
  removedDefaults: number;
} {
  let optimizedAttributes = 0;
  let removedDefaults = 0;

  // Traverse tree
  const traverse = (node: SVGNode) => {
    // Optimize attribute values
    for (const [name, value] of node.attrs) {
      const optimized = optimizeAttributeValue(name, value, config);
      if (optimized !== value) {
        node.attrs.set(name, optimized);
        optimizedAttributes++;
      }
    }

    // Remove default attributes
    if (config.removeUnnecessaryAttrs) {
      const removed = removeDefaultAttributes(node);
      removedDefaults += removed;
    }

    // Recurse to children
    for (const child of node.children) {
      if (child.type === 'element') {
        traverse(child);
      }
    }
  };

  traverse(root);

  return {
    optimizedAttributes,
    removedDefaults,
  };
}

/**
 * Numeric optimization stage for pipeline
 */
export function numericOptimizationStage(
  root: SVGNode,
  config: OptConfig
): {
  modified: boolean;
  stats: {
    optimizedAttributes: number;
    removedDefaults: number;
  };
} {
  const stats = optimizeNumericValues(root, config);

  return {
    modified: stats.optimizedAttributes > 0 || stats.removedDefaults > 0,
    stats,
  };
}
