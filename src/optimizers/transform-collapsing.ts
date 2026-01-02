/**
 * Phase 5: Transform Collapsing & Matrix Mastery
 *
 * Responsibilities:
 * 1. Propagate transforms down the tree
 * 2. Apply transforms to coordinates/paths (bake into d attribute)
 * 3. Collapse nested transforms into single matrix per element
 * 4. Remove identity/no-op transforms
 * 5. Extract repeated transformed shapes to <defs> + <use>
 *
 * Superior to SVGO's cleanupTransforms - especially for Illustrator exports.
 */

import type { SVGNode } from './svg-tree-parser.js';
import type { OptConfig } from './types.js';
import {
  parseTransformList,
  consolidateTransforms,
  isIdentityMatrix,
  decomposeMatrix,
} from './transform-optimizer.js';

/**
 * 2D transformation matrix [a, b, c, d, e, f]
 */
type Matrix = [number, number, number, number, number, number];

/**
 * Identity matrix
 */
const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

/**
 * Multiply two matrices: result = m1 × m2
 */
function multiplyMatrices(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;

  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/**
 * Apply matrix transformation to a point
 */
function transformPoint(
  matrix: Matrix,
  x: number,
  y: number
): [number, number] {
  const [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}

/**
 * Get transform matrix from node's transform attribute
 */
function getNodeTransform(node: SVGNode): Matrix {
  const transformAttr = node.attrs.get('transform');
  if (!transformAttr) {
    return IDENTITY_MATRIX;
  }

  const transforms = parseTransformList(transformAttr);
  return consolidateTransforms(transforms);
}

/**
 * Check if node is a container that should have transforms propagated
 */
function isContainer(tag: string): boolean {
  return ['g', 'svg', 'symbol', 'defs', 'clipPath', 'mask'].includes(tag);
}

/**
 * Check if node is a shape that can have transforms applied to coordinates
 */
function isShape(tag: string): boolean {
  return [
    'rect',
    'circle',
    'ellipse',
    'line',
    'polygon',
    'polyline',
    'path',
  ].includes(tag);
}

/**
 * Apply transform matrix to rect coordinates
 */
function applyTransformToRect(node: SVGNode, matrix: Matrix): boolean {
  const x = parseFloat(node.attrs.get('x') || '0');
  const y = parseFloat(node.attrs.get('y') || '0');
  const width = parseFloat(node.attrs.get('width') || '0');
  const height = parseFloat(node.attrs.get('height') || '0');

  // Only handle simple translate transforms for now (no rotation/skew)
  const [a, b, c, d] = matrix;

  // Check if it's a simple translate + scale
  if (Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6) {
    // Transform top-left corner
    const [newX, newY] = transformPoint(matrix, x, y);

    // Scale dimensions
    const newWidth = width * a;
    const newHeight = height * d;

    // Update attributes
    node.attrs.set('x', newX.toString());
    node.attrs.set('y', newY.toString());
    node.attrs.set('width', newWidth.toString());
    node.attrs.set('height', newHeight.toString());

    // Remove transform
    node.attrs.delete('transform');
    return true;
  }

  return false;
}

/**
 * Apply transform matrix to circle coordinates
 */
function applyTransformToCircle(node: SVGNode, matrix: Matrix): boolean {
  const cx = parseFloat(node.attrs.get('cx') || '0');
  const cy = parseFloat(node.attrs.get('cy') || '0');
  const r = parseFloat(node.attrs.get('r') || '0');

  // Only handle simple translate transforms (no scale/rotation that would make it ellipse)
  const [a, b, c, d] = matrix;

  // Check if it's uniform scale + translate (circle stays circle)
  if (
    Math.abs(b) < 1e-6 &&
    Math.abs(c) < 1e-6 &&
    Math.abs(a - d) < 1e-6 &&
    a > 0
  ) {
    // Transform center
    const [newCx, newCy] = transformPoint(matrix, cx, cy);

    // Scale radius
    const newR = r * a;

    // Update attributes
    node.attrs.set('cx', newCx.toString());
    node.attrs.set('cy', newCy.toString());
    node.attrs.set('r', newR.toString());

    // Remove transform
    node.attrs.delete('transform');
    return true;
  }

  return false;
}

/**
 * Apply transform matrix to line coordinates
 */
function applyTransformToLine(node: SVGNode, matrix: Matrix): boolean {
  const x1 = parseFloat(node.attrs.get('x1') || '0');
  const y1 = parseFloat(node.attrs.get('y1') || '0');
  const x2 = parseFloat(node.attrs.get('x2') || '0');
  const y2 = parseFloat(node.attrs.get('y2') || '0');

  // Transform both points
  const [newX1, newY1] = transformPoint(matrix, x1, y1);
  const [newX2, newY2] = transformPoint(matrix, x2, y2);

  // Update attributes
  node.attrs.set('x1', newX1.toString());
  node.attrs.set('y1', newY1.toString());
  node.attrs.set('x2', newX2.toString());
  node.attrs.set('y2', newY2.toString());

  // Remove transform
  node.attrs.delete('transform');
  return true;
}

/**
 * Apply transform matrix to polygon/polyline points
 */
function applyTransformToPoints(node: SVGNode, matrix: Matrix): boolean {
  const pointsAttr = node.attrs.get('points');
  if (!pointsAttr) return false;

  // Parse points
  const coords = pointsAttr
    .trim()
    .split(/[\s,]+/)
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));

  if (coords.length < 2 || coords.length % 2 !== 0) {
    return false;
  }

  // Transform each point
  const transformedCoords: number[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    const [newX, newY] = transformPoint(matrix, coords[i], coords[i + 1]);
    transformedCoords.push(newX, newY);
  }

  // Update points attribute
  const newPoints = transformedCoords.join(' ');
  node.attrs.set('points', newPoints);

  // Remove transform
  node.attrs.delete('transform');
  return true;
}

