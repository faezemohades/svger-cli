/**
 * SVG Tree Serializer
 * Convert tree structure back to minified string
 * Optimized for small output size
 */

import type { SVGNode } from './svg-tree-parser.js';

/**
 * Serializer options
 */
export interface SerializerOptions {
  /** Minify output (remove whitespace, newlines) */
  minify: boolean;

  /** Sort attributes alphabetically */
  sortAttributes: boolean;

  /** Use self-closing tags for void elements */
  selfClosing: boolean;

  /** Pretty print with indentation (for debugging) */
  prettyPrint: boolean;

  /** Indentation string (only used if prettyPrint is true) */
  indent: string;
}

/**
 * Default serializer options
 */
const DEFAULT_OPTIONS: SerializerOptions = {
  minify: true,
  sortAttributes: false,
  selfClosing: true,
  prettyPrint: false,
  indent: '  ',
};

/**
 * Self-closing elements
 */
const SELF_CLOSING_ELEMENTS = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'use',
  'stop',
  'image',
]);

/**
 * Elements that should preserve content as-is
 */
const PRESERVE_CONTENT_ELEMENTS = new Set(['style', 'script']);

/**
 * Escape attribute value for HTML
 */
function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape text content for HTML
 */
function escapeTextContent(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Serialize attributes to string
 */
function serializeAttributes(
  attrs: Map<string, string>,
  options: SerializerOptions
): string {
  if (attrs.size === 0) {
    return '';
  }

  let entries = Array.from(attrs.entries());

  // Sort attributes if requested
  if (options.sortAttributes) {
    entries = entries.sort((a, b) => a[0].localeCompare(b[0]));
  }

  // Build attribute string
  const attrStrings = entries.map(
    ([name, value]) => `${name}="${escapeAttributeValue(value)}"`
  );

  return ' ' + attrStrings.join(' ');
}

/**
 * Serialize SVG node to string
 */
export function serializeNode(
  node: SVGNode,
  options: Partial<SerializerOptions> = {},
  depth = 0
): string {
  const opts: SerializerOptions = { ...DEFAULT_OPTIONS, ...options };

  // Handle root container
  if (node.tag === 'root') {
    return node.children
      .map(child => serializeNode(child, opts, depth))
      .join('');
  }

  // Handle comments
  if (node.type === 'comment') {
    if (opts.minify) {
      return ''; // Skip comments in minified output
    }
    return `<!--${node.content || ''}-->`;
  }

  // Handle text nodes
  if (node.type === 'text') {
    const text = node.content || '';
    if (opts.minify) {
      return text.trim();
    }
    return escapeTextContent(text);
  }

  // Build opening tag
  const indent = opts.prettyPrint ? opts.indent.repeat(depth) : '';
  const newline = opts.prettyPrint ? '\n' : '';

  let result = indent + '<' + node.tag;

  // Add attributes
  result += serializeAttributes(node.attrs, opts);

  // Handle self-closing tags
  const isSelfClosing =
    opts.selfClosing &&
    (SELF_CLOSING_ELEMENTS.has(node.tag) ||
      (node.children.length === 0 && !node.content));

  if (isSelfClosing) {
    result += '/>';
    if (opts.prettyPrint) {
      result += newline;
    }
    return result;
  }

  result += '>';

  // Handle content
  if (node.content) {
    if (PRESERVE_CONTENT_ELEMENTS.has(node.tag)) {
      // Preserve content as-is for style/script
      result += node.content;
    } else {
      // Escape and optionally trim content
      const content = opts.minify ? node.content.trim() : node.content;
      result += opts.minify ? content : escapeTextContent(content);
    }
  }

  // Handle children
  if (node.children.length > 0) {
    if (opts.prettyPrint) {
      result += newline;
    }

    for (const child of node.children) {
      result += serializeNode(child, opts, depth + 1);
    }

    if (opts.prettyPrint) {
      result += indent;
    }
  }

  // Closing tag
  result += '</' + node.tag + '>';

  if (opts.prettyPrint) {
    result += newline;
  }

  return result;
}

/**
 * Serialize SVG tree to string (minified by default)
 */
export function serializeSVG(
  node: SVGNode | null,
  options: Partial<SerializerOptions> = {}
): string {
  if (!node) {
    return '';
  }

  return serializeNode(node, options, 0);
}

/**
 * Serialize SVG tree to pretty-printed string (for debugging)
 */
export function serializeSVGPretty(node: SVGNode | null): string {
  return serializeSVG(node, {
    minify: false,
    prettyPrint: true,
    sortAttributes: false,
    selfClosing: true,
  });
}

/**
 * Serialize SVG tree to minified string (for production)
 */
export function serializeSVGMinified(node: SVGNode | null): string {
  return serializeSVG(node, {
    minify: true,
    prettyPrint: false,
    sortAttributes: false,
    selfClosing: true,
  });
}

/**
 * Calculate size reduction from serialization
 */
export function calculateReduction(
  original: string,
  serialized: string
): {
  originalSize: number;
  serializedSize: number;
  reduction: number;
  reductionPercent: number;
} {
  const originalSize = Buffer.byteLength(original, 'utf8');
  const serializedSize = Buffer.byteLength(serialized, 'utf8');
  const reduction = originalSize - serializedSize;
  const reductionPercent = (reduction / originalSize) * 100;

  return {
    originalSize,
    serializedSize,
    reduction,
    reductionPercent,
  };
}
