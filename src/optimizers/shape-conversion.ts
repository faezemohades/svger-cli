/**
 * Phase 6.1: Shape Conversion
 *
 * Converts primitive SVG shapes (<rect>, <circle>, <ellipse>, <polygon>, <polyline>)
 * to <path> elements when the path representation is shorter.
 *
 * Goal: +5-10% additional reduction on shape-heavy SVGs
 *
 * Strategy:
 * - Only convert when pathSize < originalSize - threshold
 * - Skip circles/ellipses (path is always longer)
 * - Skip rounded rectangles (arc commands are longer)
 * - Always convert polygons/polylines (path is usually shorter)
 * - Preserve all non-geometric attributes (fill, stroke, class, etc.)
 */

import type { SVGNode } from './svg-tree-parser.js';
import { serializeNode } from './tree-serializer.js';
import type { OptConfig } from './types.js';

/**
 * Result of conversion decision
 */
interface ConversionResult {
  convert: boolean;
  originalSize: number;
  pathSize: number;
  savings: number;
  pathData: string | null;
  reason: string;
}

/**
 * Convert rectangle to path
 * Only converts rectangles without rounded corners (rx/ry)
 */
function rectToPath(
  x: number,
  y: number,
  width: number,
  height: number,
  rx?: number,
  ry?: number
): string | null {
  // Skip rounded rectangles (arc commands make path longer)
  if (rx || ry) {
    return null;
  }

  // Use relative commands for shortest representation
  // M = move to starting point
  // h = horizontal line (relative)
  // v = vertical line (relative)
  // z = close path
  return `M${x} ${y}h${width}v${height}h${-width}z`;
}

/**
 * Convert circle to path
 * Note: Path representation is almost always LONGER than <circle>
 * Only use when transform can be baked into coordinates
 */
function circleToPath(cx: number, cy: number, r: number): string {
  const left = cx - r;
  const right = cx + r;

  // Two semicircular arcs forming complete circle
  // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
  return `M${right} ${cy}A${r} ${r} 0 1 0 ${left} ${cy}A${r} ${r} 0 1 0 ${right} ${cy}`;
}

/**
 * Convert ellipse to path
 * Note: Path representation is almost always LONGER than <ellipse>
 */
function ellipseToPath(cx: number, cy: number, rx: number, ry: number): string {
  const left = cx - rx;
  const right = cx + rx;

  return `M${right} ${cy}A${rx} ${ry} 0 1 0 ${left} ${cy}A${rx} ${ry} 0 1 0 ${right} ${cy}`;
}

/**
 * Convert polygon to path
 * Polygons are closed shapes, so path ends with 'z'
 */
function polygonToPath(points: string): string | null {
  // Parse points: "x1,y1 x2,y2 x3,y3 ..." or "x1 y1 x2 y2 x3 y3 ..."
  const coords = points
    .trim()
    .split(/[\s,]+/)
    .map(n => parseFloat(n));

  if (coords.length < 4) {
    return null; // Need at least 2 points (x,y pairs)
  }

  // Start with Move command to first point
  let path = `M${coords[0]} ${coords[1]}`;

  // Add Line commands to remaining points
  for (let i = 2; i < coords.length; i += 2) {
    path += `L${coords[i]} ${coords[i + 1]}`;
  }

  // Close path
  path += 'z';

  return path;
}

/**
 * Convert polyline to path
 * Polylines are NOT closed, so no 'z' at the end
 */
function polylineToPath(points: string): string | null {
  const coords = points
    .trim()
    .split(/[\s,]+/)
    .map(n => parseFloat(n));

  if (coords.length < 4) {
    return null;
  }

  let path = `M${coords[0]} ${coords[1]}`;

  for (let i = 2; i < coords.length; i += 2) {
    path += `L${coords[i]} ${coords[i + 1]}`;
  }

  // Note: No 'z' - polyline is not closed
  return path;
}

/**
 * Calculate if shape should be converted to path
 * Only convert if path representation is significantly shorter
 */
function shouldConvert(
  element: SVGNode,
  pathData: string,
  threshold: number
): ConversionResult {
  // Calculate original element size (serialized)
  const originalSVG = serializeNode(element, { minify: true });
  const originalSize = originalSVG.length;

  // Create equivalent path element with same attributes
  const pathElement: SVGNode = {
    type: 'element',
    tag: 'path',
    attrs: new Map(element.attrs),
    children: [],
  };

  // Remove shape-specific attributes
  const shapeAttrs = [
    'x',
    'y',
    'width',
    'height',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'points',
  ];
  shapeAttrs.forEach(attr => pathElement.attrs.delete(attr));

  // Set path data
  pathElement.attrs.set('d', pathData);

  const pathSVG = serializeNode(pathElement, { minify: true });
  const pathSize = pathSVG.length;

  const savings = originalSize - pathSize;

  return {
    convert: savings > threshold,
    originalSize,
    pathSize,
    savings,
    pathData,
    reason:
      savings > threshold
        ? `Saves ${savings} bytes (${((savings / originalSize) * 100).toFixed(1)}%)`
        : `Only saves ${savings} bytes (below ${threshold} byte threshold)`,
  };
}