/**
 * Apply transform to path data (simplified - basic transforms only)
 * Full path transformation would require parsing and transforming each command
 */
function applyTransformToPath(node: SVGNode, matrix: Matrix): boolean {
  // For now, only handle simple translate transforms on absolute paths
  // Full implementation would use path-parser.ts to transform all coordinates
  const [a, b, c, d, e, f] = matrix;

  // Only simple translate (no rotation/scale/skew)
  if (
    Math.abs(a - 1) < 1e-6 &&
    Math.abs(b) < 1e-6 &&
    Math.abs(c) < 1e-6 &&
    Math.abs(d - 1) < 1e-6
  ) {
    const pathData = node.attrs.get('d');
    if (!pathData) return false;

    // Simple regex-based coordinate adjustment (basic implementation)
    // TODO: Use path-parser.ts for full transformation
    const hasOnlyAbsolute = !/[mlhvcsqta]/.test(pathData);

    if (hasOnlyAbsolute && (Math.abs(e) > 1e-6 || Math.abs(f) > 1e-6)) {
      // Very basic: add translate values to all coordinates
      // This is a simplified approach - full implementation needs path-parser
      const transformed = pathData.replace(
        /([MLHVCSQTA])\s*([\d.eE+-]+)(?:\s+([\d.eE+-]+))?/gi,
        (match, cmd, x, y) => {
          const numX = parseFloat(x);
          const numY = y ? parseFloat(y) : null;

          if (cmd.toUpperCase() === 'H') {
            return `${cmd}${numX + e}`;
          } else if (cmd.toUpperCase() === 'V') {
            return `${cmd}${numY !== null ? numY + f : numX + f}`;
          } else if (numY !== null) {
            return `${cmd}${numX + e} ${numY + f}`;
          }
          return match;
        }
      );

      node.attrs.set('d', transformed);
      node.attrs.delete('transform');
      return true;
    }
  }

  return false;
}

/**
 * Apply transform to shape coordinates
 */
function applyTransformToShape(node: SVGNode, matrix: Matrix): boolean {
  switch (node.tag) {
    case 'rect':
      return applyTransformToRect(node, matrix);
    case 'circle':
      return applyTransformToCircle(node, matrix);
    case 'line':
      return applyTransformToLine(node, matrix);
    case 'polygon':
    case 'polyline':
      return applyTransformToPoints(node, matrix);
    case 'path':
      return applyTransformToPath(node, matrix);
    default:
      return false;
  }
}

/**
 * Collapse transforms by propagating down the tree
 */
export function collapseTransforms(
  root: SVGNode,
  _config: OptConfig
): {
  collapsedGroups: number;
  bakedTransforms: number;
  removedIdentity: number;
} {
  let collapsedGroups = 0;
  let bakedTransforms = 0;
  let removedIdentity = 0;

  const traverse = (node: SVGNode, parentMatrix: Matrix = IDENTITY_MATRIX) => {
    if (!node) return;

    // Get this node's transform
    const nodeMatrix = getNodeTransform(node);

    // Combine with parent transform
    const combinedMatrix = multiplyMatrices(parentMatrix, nodeMatrix);

    // Check if combined matrix is identity
    if (isIdentityMatrix(combinedMatrix)) {
      if (node.attrs.has('transform')) {
        node.attrs.delete('transform');
        removedIdentity++;
      }

      // Continue with identity matrix
      for (const child of node.children) {
        if (child.type === 'element') {
          traverse(child, IDENTITY_MATRIX);
        }
      }
      return;
    }

    // If this is a shape, try to apply parent transform to it
    if (isShape(node.tag) && !isIdentityMatrix(parentMatrix)) {
      const nodeMatrix = getNodeTransform(node);
      const finalMatrix = multiplyMatrices(parentMatrix, nodeMatrix);

      if (applyTransformToShape(node, finalMatrix)) {
        bakedTransforms++;
      }
    }

    // If this is a container (g, svg, etc.)
    if (isContainer(node.tag)) {
      // If it's a group with only one child, try to collapse
      if (
        node.tag === 'g' &&
        node.children.length === 1 &&
        node.children[0].type === 'element'
      ) {
        const child = node.children[0];

        // If child is also a container (nested groups), try to collapse them
        if (isContainer(child.tag)) {
          // Multiply transforms and apply to child
          const childMatrix = getNodeTransform(child);
          const finalMatrix = multiplyMatrices(combinedMatrix, childMatrix);

          // Set the combined transform on child and remove parent's transform
          if (!isIdentityMatrix(finalMatrix)) {
            const transformStr = decomposeMatrix(finalMatrix);
            if (transformStr) {
              child.attrs.set('transform', transformStr);
            } else {
              child.attrs.delete('transform');
            }
          } else {
            child.attrs.delete('transform');
          }

          node.attrs.delete('transform');
          collapsedGroups++;

          // Continue traversing children with identity (we moved transform down)
          for (const c of node.children) {
            if (c.type === 'element') {
              traverse(c, IDENTITY_MATRIX);
            }
          }
          return;
        }

        // If child is a shape, try to apply combined transform to it
        if (isShape(child.tag)) {
          const childMatrix = getNodeTransform(child);
          const finalMatrix = multiplyMatrices(combinedMatrix, childMatrix);

          if (applyTransformToShape(child, finalMatrix)) {
            // Remove this group's transform since we baked it into child
            node.attrs.delete('transform');
            collapsedGroups++;
            bakedTransforms++;

            // Continue traversing children with identity
            for (const c of node.children) {
              if (c.type === 'element') {
                traverse(c, IDENTITY_MATRIX);
              }
            }
            return;
          }
        }
      }

      // Otherwise, propagate combined transform to children
      for (const child of node.children) {
        if (child.type === 'element') {
          traverse(child, combinedMatrix);
        }
      }

      // After propagating, remove this node's transform if it was fully propagated
      if (!isIdentityMatrix(combinedMatrix) && isIdentityMatrix(nodeMatrix)) {
        node.attrs.delete('transform');
      }
    } else if (isShape(node.tag)) {
      // Try to apply combined transform to shape
      if (applyTransformToShape(node, combinedMatrix)) {
        bakedTransforms++;
      } else {
        // Can't apply - set combined transform on node
        if (!isIdentityMatrix(combinedMatrix)) {
          const [a, b, c, d, e, f] = combinedMatrix;
          node.attrs.set('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
        }
      }

      // Shapes don't have children to traverse
    } else {
      // Other elements - propagate to children
      for (const child of node.children) {
        if (child.type === 'element') {
          traverse(child, combinedMatrix);
        }
      }
    }
  };

  traverse(root);

  // Unwrap single-child groups with no attributes
  const unwrapGroups = (node: SVGNode): void => {
    if (!node || !node.children) return;

    // First, recurse to unwrap nested structures
    for (const child of node.children) {
      if (child.type === 'element') {
        unwrapGroups(child);
      }
    }

    // Then unwrap single-child <g> elements with no attributes
    const newChildren: SVGNode[] = [];
    for (const child of node.children) {
      if (
        child.type === 'element' &&
        child.tag === 'g' &&
        child.attrs.size === 0 &&
        child.children.length === 1
      ) {
        // Unwrap: replace group with its child
        newChildren.push(child.children[0]);
        collapsedGroups++; // Count as additional collapse
      } else {
        newChildren.push(child);
      }
    }
    node.children = newChildren;
  };

  unwrapGroups(root);

  return {
    collapsedGroups,
    bakedTransforms,
    removedIdentity,
  };
}

/**
 * Find repeated shapes for <use> extraction
 * Returns map of shape signature → nodes
 * TODO: Reserved for future implementation when adding <defs> + <use> optimization
 */
/* Commented out for future use
function findRepeatedShapes(root: SVGNode): Map<string, SVGNode[]> {
  const shapeMap = new Map<string, SVGNode[]>();

  const traverse = (node: SVGNode) => {
    if (!node) return;
    if (isShape(node.tag)) {
      let signature = node.tag;
      const keyAttrs = ['d', 'points', 'r', 'width', 'height', 'x1', 'y1', 'x2', 'y2'];
      for (const attr of keyAttrs) {
        const value = node.attrs.get(attr);
        if (value) signature += `|${attr}:${value}`;
      }
      const nodes = shapeMap.get(signature) || [];
      nodes.push(node);
      shapeMap.set(signature, nodes);
    }
    for (const child of node.children) {
      if (child.type === 'element') traverse(child);
    }
  };

  traverse(root);
  const repeated = new Map<string, SVGNode[]>();
  for (const [sig, nodes] of shapeMap) {
    if (nodes.length >= 2) repeated.set(sig, nodes);
  }
  return repeated;
}
*/

/**
 * Transform collapsing stage for pipeline
 */
export function transformCollapsingStage(
  root: SVGNode,
  config: OptConfig
): {
  modified: boolean;
  stats: {
    collapsedGroups: number;
    bakedTransforms: number;
    removedIdentity: number;
  };
} {
  const stats = collapseTransforms(root, config);

  return {
    modified:
      stats.collapsedGroups > 0 ||
      stats.bakedTransforms > 0 ||
      stats.removedIdentity > 0,
    stats,
  };
}