/**
 * Convert a single shape element to path if beneficial
 */
function convertShapeToPath(
  node: SVGNode,
  threshold: number
): { converted: boolean; savings: number } {
  const tag = node.tag;

  let pathData: string | null = null;

  switch (tag) {
    case 'rect': {
      const x = parseFloat(node.attrs.get('x') || '0');
      const y = parseFloat(node.attrs.get('y') || '0');
      const width = parseFloat(node.attrs.get('width') || '0');
      const height = parseFloat(node.attrs.get('height') || '0');
      const rx = node.attrs.has('rx')
        ? parseFloat(node.attrs.get('rx')!)
        : undefined;
      const ry = node.attrs.has('ry')
        ? parseFloat(node.attrs.get('ry')!)
        : undefined;

      pathData = rectToPath(x, y, width, height, rx, ry);
      break;
    }

    case 'circle': {
      const cx = parseFloat(node.attrs.get('cx') || '0');
      const cy = parseFloat(node.attrs.get('cy') || '0');
      const r = parseFloat(node.attrs.get('r') || '0');

      pathData = circleToPath(cx, cy, r);
      break;
    }

    case 'ellipse': {
      const cx = parseFloat(node.attrs.get('cx') || '0');
      const cy = parseFloat(node.attrs.get('cy') || '0');
      const rx = parseFloat(node.attrs.get('rx') || '0');
      const ry = parseFloat(node.attrs.get('ry') || '0');

      pathData = ellipseToPath(cx, cy, rx, ry);
      break;
    }

    case 'polygon': {
      const points = node.attrs.get('points');
      if (points) {
        pathData = polygonToPath(points);
      }
      break;
    }

    case 'polyline': {
      const points = node.attrs.get('points');
      if (points) {
        pathData = polylineToPath(points);
      }
      break;
    }

    default:
      return { converted: false, savings: 0 };
  }

  // Check if conversion was possible
  if (!pathData) {
    return { converted: false, savings: 0 };
  }

  // Check if conversion is beneficial
  const result = shouldConvert(node, pathData, threshold);

  if (result.convert) {
    // Perform conversion: change tag and attributes
    node.tag = 'path';

    // Remove shape-specific attributes
    node.attrs.delete('x');
    node.attrs.delete('y');
    node.attrs.delete('width');
    node.attrs.delete('height');
    node.attrs.delete('cx');
    node.attrs.delete('cy');
    node.attrs.delete('r');
    node.attrs.delete('rx');
    node.attrs.delete('ry');
    node.attrs.delete('points');

    // Set path data
    node.attrs.set('d', pathData);

    return { converted: true, savings: result.savings };
  }

  return { converted: false, savings: 0 };
}

/**
 * Traverse SVG tree and convert shapes to paths
 */
function traverseAndConvert(
  node: SVGNode,
  threshold: number,
  stats: { converted: number; totalSavings: number }
): void {
  // Check if current node is a convertible shape
  const shapes = ['rect', 'circle', 'ellipse', 'polygon', 'polyline'];
  if (shapes.includes(node.tag)) {
    const result = convertShapeToPath(node, threshold);
    if (result.converted) {
      stats.converted++;
      stats.totalSavings += result.savings;
    }
  }

  // Recurse to children
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.type === 'element') {
        traverseAndConvert(child as SVGNode, threshold, stats);
      }
    }
  }
}

/**
 * Shape conversion stage for optimization pipeline
 */
export async function shapeConversionStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  // Only run if shape conversion is enabled
  if (!config.shapeConversion) {
    console.log('[shape-conversion] Disabled in config');
    return svg;
  }

  console.log(
    '[shape-conversion] Enabled, threshold:',
    config.shapeConversionThreshold
  );

  const { parseSVG } = await import('./svg-tree-parser.js');
  const { serializeSVGMinified } = await import('./tree-serializer.js');

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const threshold = config.shapeConversionThreshold ?? 5;
    const stats = { converted: 0, totalSavings: 0 };

    traverseAndConvert(tree, threshold, stats);

    if (stats.converted > 0) {
      console.log(
        `[shape-conversion] Converted ${stats.converted} shapes, saved ${stats.totalSavings} bytes`
      );
    } else {
      console.log(
        '[shape-conversion] No shapes converted (none met savings threshold)'
      );
    }

    return serializeSVGMinified(tree);
  } catch (error) {
    console.warn('Shape conversion failed:', error);
    return svg;
  }
}

/**
 * Export conversion functions for testing
 */
export {
  rectToPath,
  circleToPath,
  ellipseToPath,
  polygonToPath,
  polylineToPath,
  convertShapeToPath,
  shouldConvert,
};
